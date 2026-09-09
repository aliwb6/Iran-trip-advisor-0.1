import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('tour package sort no longer exposes Newest First', async () => {
  const filters = await source('../src/components/tours/TourFilters.jsx');
  assert.doesNotMatch(filters, /key:\s*['"]newest['"]/);
  assert.doesNotMatch(filters, /Newest First/);
  assert.match(filters, /Highest Review/);
});

test('profile gallery storage migration creates the expected public bucket and owner-scoped writes', async () => {
  const migration = await source('../supabase/migrations/20260909212237_human_readable_usernames_and_profile_gallery_storage.sql');
  assert.match(migration, /'profile-gallery'/);
  assert.match(migration, /5242880/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
  assert.match(migration, /image\/webp/);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\].*auth\.uid/s);
  assert.match(migration, /p\.role IN \('guide', 'agency'\)/);
  assert.match(migration, /FOR DELETE[\s\S]*profile-gallery/);
});

test('automatic usernames are regenerated from names without numeric handles', async () => {
  const migration = await source('../supabase/migrations/20260909212237_human_readable_usernames_and_profile_gallery_storage.sql');
  assert.match(migration, /regexp_replace\(coalesce\(NEW\.full_name/);
  assert.match(migration, /\[\^\[:alpha:\]_\]\+/);
  assert.match(migration, /username ~ '\[0-9\]'/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key/);
});
