import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('travelers receive only current live dispatch recipients through an owner-scoped RPC', async () => {
  const migration = await source('../supabase/migrations/20260920130000_traveler_active_dispatch_recipients.sql');
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /r\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /d\.proposal_round = r\.proposal_round/);
  assert.match(migration, /d\.status = 'pending'/);
  assert.match(migration, /d\.expires_at > now\(\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_my_active_trip_request_dispatches\(uuid\[\]\) TO authenticated/);
});

test('mobile navigation keeps notifications visible and request cards link live recipients to public profiles', async () => {
  const [navbar, card, api, page] = await Promise.all([
    source('../src/components/layout/Navbar.jsx'),
    source('../src/components/profile/RequestCard.jsx'),
    source('../src/api/tripRequests.js'),
    source('../src/pages/profile/RequestsPage.jsx'),
  ]);
  assert.match(navbar, /sm:hidden[\s\S]*<NotificationBell isLight=\{isLight\}/);
  assert.match(card, /dispatchedProviders\.length > 0/);
  assert.match(card, /`\/agencies\/\$\{provider\.provider_id\}`/);
  assert.match(card, /`\/guides\/\$\{provider\.provider_id\}`/);
  assert.match(api, /get_my_active_trip_request_dispatches/);
  assert.match(page, /refetchInterval: 10_000/);
});

test('recipient visibility migration does not modify dispatch or proposal queue behavior', async () => {
  const migration = await source('../supabase/migrations/20260920130000_traveler_active_dispatch_recipients.sql');
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.dispatch_trip_request/);
  assert.doesNotMatch(migration, /CREATE TRIGGER/);
  assert.doesNotMatch(migration, /visibility_advanced_at/);
});
