import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('trip request API writes canonical trip_requests columns', async () => {
  const api = await source('../src/api/tripRequests.js');
  assert.match(api, /user_id:\s*travelerId/);
  assert.match(api, /start_date:\s*tripData\.dates\?\.start/);
  assert.match(api, /end_date:\s*tripData\.dates\?\.end/);
  assert.match(api, /goals:\s*tripData\.interests/);
  assert.match(api, /budget_tier:\s*tripData\.budget/);
  assert.match(api, /requirements:\s*tripData\.notes/);
  assert.match(api, /proposals_count:\s*0/);

  const insertStart = api.indexOf(".from('trip_requests')");
  const insertBlock = api.slice(insertStart, api.indexOf('.select()', insertStart));
  assert.doesNotMatch(insertBlock, /traveler_id|travel_dates|group_size|budget_range|slot_count|broadcast_count/);
});

test('trip request reads use canonical ownership and dynamic proposal counts', async () => {
  const api = await source('../src/api/tripRequests.js');
  assert.match(api, /\.eq\('user_id', travelerId\)/);
  assert.match(api, /Number\(trip\.proposals_count\) \|\| 0/);
  assert.match(api, /Number\(trip\.max_proposals\) \|\| 5/);
  assert.match(api, /trip\.proposals_count < trip\.max_proposals/);
  assert.doesNotMatch(api, /\.lt\('slot_count'/);
  assert.doesNotMatch(api, /\.eq\('traveler_id'/);
});

test('mutation helpers delegate to canonical authenticated RPCs', async () => {
  const api = await source('../src/api/tripRequests.js');
  assert.match(api, /rpc\('guide_reject_trip_slot'/);
  assert.match(api, /rpc\('finalize_selected_trip_slot'/);
  assert.match(api, /rpc\('rebroadcast_trip_request'/);
  assert.doesNotMatch(api, /from\('trip_slots'\)\s*\.update/);
  assert.doesNotMatch(api, /broadcast_count:\s*\(/);
});

test('MyTripRequests uses canonical dates, people, rebroadcast and proposal fields', async () => {
  const page = await source('../src/pages/MyTripRequests.jsx');
  assert.match(page, /trip\.start_date/);
  assert.match(page, /trip\.end_date/);
  assert.match(page, /trip\.rebroadcast_count/);
  assert.match(page, /trip\.proposals_count/);
  assert.match(page, /trip\.max_proposals/);
  assert.match(page, /trip\.adults/);
  assert.doesNotMatch(page, /travel_dates|group_size|slot_count|broadcast_count/);
  assert.doesNotMatch(page, /\/3 guide/);
});

test('FindJobs uses canonical filters and dynamic max_proposals', async () => {
  const page = await source('../src/pages/FindJobs.jsx');
  assert.match(page, /trip\.start_date/);
  assert.match(page, /trip\.end_date/);
  assert.match(page, /trip\.budget_tier/);
  assert.match(page, /trip\.goals/);
  assert.match(page, /trip\.proposals_count/);
  assert.match(page, /trip\.max_proposals/);
  assert.match(page, /trip\.requirements/);
  assert.doesNotMatch(page, /travel_dates|group_size|budget_range|slot_count/);
  assert.doesNotMatch(page, /Only 3 guides/);
});

test('Phase 2B migration mirrors the canonical RPC and profile columns', async () => {
  const migration = await source('../supabase/migrations/20260907133306_phase2_legacy_trip_request_reconciliation.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS budget_tier text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS rebroadcast_count integer NOT NULL DEFAULT 0/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.rebroadcast_trip_request\(request_id uuid\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.guide_reject_trip_slot\(request_id uuid\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.finalize_selected_trip_slot\(request_id uuid\)/);
});
