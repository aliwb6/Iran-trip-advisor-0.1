import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

const migrationPath = '../supabase/migrations/20260909200742_public_verified_license_previews.sql';
const hardeningMigrationPath = '../supabase/migrations/20260909201724_harden_public_license_profile_surface.sql';

test('verified public license migration keeps the licenses bucket private and narrowly scoped', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_profiles/);
  assert.match(sql, /public_license_path/);
  assert.match(sql, /is_rejected IS NOT TRUE/);
  assert.match(sql, /license_status = 'verified'/);
  assert.match(sql, /REVOKE SELECT ON TABLE public\.profiles FROM anon/);

  assert.match(sql, /CREATE POLICY licenses_public_verified_select/);
  assert.match(sql, /FOR SELECT\s+TO anon, authenticated/s);
  assert.match(sql, /bucket_id = 'licenses'/);
  assert.match(sql, /pp\.public_license_path = storage\.objects\.name/);

  assert.doesNotMatch(sql, /SET\s+public\s*=\s*true/i);
  assert.doesNotMatch(sql, /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.profiles\s+TO\s+anon/i);
});

test('public profile surface hardening makes the view security-invoker and keeps storage behind the public RPC', async () => {
  const sql = await source(hardeningMigrationPath);

  assert.match(sql, /ALTER VIEW public\.public_profiles SET \(security_invoker = true\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.public_profiles FROM anon, authenticated/);
  assert.match(sql, /CREATE POLICY licenses_public_verified_select/);
  assert.match(sql, /FROM public\.get_public_profiles\(\) AS pp/);
  assert.match(sql, /pp\.public_license_path = storage\.objects\.name/);
  assert.match(sql, /pp\.license_status = 'verified'/);
  assert.doesNotMatch(sql, /FROM public\.profiles/);
});

test('public profile RPC exposes only the semantic verified-license path', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_public_profiles\(\)/);
  assert.match(sql, /RETURNS SETOF public\.public_profiles/);
  assert.match(sql, /pp\.public_license_path/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_public_profiles\(\) TO anon, authenticated/);

  const publicProfileLib = await source('../src/lib/publicProfiles.js');
  assert.match(publicProfileLib, /rpc\('get_public_profiles'\)/);
  assert.doesNotMatch(publicProfileLib, /from\(['"]profiles['"]\)/);
});

test('public license card renders the actual verified document instead of the old text-only box', async () => {
  const card = await source('../src/components/profile/PublicLicenseCard.jsx');

  assert.match(card, /public_license_path/);
  assert.match(card, /license_status === 'verified'/);
  assert.match(card, /\.from\('licenses'\)/);
  assert.match(card, /createSignedUrl\(licensePath, 600\)/);
  assert.match(card, /object-contain/);
  assert.match(card, /<iframe/);
  assert.match(card, /View license/);

  assert.doesNotMatch(card, /This provider’s license has been reviewed and verified by Iran Trip Advisor/);
  assert.doesNotMatch(card, /profile\?\.license_url/);
});

test('guide and agency public pages share the verified license card without direct profile reads', async () => {
  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx']) {
    const page = await source(path);
    assert.match(page, /selectPublicProfiles\(supabase\)/);
    assert.match(page, /<PublicLicenseCard/);
    assert.doesNotMatch(page, /from\(['"]profiles['"]\)/);
  }
});
