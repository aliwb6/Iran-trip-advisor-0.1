import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('public tours no longer evaluate a PUBLIC policy that reads raw profiles', async () => {
  const sql = await source('../supabase/migrations/20260907224321_phase3c_public_tours_reviews_privacy_compatibility.sql');

  assert.match(sql, /DROP POLICY IF EXISTS "Owner manages own tours" ON public\.tours/);
  assert.match(sql, /CREATE POLICY "Authenticated owners manage own tours"/);
  assert.match(sql, /TO authenticated/);
  assert.match(sql, /owner_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /public\.current_user_is_admin\(\)/);
});

test('public profile reviews use a safe SECURITY DEFINER RPC instead of a profiles embed', async () => {
  const sql = await source('../supabase/migrations/20260907224321_phase3c_public_tours_reviews_privacy_compatibility.sql');
  const reviews = await source('../src/lib/reviews.js');

  assert.match(sql, /FUNCTION public\.get_public_profile_reviews\(p_profile_id uuid\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /r\.status = 'approved'/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_public_profile_reviews\(uuid\) TO anon, authenticated/);

  assert.match(reviews, /client\.rpc\('get_public_profile_reviews'/);
  assert.doesNotMatch(reviews, /reviewer:profiles!/);
  assert.doesNotMatch(reviews, /\.from\('profiles'\)/);
});

test('review submission target validation no longer requires caller visibility of another raw profile', async () => {
  const sql = await source('../supabase/migrations/20260907224321_phase3c_public_tours_reviews_privacy_compatibility.sql');

  assert.match(sql, /FUNCTION public\.is_reviewable_profile_target\(p_profile_id uuid\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /profile_id IS NULL OR public\.is_reviewable_profile_target\(profile_id\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_reviewable_profile_target\(uuid\) TO authenticated/);
});
