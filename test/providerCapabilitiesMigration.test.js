import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_SPECIAL_ABILITY_LENGTH,
  addProviderAbility,
  normalizeProviderAbilities,
} from '../src/lib/providerCapabilities.js';

const migrationPath = '../supabase/migrations/20260909220505_provider_capabilities.sql';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('custom provider abilities are trimmed, bounded, and deduplicated case-insensitively', () => {
  assert.deepEqual(
    normalizeProviderAbilities(['  First Aid  ', '', 'first aid', 'Photography']),
    ['First Aid', 'Photography'],
  );
  assert.deepEqual(addProviderAbility(['First Aid'], ' first aid '), ['First Aid']);
  assert.equal(
    addProviderAbility([], 'x'.repeat(MAX_SPECIAL_ABILITY_LENGTH + 20))[0].length,
    MAX_SPECIAL_ABILITY_LENGTH,
  );
});

test('provider capabilities migration adds nullable fields and exposes only them through the hardened public contract', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /ADD COLUMN IF NOT EXISTS special_abilities text\[\]/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS has_vehicle boolean/);
  assert.doesNotMatch(sql, /has_vehicle boolean[^;]*DEFAULT\s+false/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_profiles\s+WITH \(security_invoker = true\)/);
  assert.match(sql, /pp\.special_abilities/);
  assert.match(sql, /pp\.has_vehicle/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_public_profiles\(\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.public_profiles FROM anon, authenticated/);
});

test('provider capabilities migration aligns completion and moderation without reclassifying existing profiles', async () => {
  const sql = await source(migrationPath);
  const completion = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION public.check_profile_completed()'),
    sql.indexOf('DROP TRIGGER IF EXISTS trg_profile_completed'),
  );
  const moderation = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION public.enforce_guide_profile_moderation()'),
    sql.indexOf("NOTIFY pgrst, 'reload schema'"),
  );

  for (const body of [completion, moderation]) {
    assert.match(body, /unnest\(NEW\.special_abilities\)/);
    assert.match(body, /NULLIF\(btrim\(ability\), ''\) IS NOT NULL/);
    assert.match(body, /NEW\.has_vehicle IS NOT NULL/);
  }
  assert.match(sql, /special_abilities, has_vehicle/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.profiles\s+SET\s+(?:is_approved|is_published|license_status|profile_completed)/i);
});

test('provider dashboard and public profile pages use the capability fields', async () => {
  const dashboard = await source('../src/pages/Dashboard.jsx');
  assert.match(dashboard, /specialAbilities:\s*normalizeProviderAbilities\(profile\?\.special_abilities\)/);
  assert.match(dashboard, /hasVehicle:\s*typeof profile\?\.has_vehicle === 'boolean'/);
  assert.match(dashboard, /special_abilities:\s*normalizeProviderAbilities\(specialAbilities\)/);
  assert.match(dashboard, /has_vehicle:\s*hasVehicle/);

  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx']) {
    const page = await source(path);
    assert.match(page, /special_abilities/);
    assert.match(page, /has_vehicle/);
    assert.match(page, /Special Abilities/);
    assert.match(page, /Vehicle available/);
  }
});
