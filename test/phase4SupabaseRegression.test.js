import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

async function sourceFiles(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test('Phase 4A keeps every requested foreign-key index', async () => {
  const sql = await source('../supabase/migrations/20260909152657_phase4a_foreign_key_indexes.sql');
  const indexes = [
    ['idx_guides_user_id', 'public.guides', 'user_id'],
    ['idx_messages_receiver_id', 'public.messages', 'receiver_id'],
    ['idx_reviews_agency_id', 'public.reviews', 'agency_id'],
    ['idx_reviews_guide_id', 'public.reviews', 'guide_id'],
    ['idx_site_settings_updated_by', 'public.site_settings', 'updated_by'],
    ['idx_tour_requests_guide_id', 'public.tour_requests', 'guide_id'],
    ['idx_tour_requests_tour_id', 'public.tour_requests', 'tour_id'],
    ['idx_tour_requests_tourist_id', 'public.tour_requests', 'tourist_id'],
    ['idx_tours_agency_id', 'public.tours', 'agency_id'],
    ['idx_tours_guide_id', 'public.tours', 'guide_id'],
    ['idx_tours_owner_id', 'public.tours', 'owner_id'],
    ['idx_trip_requests_selected_guide_id', 'public.trip_requests', 'selected_guide_id'],
  ];

  for (const [name, table, column] of indexes) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS ${name}\\s+ON ${table.replace('.', '\\.')}`));
    assert.match(sql, new RegExp(`ON ${table.replace('.', '\\.')} \\(${column}\\)`));
  }
  assert.doesNotMatch(sql, /DROP\s+INDEX/i);
});

test('Phase 4B/C keeps anonymous access read-only and private data authenticated-only', async () => {
  const phase4b = await source('../supabase/migrations/20260909153208_phase4b_canonical_rls_and_grants.sql');
  const phase4c = await source('../supabase/migrations/20260909153506_phase4c_legacy_rls_consolidation.sql');

  assert.match(phase4b, /CREATE POLICY tours_anon_read_published[\s\S]*FOR SELECT[\s\S]*TO anon/);
  assert.match(phase4b, /REVOKE ALL ON TABLE public\.trip_requests FROM anon, authenticated/);
  assert.match(phase4b, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.trip_requests TO authenticated/);
  assert.match(phase4b, /REVOKE ALL ON TABLE public\.trip_slots FROM anon, authenticated/);
  assert.match(phase4b, /REVOKE ALL ON TABLE public\.messages FROM anon, authenticated/);
  assert.match(phase4b, /CREATE POLICY reviews_anon_select_approved[\s\S]*status = 'approved'/);
  assert.match(phase4b, /GRANT SELECT ON TABLE public\.site_settings TO anon/);
  assert.match(phase4b, /CREATE POLICY homepage_destinations_admin_update[\s\S]*current_user_is_admin/);

  assert.match(phase4c, /CREATE POLICY guides_anon_select_published[\s\S]*is_published IS TRUE/);
  assert.match(phase4c, /CREATE POLICY agencies_anon_select_published[\s\S]*is_published IS TRUE/);
  assert.match(phase4c, /CREATE POLICY articles_anon_select[\s\S]*status = 'approved'[\s\S]*is_published IS TRUE/);
  assert.match(phase4c, /REVOKE ALL ON TABLE public\.tour_requests FROM anon, authenticated/);
  assert.doesNotMatch(`${phase4b}\n${phase4c}`, /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|TRIGGER|REFERENCES)[^;]*\bTO anon\b/i);
});

test('Phase 4D preserves bucket limits, public reads, and existing upload path conventions', async () => {
  const sql = await source('../supabase/migrations/20260909153939_phase4d_storage_hardening.sql');
  const tourForm = await source('../src/components/dashboard/TourForm.jsx');
  const destinations = await source('../src/components/admin/HomeDestinationsEditor.jsx');
  const dashboard = await source('../src/pages/Dashboard.jsx');

  assert.match(sql, /file_size_limit = 10485760/);
  assert.match(sql, /ARRAY\['image\/jpeg','image\/png','image\/webp'\]/);
  assert.match(sql, /owner_id = \(SELECT auth\.uid\(\)\)::text/);
  assert.match(sql, /bucket_id = 'tour-images'/);
  assert.match(sql, /bucket_id = 'proposal-images'/);
  assert.match(sql, /CREATE POLICY site_images_admin_(?:insert|update|delete)/);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(SELECT auth\.uid\(\)\)::text/);

  assert.match(tourForm, /const fileName = `\$\{Date\.now\(\)\}-\$\{file\.name/);
  assert.match(tourForm, /from\('tour-images'\)\.upload\(fileName, file\)/);
  assert.match(destinations, /const path = `homepage\/\$\{Date\.now\(\)\}-\$\{safeName\}`/);
  assert.match(dashboard, /const path = `\$\{userId\}\/\$\{Date\.now\(\)\}-\$\{safeName\}`/);
  assert.match(dashboard, /from\('licenses'\)\.upload\(path, file, \{ upsert: false \}\)/);
  assert.match(dashboard, /from\('avatars'\)[\s\S]{0,100}\.upload\(path, file/);
});

test('Phase 4E exposes only sanitized application RPCs and keeps helpers private', async () => {
  const sql = await source('../supabase/migrations/20260909154243_phase4e_internal_security_helpers.sql');
  const files = await sourceFiles('src');
  const frontend = (await Promise.all(
    files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8'))
  )).join('\n');

  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.current_user_is_admin\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.is_reviewable_profile_target\(p_profile_id uuid\)/);
  assert.match(sql, /DROP FUNCTION public\.current_user_is_admin\(\)/);
  assert.match(sql, /DROP FUNCTION public\.is_reviewable_profile_target\(uuid\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_booking_contact_details/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_participant_profiles/);
  assert.match(sql, /SET search_path = ''/);

  assert.doesNotMatch(frontend, /schema\(['"]private['"]\)/);
  assert.doesNotMatch(frontend, /rpc\(['"](?:current_user_is_admin|is_reviewable_profile_target)['"]\)/);
  assert.doesNotMatch(frontend, /private\.(?:current_user_is_admin|is_reviewable_profile_target)/);
});

test('payment provider events remain RLS-protected and browser-denied', async () => {
  const foundation = await source('../supabase/migrations/20260907220102_phase3b_stripe_payment_lifecycle.sql');
  const phase4e = await source('../supabase/migrations/20260909154243_phase4e_internal_security_helpers.sql');

  assert.match(foundation, /ALTER TABLE public\.payment_provider_events ENABLE ROW LEVEL SECURITY/);
  assert.match(foundation, /REVOKE ALL ON TABLE public\.payment_provider_events FROM PUBLIC, anon, authenticated/);
  assert.match(foundation, /GRANT ALL ON TABLE public\.payment_provider_events TO service_role/);
  assert.match(phase4e, /CREATE POLICY payment_provider_events_no_browser_access/);
  assert.match(phase4e, /TO anon, authenticated[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/);
});
