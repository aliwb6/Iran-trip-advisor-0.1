import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPackageProposalPrefill,
  getPackageRequestKind,
} from '../src/lib/packageTripRequest.js';

const migrationPath = '../supabase/migrations/20260912140000_package_request_response_modes.sql';
const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('package proposal prefill retains editable package information', () => {
  const prefill = buildPackageProposalPrefill({
    request_kind: 'package_booking',
    source_tour: {
      price: 540,
      itinerary: 'Day 1: Tehran\nDay 2: Isfahan',
      included: ['Private transport', 'Hotel'],
      not_included: ['International flights'],
    },
  });

  assert.equal(prefill.price, '540');
  assert.match(prefill.itinerary, /Day 1/);
  assert.deepEqual(prefill.included, ['Private transport', 'Hotel']);
  assert.deepEqual(prefill.excluded, ['International flights']);
  assert.match(prefill.message, /booking request/i);
  assert.equal(getPackageRequestKind({ request_kind: 'package_private' }), 'package_private');
});

test('package response migration makes private package requests server-owned and non-escalating', async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'general'/);
  assert.match(sql, /v_kind text := CASE WHEN p_provider_code IS NULL THEN 'package_booking' ELSE 'package_private' END/);
  assert.match(sql, /NEW\.direct_response_deadline := CASE[\s\S]*WHEN v_intent\.request_kind IN \('package_booking', 'package_private'\) THEN NULL/);
  assert.match(sql, /NEW\.request_kind := v_intent\.request_kind/);
  assert.match(sql, /NEW\.request_kind IS DISTINCT FROM OLD\.request_kind/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.decline_package_trip_request/);
  assert.match(sql, /v_request\.direct_provider_id <> \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /'package_request_declined'/);
});

test('provider surfaces distinguish both package response modes and reuse the proposal form', async () => {
  const [dashboard, modal, detail] = await Promise.all([
    source('../src/components/dashboard/GuideRequestsView.jsx'),
    source('../src/components/dashboard/SubmitProposalModal.jsx'),
    source('../src/pages/GuideRequestEmailPage.jsx'),
  ]);
  for (const page of [dashboard, modal, detail]) assert.match(page, /getPackageRequestKind/);
  assert.match(modal, /buildPackageProposalPrefill/);
  assert.match(dashboard, /Confirm & Send Offer/);
  assert.match(dashboard, /declinePackageTripRequest/);
});
