import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPackageTripRequestInitialData,
  normalizeProviderCode,
} from '../src/lib/packageTripRequest.js';

const migrationPath = '../supabase/migrations/20260912121822_package_booking_provider_codes.sql';
async function source(path) { return readFile(new URL(path, import.meta.url), 'utf8'); }

test('public provider codes accept only safe 6-12 digit identifiers', () => {
  assert.equal(normalizeProviderCode('100001'), 100001);
  assert.equal(normalizeProviderCode(' 100009 '), 100009);
  for (const invalid of ['', '12345', '1234567890123', '123-456', 'guide1', null]) {
    assert.equal(normalizeProviderCode(invalid), null);
  }
});

test('tour packages prefill the canonical editable trip request form', () => {
  const initial = buildPackageTripRequestInitialData({
    title: { en: 'Silk Road Highlights' },
    description: { en: 'A carefully paced itinerary through historic cities.' },
    cities: ['Tehran', 'Isfahan', 'Shiraz'],
    start_date: '2026-10-10',
    end_date: '2026-10-18',
    languages: ['English', 'Persian'],
    theme: ['Culture'],
    purpose: 'leisure',
    included: ['Private transport', 'Boutique hotel'],
    tour_type: 'private',
  }, 'en');

  assert.deepEqual(initial.destinations_array, ['Tehran', 'Isfahan', 'Shiraz']);
  assert.deepEqual(initial.guide_languages, ['English', 'Persian']);
  assert.equal(initial.start_date, '2026-10-10');
  assert.equal(initial.end_date, '2026-10-18');
  assert.equal(initial.needs_transport, true);
  assert.equal(initial.needs_accommodation, true);
  assert.equal(initial.tour_type, 'Private Tour');
  assert.ok(initial.requirements.length >= 80);
});

test('Tour Details exposes both package request paths and uses the canonical RPC', async () => {
  const [page, api, form] = await Promise.all([
    source('../src/pages/TourDetails.jsx'),
    source('../src/api/packageTripRequests.js'),
    source('../src/components/profile/TripRequestForm.jsx'),
  ]);

  assert.match(page, /Request Booking/);
  assert.match(page, /request_another_provider_cta/);
  assert.match(page, /request_provider_code_label/);
  assert.match(page, /inputMode="numeric"/);
  assert.match(page, /buildPackageTripRequestInitialData\(tour, lang\)/);
  assert.match(page, /<TripRequestForm/);
  assert.doesNotMatch(page, /\.from\('tour_requests'\)/);
  assert.match(api, /rpc\('begin_package_trip_request'/);
  assert.match(api, /p_provider_code: normalizedCode/);
  assert.match(form, /requestContext/);
});

test('provider codes are assigned server-side, immutable, unique, and exposed only through public profiles', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /CREATE SEQUENCE IF NOT EXISTS public\.provider_code_seq[\s\S]*START WITH 100001/);
  assert.match(sql, /UPDATE public\.profiles[\s\S]*role IN \('guide', 'agency'\)[\s\S]*provider_code IS NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS profiles_provider_code_key/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.assign_provider_code\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(sql, /NEW\.provider_code := OLD\.provider_code/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF role, provider_code ON public\.profiles/);
  assert.match(sql, /REVOKE ALL ON SEQUENCE public\.provider_code_seq[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_profiles[\s\S]*provider_code[\s\S]*FROM public\.profiles/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.public_profiles FROM anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_public_profiles\(\) TO anon, authenticated/);
});

test('package request RPC resolves a published package owner or exact eligible provider code', async () => {
  const sql = await source(migrationPath);
  const rpcStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.begin_package_trip_request');
  const rpcEnd = sql.indexOf('-- Consume the package-aware intent', rpcStart);
  const rpc = sql.slice(rpcStart, rpcEnd);

  assert.match(rpc, /v_user_id uuid := \(SELECT auth\.uid\(\)\)/);
  assert.match(rpc, /t\.status = 'published'/);
  assert.match(rpc, /p\.provider_code = p_provider_code/);
  assert.match(rpc, /p\.role IN \('guide', 'agency'\)[\s\S]*p\.is_approved IS TRUE[\s\S]*p\.is_rejected IS NOT TRUE[\s\S]*p\.is_published IS TRUE[\s\S]*p\.is_public IS TRUE[\s\S]*p\.accept_bookings IS TRUE/);
  assert.match(rpc, /p\.id = COALESCE\(v_tour\.owner_id, v_tour\.guide_id, v_tour\.agency_id\)/);
  assert.match(rpc, /v_tour\.is_platform_tour IS TRUE[\s\S]*p\.is_admin IS TRUE OR p\.role = 'admin'/);
  assert.match(rpc, /v_provider\.id = v_user_id[\s\S]*cannot send a package request to yourself/);
  assert.match(rpc, /INSERT INTO public\.direct_trip_request_intents[\s\S]*source_tour_id/);
  assert.match(rpc, /'provider_code', v_provider\.provider_code/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.begin_package_trip_request\(uuid, bigint\)[\s\S]*FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.begin_package_trip_request\(uuid, bigint\)[\s\S]*TO authenticated/);
});

test('package origin survives intent consumption and remains browser-immutable', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /ALTER TABLE public\.trip_requests[\s\S]*ADD COLUMN IF NOT EXISTS source_tour_id uuid/);
  assert.match(sql, /ALTER TABLE public\.direct_trip_request_intents[\s\S]*ADD COLUMN IF NOT EXISTS source_tour_id uuid/);
  assert.match(sql, /NEW\.source_tour_id := v_intent\.source_tour_id/);
  assert.match(sql, /NEW\.request_channel := 'direct_profile'/);
  assert.match(sql, /NEW\.direct_response_deadline := now\(\) \+ interval '12 hours'/);
  assert.match(sql, /NEW\.max_proposals := 1/);
  assert.match(sql, /NEW\.source_tour_id IS DISTINCT FROM OLD\.source_tour_id/);
});

test('only the exact package admin or eligible guide/agency can propose', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.trip_slot_actor_is_eligible/);
  assert.match(sql, /p_provider_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /r\.request_channel = 'direct_profile'[\s\S]*r\.direct_escalated_at IS NULL[\s\S]*r\.direct_provider_id = p_provider_id/);
  assert.match(sql, /t\.is_platform_tour IS TRUE OR t\.owner_id = p_provider_id/);
  assert.match(sql, /CREATE POLICY trip_slots_authenticated_insert[\s\S]*private\.trip_slot_actor_is_eligible\(trip_request_id, guide_id\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.validate_trip_slot_insert\(\)/);
  assert.match(sql, /This direct trip request is currently private to another provider/);
  assert.match(sql, /private\.marketplace_provider_is_eligible/);
  assert.match(sql, /This trip request was not dispatched to this provider/);
});

test('both traveler and recipient request pages show the originating package', async () => {
  const [traveler, recipient] = await Promise.all([
    source('../src/pages/profile/RequestDetailPage.jsx'),
    source('../src/pages/GuideRequestEmailPage.jsx'),
  ]);

  for (const page of [traveler, recipient]) {
    assert.match(page, /source_tour:tours!source_tour_id/);
    assert.match(page, /Based on a Tour Package/);
    assert.match(page, /\/tours\/\$\{/);
  }
  assert.match(recipient, /packageAdminAllowed/);
});
