import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuideReviewUpdates,
  checkProfileCompletion,
  getGuideApprovalEligibility,
  getGuideReviewValidationError,
  persistGuideReview,
} from '../src/lib/profileCompletion.js';

const completeGuide = {
  id: 'guide-1',
  role: 'guide',
  full_name: 'Sara Ahmadi',
  email: 'sara@example.com',
  phone: '+98 912 000 0000',
  city: 'Shiraz',
  languages: 'Persian, English',
  specialties: ['Cultural'],
  special_abilities: ['First Aid'],
  has_vehicle: false,
  bio: 'Local guide',
  license_url: 'guide-1/license.pdf',
  license_status: 'pending_review',
  is_approved: false,
};

test('pending-review profile with all required fields is 100% complete and approvable', () => {
  const completion = checkProfileCompletion(completeGuide);
  const eligibility = getGuideApprovalEligibility(completeGuide);

  assert.equal(completion.percentage, 100);
  assert.equal(completion.completed, true);
  assert.equal(eligibility.canApprove, true);
});

test('an explicit no-vehicle answer still completes the vehicle requirement', () => {
  const completion = checkProfileCompletion({ ...completeGuide, has_vehicle: false });

  assert.equal(completion.items.find(item => item.label === 'has_vehicle')?.ok, true);
  assert.equal(completion.completed, true);
});

test('an unanswered vehicle requirement prevents provider completion', () => {
  const completion = checkProfileCompletion({ ...completeGuide, has_vehicle: null });

  assert.equal(completion.items.find(item => item.label === 'has_vehicle')?.ok, false);
  assert.equal(completion.completed, false);
});

test('at least one non-empty special ability is required for provider completion', () => {
  for (const special_abilities of [null, [], ['  ']]) {
    const completion = checkProfileCompletion({ ...completeGuide, special_abilities });
    assert.equal(completion.items.find(item => item.label === 'special_abilities')?.ok, false);
    assert.equal(completion.completed, false);
  }
});

test('a missing required field keeps completion below 100% and disables approval', () => {
  const profile = { ...completeGuide, email: '  ' };
  assert.ok(checkProfileCompletion(profile).percentage < 100);
  assert.equal(getGuideApprovalEligibility(profile).canApprove, false);
});

test('a missing license disables approval', () => {
  const profile = { ...completeGuide, license_url: '' };
  assert.equal(getGuideApprovalEligibility(profile).canApprove, false);
  assert.match(getGuideReviewValidationError({ decision: 'approve', profile }), /license document/i);
});

test('pending review is not an approval blocker', () => {
  assert.equal(completeGuide.license_status, 'pending_review');
  assert.equal(getGuideReviewValidationError({ decision: 'approve', profile: completeGuide }), '');
});

test('rejection requires a reason without affecting approval eligibility', () => {
  assert.match(getGuideReviewValidationError({ decision: 'reject', profile: completeGuide }), /reason is required/i);
  assert.equal(getGuideApprovalEligibility(completeGuide).canApprove, true);
  assert.equal(getGuideReviewValidationError({ decision: 'approve', profile: completeGuide, rejectionReason: '' }), '');
});

test('approval sends verified/public status changes to the profiles backend', async () => {
  const updates = buildGuideReviewUpdates({
    guide: { ...completeGuide, approval_rejection_reason: 'Old reason' },
    form: {
      full_name: completeGuide.full_name,
      email: completeGuide.email,
      phone: completeGuide.phone,
      city: completeGuide.city,
      languages: completeGuide.languages,
      bio: completeGuide.bio,
      tourTypes: 'Cultural',
      license_status: 'pending_review',
    },
    parsedTourTypes: ['Cultural'],
    decision: 'approve',
    rejectionReason: '',
    reviewedAt: '2026-09-06T12:00:00.000Z',
  });

  assert.equal(updates.is_approved, true);
  assert.equal(updates.is_rejected, false);
  assert.equal(updates.is_published, true);
  assert.equal(updates.license_status, 'verified');
  assert.equal(updates.approval_rejection_reason, null);
  assert.equal(updates.approval_reviewed_at, '2026-09-06T12:00:00.000Z');
  assert.deepEqual(updates.specialties, ['Cultural']);
  assert.equal(Object.hasOwn(updates, 'special_abilities'), false);
  assert.equal(Object.hasOwn(updates, 'has_vehicle'), false);

  let received;
  const client = {
    from(table) {
      assert.equal(table, 'profiles');
      return {
        update(payload) {
          received = payload;
          return {
            eq(column, value) {
              assert.deepEqual([column, value], ['id', completeGuide.id]);
              return {
                select(columns) {
                  assert.match(columns, /id, full_name, email, phone/);
                  assert.match(columns, /license_url, license_status/);
                  assert.match(columns, /special_abilities, has_vehicle/);
                  return Promise.resolve({ data: [{ ...completeGuide, ...payload }], error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const saved = await persistGuideReview(client, completeGuide.id, updates);
  assert.equal(received.is_approved, true);
  assert.equal(received.license_status, 'verified');
  assert.equal(saved.is_approved, true);
});

function moderationClientReturning(data, error = null) {
  return {
    from(table) {
      assert.equal(table, 'profiles');
      return {
        update() {
          return {
            eq(column, value) {
              assert.deepEqual([column, value], ['id', completeGuide.id]);
              return {
                select(columns) {
                  assert.match(columns, /id, full_name, email, phone/);
                  assert.match(columns, /license_url, license_status/);
                  assert.match(columns, /special_abilities, has_vehicle/);
                  return Promise.resolve({ data, error });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('moderation reports a missing target instead of a single-object coercion error', async () => {
  await assert.rejects(
    persistGuideReview(moderationClientReturning([]), completeGuide.id, { is_approved: true }),
    /profile record not found for moderation/i,
  );
});

test('moderation rejects an impossible multi-row result as an integrity failure', async () => {
  await assert.rejects(
    persistGuideReview(moderationClientReturning([completeGuide, { ...completeGuide }]), completeGuide.id, { is_approved: true }),
    /multiple profile records matched/i,
  );
});

test('an already-approved profile cannot be approved again', () => {
  const profile = { ...completeGuide, is_approved: true, license_status: 'verified' };
  assert.equal(getGuideApprovalEligibility(profile).canApprove, false);
  assert.match(getGuideReviewValidationError({ decision: 'approve', profile }), /already approved/i);
});

test('valid rejection persists the canonical rejected and non-public state', async () => {
  const updates = buildGuideReviewUpdates({
    guide: completeGuide,
    form: {
      full_name: completeGuide.full_name,
      email: completeGuide.email,
      phone: completeGuide.phone,
      city: completeGuide.city,
      languages: completeGuide.languages,
      bio: completeGuide.bio,
      tourTypes: 'Cultural',
      license_status: 'pending_review',
    },
    parsedTourTypes: ['Cultural'],
    decision: 'reject',
    rejectionReason: '  The document is unreadable.  ',
    reviewedAt: '2026-09-06T12:00:00.000Z',
  });

  assert.equal(updates.is_approved, false);
  assert.equal(updates.is_rejected, true);
  assert.equal(updates.is_published, false);
  assert.equal(updates.license_status, 'rejected');
  assert.equal(updates.approval_rejection_reason, 'The document is unreadable.');

  const saved = await persistGuideReview(
    moderationClientReturning([{ ...completeGuide, ...updates }]),
    completeGuide.id,
    updates,
  );
  assert.equal(saved.is_rejected, true);
  assert.equal(saved.approval_rejection_reason, 'The document is unreadable.');
});

test('submitting disables approval', () => {
  assert.equal(getGuideApprovalEligibility(completeGuide, { submitting: true }).canApprove, false);
});
