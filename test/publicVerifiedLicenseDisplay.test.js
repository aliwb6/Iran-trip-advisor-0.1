import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = '../supabase/migrations/20260909194832_phase4g_public_verified_license_display.sql';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('public license signing is limited to the exact verified license for an eligible public provider', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /CREATE POLICY licenses_public_select_verified_provider[\s\S]*FOR SELECT[\s\S]*TO anon, authenticated/);
  assert.match(sql, /bucket_id = 'licenses'/);
  assert.match(sql, /storage\.allow_only_operation\('storage\.object\.sign'\)/);
  assert.match(sql, /private\.is_public_verified_license_object\(name\)/);
  assert.doesNotMatch(sql, /UPDATE storage\.buckets[\s\S]*public\s*=\s*true/i);
  assert.doesNotMatch(sql, /storage\.object\.(?:list|list_v2)/);

  for (const condition of [
    "p.role IN ('guide', 'agency')",
    'p.is_approved IS TRUE',
    'p.is_rejected IS NOT TRUE',
    'p.is_published IS TRUE',
    'p.is_public IS TRUE',
    "p.license_status = 'verified'",
    'p.license_url = p_object_name',
  ]) {
    assert.match(sql, new RegExp(condition.replace(/[().]/g, '\\$&')));
  }
});

test('public profile contract appends only a conditional license path and keeps private fields out', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /END AS public_license_path/);
  assert.match(sql, /RETURNS SETOF public\.public_profiles/);
  assert.match(sql, /created_at, updated_at,\s+public_license_path/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.doesNotMatch(sql, /email|phone_number|approval_rejection_reason|commission_rate/);
});

test('verified license UI uses only the public path and a short-lived signed URL', async () => {
  const card = await source('../src/components/profile/PublicLicenseCard.jsx');
  const helper = await source('../src/lib/publicLicense.js');

  assert.match(card, /public_license_path/);
  assert.match(card, /<img/);
  assert.match(card, /object[\s\S]*application\/pdf/);
  assert.match(card, /target="_blank"/);
  assert.doesNotMatch(card, /license_url|createSignedUrl|getPublicUrl/);

  assert.match(helper, /from\('licenses'\)\s*\.createSignedUrl\(publicLicensePath, PUBLIC_LICENSE_URL_TTL_SECONDS\)/);
  assert.match(helper, /const PUBLIC_LICENSE_URL_TTL_SECONDS = 10 \* 60/);
  assert.doesNotMatch(helper, /getPublicUrl/);
});

test('guide and agency pages keep the shared public RPC and license card', async () => {
  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx']) {
    const page = await source(path);
    assert.match(page, /selectPublicProfiles\(supabase\)/);
    assert.match(page, /<PublicLicenseCard/);
    assert.doesNotMatch(page, /from\(['"]profiles['"]\)/);
  }
});
