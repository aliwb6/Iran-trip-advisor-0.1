import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { applyPublicTourVisibility } from '../src/lib/publicTours.js';

const root = new URL('..', import.meta.url);

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

async function sourceFiles(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|jsx)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test('public guide and agency pages use the public profile RPC abstraction only', async () => {
  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx', '../src/pages/Guides.jsx', '../src/pages/Agencies.jsx']) {
    const content = await source(path);
    assert.match(content, /selectPublicProfiles|useGuides|useAgencies/);
  }

  const helper = await source('../src/lib/publicProfiles.js');
  assert.match(helper, /rpc\('get_public_profiles'\)/);
  assert.doesNotMatch(helper, /from\('profiles'\)/);
  assert.doesNotMatch(helper, /from\('public_profiles'\)/);

  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx', '../src/pages/CityPage.jsx', '../src/pages/AIAssistant.jsx', '../src/hooks/useSupabase.js']) {
    const content = await source(path);
    assert.doesNotMatch(content, /from\('profiles'\)|from\('public_profiles'\)/);
  }
});

test('public license card uses only the conditional public license path', async () => {
  const card = await source('../src/components/profile/PublicLicenseCard.jsx');
  assert.match(card, /public_license_path/);
  assert.match(card, /license_status === 'verified'/);
  assert.doesNotMatch(card, /license_url|license_id|license_number|createSignedUrl|storage\.from|window\.open/);

  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx']) {
    const content = await source(path);
    assert.doesNotMatch(content, /license_url|license_id|license_number/);
  }
});

test('self and admin flows retain private profiles access', async () => {
  const auth = await source('../src/lib/AuthContext.jsx');
  const admin = await source('../src/pages/AdminDashboard.jsx');
  assert.match(auth, /from\('profiles'\)/);
  assert.match(admin, /from\('profiles'\)/);
});

test('public tour visibility explicitly permits published or active tours only', () => {
  const calls = [];
  const query = { or(value) { calls.push(value); return this; } };
  assert.equal(applyPublicTourVisibility(query), query);
  assert.deepEqual(calls, ['status.eq.published,and(status.eq.active,is_active.is.true)']);
});

test('public article hooks require approved and published articles', async () => {
  const hooks = await source('../src/hooks/useSupabase.js');
  assert.match(hooks, /\.eq\('status', 'approved'\)\s*\.eq\('is_published', true\)/);
});

test('browser source contains no notification inserts or revoked trigger RPC calls', async () => {
  const files = await sourceFiles('src');
  const contents = await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));

  for (const content of contents) {
    assert.doesNotMatch(content, /from\(['"]notifications['"]\)[\s\S]{0,300}\.insert\(/);
    assert.doesNotMatch(content, /rpc\(['"](?:handle_new_user|handle_new_trip_request|handle_trip_request_confirmed|handle_trip_slot_insert|notify_guides_new_request|notify_on_guide_selected|notify_on_message|set_username_if_empty|is_admin)['"]/);
  }
});

test('local Phase 1 migrations match the hardened public contract', async () => {
  const migrationA = await source('../supabase/migrations/20260907120450_phase1_security_hardening_a.sql');
  const migrationB = await source('../supabase/migrations/20260907120537_phase1_security_hardening_b.sql');
  const migrationC = await source('../supabase/migrations/20260907122345_phase1c_public_profile_rpc.sql');

  assert.match(migrationA, /CREATE OR REPLACE VIEW public\.public_profiles/);
  assert.match(migrationA, /GRANT SELECT ON public\.public_profiles TO anon, authenticated/);
  assert.match(migrationA, /REVOKE INSERT ON TABLE public\.notifications FROM anon, authenticated/);
  assert.match(migrationA, /tours_public_read_published/);
  assert.match(migrationA, /articles_public_read_approved/);
  assert.match(migrationB, /security_invoker = true/);
  assert.match(migrationB, /messages_admin_read_all/);
  assert.match(migrationB, /REVOKE EXECUTE ON FUNCTION/);
  assert.match(migrationC, /CREATE OR REPLACE FUNCTION public\.get_public_profiles\(\)/);
  assert.match(migrationC, /RETURNS SETOF public\.public_profiles/);
  assert.match(migrationC, /STABLE\s+SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(migrationC, /REVOKE ALL ON FUNCTION public\.get_public_profiles\(\) FROM PUBLIC/);
  assert.match(migrationC, /GRANT EXECUTE ON FUNCTION public\.get_public_profiles\(\) TO anon, authenticated/);
  assert.match(migrationC, /REVOKE SELECT ON TABLE public\.profiles FROM anon/);
  assert.match(migrationC, /NOTIFY pgrst, 'reload schema'/);
});
