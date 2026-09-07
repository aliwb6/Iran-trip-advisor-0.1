import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('final privacy lockdown removes broad raw profile SELECT policies', async () => {
  const sql = await source('../supabase/migrations/20260907214845_phase3a_final_profile_privacy_lockdown.sql');

  assert.match(sql, /DROP POLICY IF EXISTS "Public profiles viewable by all" ON public\.profiles/);
  assert.match(sql, /DROP POLICY IF EXISTS "select_profiles" ON public\.profiles/);
  assert.doesNotMatch(sql, /CREATE POLICY[^;]*(USING\s*\(\s*true\s*\)|USING\s+true)/is);
});

test('raw profile table remains unavailable to anon while authenticated owner/admin reads stay possible', async () => {
  const sql = await source('../supabase/migrations/20260907214845_phase3a_final_profile_privacy_lockdown.sql');

  assert.match(sql, /REVOKE SELECT ON TABLE public\.profiles FROM anon/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.profiles TO authenticated/);
});

test('safe public and relationship profile RPC contracts remain in place', async () => {
  const publicRpc = await source('../supabase/migrations/20260907122345_phase1c_public_profile_rpc.sql');
  const privacyRpc = await source('../supabase/migrations/20260907203714_phase3a_profile_privacy_primitives.sql');

  assert.match(publicRpc, /FUNCTION public\.get_public_profiles\(/);
  assert.match(publicRpc, /GRANT EXECUTE ON FUNCTION public\.get_public_profiles/);
  assert.match(privacyRpc, /FUNCTION public\.get_participant_profiles\(profile_ids uuid\[\]\)/);
  assert.match(privacyRpc, /GRANT EXECUTE ON FUNCTION public\.get_participant_profiles\(uuid\[\]\) TO authenticated/);
});

test('frontend counterpart identity paths avoid generic direct profile SELECTs', async () => {
  const chat = await source('../src/pages/Chat.jsx');
  const tourDetails = await source('../src/pages/TourDetails.jsx');
  const tripRequests = await source('../src/api/tripRequests.js');

  assert.doesNotMatch(chat, /from\(['"]profiles['"]\)/);
  assert.doesNotMatch(tourDetails, /from\(['"]profiles['"]\)/);
  assert.match(tripRequests, /fetchParticipantProfiles\(travelerIds\)/);
});
