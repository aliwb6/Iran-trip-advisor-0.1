import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('privacy migration exposes relationship-scoped participant profiles only', async () => {
  const sql = await source('../supabase/migrations/20260907203714_phase3a_profile_privacy_primitives.sql');

  assert.match(sql, /FUNCTION public\.get_participant_profiles\(profile_ids uuid\[\]\)/);
  assert.match(sql, /RETURNS TABLE \(\s*id uuid,\s*full_name text,\s*avatar_url text,\s*gender text,\s*role text,\s*city text,\s*bio text\s*\)/s);
  assert.doesNotMatch(
    sql.slice(sql.indexOf('RETURNS TABLE (', sql.indexOf('get_participant_profiles')), sql.indexOf('LANGUAGE sql', sql.indexOf('get_participant_profiles'))),
    /email|phone|license_url|license_number|commission_rate/
  );
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_participant_profiles\(uuid\[\]\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_participant_profiles\(uuid\[\]\) TO authenticated/);
});

test('admin helper is internal and tour recipient discovery is server-side', async () => {
  const sql = await source('../supabase/migrations/20260907203714_phase3a_profile_privacy_primitives.sql');

  assert.match(sql, /FUNCTION public\.current_user_is_admin\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.current_user_is_admin\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /FUNCTION public\.resolve_tour_request_recipient\(p_tour_id uuid\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.resolve_tour_request_recipient\(uuid\) FROM PUBLIC, anon/);
});

test('booking contact RPC enforces booking relationship and release gate', async () => {
  const sql = await source('../supabase/migrations/20260907203714_phase3a_profile_privacy_primitives.sql');

  assert.match(sql, /FUNCTION public\.get_booking_contact_details\(p_booking_id uuid\)/);
  assert.match(sql, /contact_released IS NOT TRUE/);
  assert.match(sql, /NOT IN \(v_booking\.tourist_id, v_booking\.guide_id\)/);
  assert.match(sql, /COALESCE\(NULLIF\(p\.phone_number, ''\), p\.phone\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_booking_contact_details\(uuid\) FROM PUBLIC, anon/);
});

test('participant frontend API calls only privacy RPCs for cross-user identity and contact data', async () => {
  const api = await source('../src/api/participantProfiles.js');

  assert.match(api, /rpc\('get_participant_profiles'/);
  assert.match(api, /rpc\('resolve_tour_request_recipient'/);
  assert.match(api, /rpc\('get_booking_contact_details'/);
  assert.doesNotMatch(api, /from\(['"]profiles['"]\)/);
  assert.doesNotMatch(api, /current_user_is_admin/);
});

test('trip request job discovery uses relationship-scoped participant API', async () => {
  const api = await source('../src/api/tripRequests.js');

  assert.match(api, /fetchParticipantProfiles\(travelerIds\)/);
  const availableStart = api.indexOf('export async function getAvailableTripRequests');
  const availableEnd = api.indexOf('export async function getMyTripRequests');
  const availableBlock = api.slice(availableStart, availableEnd);
  assert.doesNotMatch(availableBlock, /from\(['"]profiles['"]\)/);
});
