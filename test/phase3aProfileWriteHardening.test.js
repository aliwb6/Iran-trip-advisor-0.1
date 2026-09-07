import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('profile write hardening removes unrestricted authenticated inserts', async () => {
  const sql = await source('../supabase/migrations/20260907212125_phase3a_profile_write_hardening.sql');

  assert.match(sql, /DROP POLICY IF EXISTS "Allow insert for authenticated" ON public\.profiles/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.profiles FROM anon/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.profiles TO authenticated/);
  assert.match(sql, /WITH CHECK \(\(SELECT auth\.uid\(\)\) = id\)/);
  assert.doesNotMatch(sql, /WITH CHECK \(true\)/);
});

test('signup profile creation remains owner-bound', async () => {
  const signup = await source('../src/pages/Signup.jsx');
  assert.match(signup, /id:\s*data\.user\.id/);
  assert.match(signup, /from\('profiles'\)\.upsert/);
});

test('no frontend profile creation path targets another user or depends on the retired insert policy', async () => {
  const signup = await source('../src/pages/Signup.jsx');
  const register = await source('../src/pages/Register.jsx');

  assert.doesNotMatch(signup, /Allow insert for authenticated|WITH CHECK \(true\)/);
  assert.doesNotMatch(register, /from\('profiles'\)\.(?:insert|upsert)/);
});

test('register flow relies on server-side profile creation', async () => {
  const register = await source('../src/pages/Register.jsx');
  assert.match(register, /Profile row is created automatically by the handle_new_user DB trigger/);
  assert.doesNotMatch(register, /from\('profiles'\)\.(?:insert|upsert)/);
});
