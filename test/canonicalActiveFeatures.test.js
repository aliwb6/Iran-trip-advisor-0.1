import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('TripBuilder saves an authenticated user-owned custom trip only', async () => {
  const sourceCode = await source('../src/components/ai/TripBuilder.jsx');
  assert.match(sourceCode, /if \(!user\)/);
  assert.match(sourceCode, /from\('custom_trips'\)/);
  assert.match(sourceCode, /user_id: user\.id/);
  assert.match(sourceCode, /status: 'draft'/);
});

test('canonical migration enforces custom-trip ownership and allowed statuses', async () => {
  const migration = await source('../supabase/migrations/20260907130554_canonicalize_active_unversioned_features.sql');
  assert.match(migration, /CHECK \(status IN \('draft','saved','booked','completed'\)\)/);
  assert.match(migration, /FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(migration, /FOR INSERT TO authenticated\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.custom_trips FROM anon/);
});

test('homepage destinations keep public reads active-only while the admin editor reads all rows', async () => {
  const spotlight = await source('../src/components/SpotlightDestinations.jsx');
  const editor = await source('../src/components/admin/HomeDestinationsEditor.jsx');
  const migration = await source('../supabase/migrations/20260907130554_canonicalize_active_unversioned_features.sql');

  assert.match(spotlight, /from\('homepage_destinations'\)[\s\S]{0,300}\.eq\('is_active', true\)/);
  assert.match(editor, /from\('homepage_destinations'\)\.select\('\*'\)\.order\('sort_order'\)/);
  assert.match(migration, /homepage_destinations_public_active[\s\S]{0,160}USING \(is_active IS TRUE\)/);
  assert.match(migration, /homepage_destinations_admin_all/);
});

test('tour caption consumers use canonical gallery fields', async () => {
  const form = await source('../src/components/dashboard/TourForm.jsx');
  const details = await source('../src/pages/TourDetails.jsx');
  assert.match(form, /gallery_captions/);
  assert.match(form, /main_image_caption/);
  assert.match(details, /gallery_captions/);
  assert.match(details, /main_image_caption/);
});

test('proposal rejection uses proposal_id and blocks every terminal status in UI and RPC', async () => {
  const panel = await source('../src/components/profile/ProposalsPanel.jsx');
  const migration = await source('../supabase/migrations/20260907130554_canonicalize_active_unversioned_features.sql');
  const terminalStatuses = /'rejected', 'finalized', 'selected', 'closed'/;

  assert.match(panel, /rpc\('reject_trip_proposal', \{ proposal_id: slot\.id \}\)/);
  assert.match(panel, terminalStatuses);
  assert.match(migration, /request\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, terminalStatuses);
  assert.doesNotMatch(migration, /traveler_id/);
});

test('only versioned migrations remain active and the canonical filename matches Remote', async () => {
  const files = await readdir(new URL('../supabase/migrations/', import.meta.url));
  assert.ok(files.every(file => /^\d+_.+\.sql$/.test(file)));
  assert.ok(files.includes('20260907130554_canonicalize_active_unversioned_features.sql'));
  for (const legacy of [
    '001_trip_requests.sql',
    '20260903214031_add_tourist_profile_details.sql',
    '20260904000000_add_tourist_profile_details.sql',
    '20260904020000_make_profile_gallery_optional.sql',
    '20260904030000_allow_public_verified_license_reads.sql',
  ]) {
    assert.ok(!files.includes(legacy));
  }
});
