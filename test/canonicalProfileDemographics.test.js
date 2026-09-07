import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('profile UI persists nationality, accepts a valid age, permits null age, and rejects invalid ages client-side', async () => {
  const profilePage = await source('../src/pages/profile/ProfilePage.jsx');

  assert.match(profilePage, /saveField\('nationality'\)/);
  assert.match(profilePage, /saveProfileValue\('age', null\)/);
  assert.match(profilePage, /Number\.isInteger\(age\) \|\| age < 1 \|\| age > 120/);
  assert.match(profilePage, /saveProfileValue\('age', age\)/);
});

test('canonical completion migration requires provider fields but not approval, verification, publication, or gallery state', async () => {
  const migration = await source('../supabase/migrations/20260907125015_canonical_profile_demographics_and_completion.sql');
  const functionBody = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.check_profile_completed()'),
    migration.indexOf('DROP TRIGGER IF EXISTS trg_profile_completed'),
  );

  for (const field of ['full_name', 'email', 'phone', 'city', 'languages', 'bio', 'avatar_url', 'license_url']) {
    assert.match(functionBody, new RegExp(`NEW\\.${field}`));
  }
  assert.match(functionBody, /cardinality\(NEW\.tour_types\)/);
  assert.match(functionBody, /cardinality\(NEW\.specialties\)/);
  assert.match(functionBody, /NEW\.specialty/);
  assert.doesNotMatch(functionBody, /license_status|is_approved|is_published|gallery_images/);
  assert.match(functionBody, /IF NEW\.role IN \('guide', 'agency'\) THEN/);
  assert.doesNotMatch(functionBody, /ELSE\s+NEW\.profile_completed/);
});

test('canonical demographics migration enforces the Remote age constraint and reloads PostgREST', async () => {
  const migration = await source('../supabase/migrations/20260907125015_canonical_profile_demographics_and_completion.sql');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS nationality text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS age smallint/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false/);
  assert.match(migration, /CHECK \(age IS NULL OR age BETWEEN 1 AND 120\)/);
  assert.match(migration, /SECURITY INVOKER\s+SET search_path = ''/);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
});
