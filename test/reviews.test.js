import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildProfileReviewInsert,
  buildReviewModerationUpdates,
  fetchApprovedProfileReviews,
  fetchProfileReviewsSafely,
  getReviewValidationError,
  persistReviewModeration,
  submitProfileReview,
} from '../src/lib/reviews.js';

const user = { id: 'reviewer-1', email: 'traveler@example.com' };

test('guide review submission targets the canonical profile and starts pending', () => {
  const payload = buildProfileReviewInsert({
    user,
    targetType: 'guide',
    targetId: 'guide-profile-1',
    rating: 5,
    reviewText: '  A wonderful local guide.  ',
  });

  assert.equal(payload.profile_id, 'guide-profile-1');
  assert.equal(payload.guide_id, null);
  assert.equal(payload.agency_id, null);
  assert.equal(payload.tour_id, null);
  assert.equal(payload.reviewer_id, user.id);
  assert.equal(payload.status, 'pending');
  assert.equal(payload.review_text, 'A wonderful local guide.');
  assert.equal('reviewer_email' in payload, false);
});

test('agency submission uses profiles.id without querying the legacy agencies table', async () => {
  let inserted;
  const client = {
    from(table) {
      assert.equal(table, 'reviews');
      return {
        insert(payload) {
          inserted = payload;
          return {
            select: () => Promise.resolve({ data: [{ id: 'review-1', ...payload }], error: null }),
          };
        },
      };
    },
  };

  const saved = await submitProfileReview(client, {
    user,
    targetType: 'agency',
    profileId: 'agency-profile-1',
    rating: 4,
    reviewText: 'Very well organized.',
  });

  assert.equal(inserted.profile_id, 'agency-profile-1');
  assert.equal(inserted.guide_id, null);
  assert.equal(inserted.agency_id, null);
  assert.equal(saved.status, 'pending');
});

test('Guide and Agency public reads use the privacy-safe approved-review RPC', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push([name, args]);
      return { data: [], error: null };
    },
  };

  await fetchApprovedProfileReviews(client, { targetType: 'guide', profileId: 'guide-profile-1' });
  await fetchApprovedProfileReviews(client, { targetType: 'agency', profileId: 'agency-profile-1' });

  assert.deepEqual(calls, [
    ['get_public_profile_reviews', { p_profile_id: 'guide-profile-1' }],
    ['get_public_profile_reviews', { p_profile_id: 'agency-profile-1' }],
  ]);
});

test('a public review RPC failure is isolated so a Guide or Agency profile can still render', async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: { message: 'review RPC temporarily unavailable' },
    }),
  };

  for (const targetType of ['guide', 'agency']) {
    const result = await fetchProfileReviewsSafely(client, {
      targetType,
      profileId: `${targetType}-profile-1`,
    });
    assert.deepEqual(result.reviews, []);
    assert.match(result.error, /review RPC temporarily unavailable/i);
  }
});

test('empty text and invalid ratings are rejected before submission', () => {
  assert.match(getReviewValidationError({ user, rating: 0, reviewText: 'Good' }), /between 1 and 5/i);
  assert.match(getReviewValidationError({ user, rating: 6, reviewText: 'Good' }), /between 1 and 5/i);
  assert.match(getReviewValidationError({ user, rating: 5, reviewText: '   ' }), /required/i);
});

test('admin edit is persisted with approval and rejection metadata', () => {
  const approved = buildReviewModerationUpdates({
    decision: 'approve',
    reviewText: '  Corrected final text. ',
    reviewedBy: 'admin-1',
    reviewedAt: '2026-09-06T12:00:00.000Z',
  });
  assert.deepEqual(approved, {
    review_text: 'Corrected final text.',
    status: 'approved',
    reviewed_at: '2026-09-06T12:00:00.000Z',
    reviewed_by: 'admin-1',
  });

  const rejected = buildReviewModerationUpdates({
    decision: 'reject',
    reviewText: 'Rejected content',
    reviewedBy: 'admin-1',
    reviewedAt: '2026-09-06T12:00:00.000Z',
  });
  assert.equal(rejected.status, 'rejected');
});

test('moderation detects missing or impossible multi-row updates', async () => {
  const clientReturning = data => ({
    from: () => ({
      update: () => ({
        eq: () => ({ select: () => Promise.resolve({ data, error: null }) }),
      }),
    }),
  });

  await assert.rejects(
    persistReviewModeration(clientReturning([]), 'missing-review', { status: 'approved' }),
    /not found for moderation/i,
  );
  await assert.rejects(
    persistReviewModeration(clientReturning([{ id: 'r1' }, { id: 'r2' }]), 'review-1', { status: 'approved' }),
    /multiple review records/i,
  );
});

test('base review migration enforces pending submissions, moderation authorization, and approved aggregates', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20260907114250_add_review_moderation_workflow.sql', import.meta.url),
    'utf8',
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS profile_id uuid/);
  assert.match(sql, /FOREIGN KEY \(profile_id\) REFERENCES public\.profiles\(id\)/);
  assert.match(sql, /status IN \('pending', 'approved', 'rejected'\)/);
  assert.match(sql, /reviewer_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /AND status = 'pending'/);
  assert.match(sql, /AND guide_id IS NULL[\s\S]*AND agency_id IS NULL/);
  assert.match(sql, /target_profile\.role IN \('guide', 'agency'\)/);
  assert.match(sql, /review\.status = 'approved'/);
  assert.match(sql, /UPDATE public\.profiles[\s\S]*review_count = approved_count/);
  assert.doesNotMatch(sql, /INSERT INTO public\.agencies/);
});

test('privacy compatibility migration exposes only approved reviews through a sanitized public RPC', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20260907224321_phase3c_public_tours_reviews_privacy_compatibility.sql', import.meta.url),
    'utf8',
  );

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_public_profile_reviews\(p_profile_id uuid\)/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /r\.status = 'approved'/);
  assert.match(sql, /COALESCE\(NULLIF\(btrim\(r\.reviewer_name\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_public_profile_reviews\(uuid\) TO anon, authenticated/);
  assert.doesNotMatch(sql, /RETURNS TABLE[\s\S]{0,350}(?:email|phone|license)/i);
});

test('admin review loading uses the canonical profile target and does not require agencies rows', async () => {
  const adminDashboard = await readFile(
    new URL('../src/pages/AdminDashboard.jsx', import.meta.url),
    'utf8',
  );

  assert.match(adminDashboard, /target_profile:profiles!reviews_profile_id_fkey/);
  assert.doesNotMatch(adminDashboard, /agencies!reviews_agency_id_fkey/);
});
