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
  assert.doesNotMatch(api, /email|phone|license_url|license_id|license_number/);
});

test('trip request job discovery uses relationship-scoped participant API', async () => {
  const api = await source('../src/api/tripRequests.js');

  assert.match(api, /fetchParticipantProfiles\(travelerIds\)/);
  const availableStart = api.indexOf('export async function getAvailableTripRequests');
  const availableEnd = api.indexOf('export async function getMyTripRequests');
  const availableBlock = api.slice(availableStart, availableEnd);
  assert.doesNotMatch(availableBlock, /from\(['"]profiles['"]\)/);
});

test('chat uses public provider identity first and relationship-scoped identity otherwise', async () => {
  const chat = await source('../src/pages/Chat.jsx');

  assert.match(chat, /selectPublicProfiles/);
  assert.match(chat, /fetchParticipantProfile\(guideId\)/);
  assert.doesNotMatch(chat, /from\(['"]profiles['"]\)/);
  assert.doesNotMatch(chat, /email|phone_number|license_url|license_id|license_number/);
});

test('dashboard message counterpart lookups use participant RPCs', async () => {
  const dashboard = await source('../src/pages/Dashboard.jsx');

  assert.match(dashboard, /import \{ fetchParticipantProfiles \} from '@\/api\/participantProfiles'/);
  assert.match(dashboard, /fetchParticipantProfiles\(otherIds\)/);
  assert.doesNotMatch(dashboard, /from\(['"]profiles['"]\)\s*\.select\([^)]*\.in\('id',\s*otherIds/s);
});

test('tour request recipient selection stays server-side', async () => {
  const tourDetails = await source('../src/pages/TourDetails.jsx');

  assert.match(tourDetails, /import \{ resolveTourRequestRecipient \} from '@\/api\/participantProfiles'/);
  assert.match(tourDetails, /await resolveTourRequestRecipient\(tour\.id\)/);
  assert.doesNotMatch(tourDetails, /current_user_is_admin|is_admin/);
  assert.doesNotMatch(tourDetails, /from\(['"]profiles['"]\)/);
});

test('public provider surfaces remain behind the public profile abstraction', async () => {
  for (const path of ['../src/pages/Guides.jsx', '../src/pages/Agencies.jsx', '../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx']) {
    const page = await source(path);
    assert.match(page, /selectPublicProfiles|useGuides|useAgencies/);
    assert.doesNotMatch(page, /from\(['"]profiles['"]\)/);
  }
});

test('self profile reads remain owner-scoped and frontend never calls the admin helper', async () => {
  const auth = await source('../src/lib/AuthContext.jsx');
  const dashboard = await source('../src/pages/Dashboard.jsx');
  const allFrontend = await Promise.all([
    source('../src/lib/AuthContext.jsx'),
    source('../src/pages/Dashboard.jsx'),
    source('../src/pages/Chat.jsx'),
    source('../src/pages/TourDetails.jsx'),
  ]);

  assert.match(auth, /from\('profiles'\)[\s\S]*\.eq\('id', userId\)/);
  assert.match(dashboard, /from\('profiles'\)[\s\S]*\.eq\('id', user\.id\)/);
  assert.doesNotMatch(allFrontend.join('\n'), /current_user_is_admin/);
});
