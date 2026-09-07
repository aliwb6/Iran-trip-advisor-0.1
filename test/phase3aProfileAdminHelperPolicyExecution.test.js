import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('authenticated profile RLS can execute the admin helper while anon stays denied', async () => {
  const sql = await source('../supabase/migrations/20260907215030_phase3a_profile_admin_helper_policy_execution.sql');

  assert.match(sql, /REVOKE ALL ON FUNCTION public\.current_user_is_admin\(\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.current_user_is_admin\(\) TO authenticated/);
});

test('admin profile policies depend on the helper that has authenticated execution', async () => {
  const primitives = await source('../supabase/migrations/20260907203714_phase3a_profile_privacy_primitives.sql');
  const fix = await source('../supabase/migrations/20260907215030_phase3a_profile_admin_helper_policy_execution.sql');

  assert.match(primitives, /CREATE POLICY "Admins can select profiles"[\s\S]*USING \(public\.current_user_is_admin\(\)\)/);
  assert.match(primitives, /CREATE POLICY "Admins can update profiles"[\s\S]*USING \(public\.current_user_is_admin\(\)\)/);
  assert.match(fix, /GRANT EXECUTE ON FUNCTION public\.current_user_is_admin\(\) TO authenticated/);
});
