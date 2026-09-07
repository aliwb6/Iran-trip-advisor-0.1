import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('guide confirmation transitions confirmed requests to booked', async () => {
  const migration = await source('../supabase/migrations/20260907143549_phase2_post_selection_lifecycle.sql');
  assert.match(migration, /IF v_request\.status <> 'confirmed'/);
  assert.match(migration, /v_request\.selected_guide_id <> \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /SET status = 'finalized'/);
  assert.match(migration, /SET status = 'booked'/);
  assert.match(migration, /'trip_booked'/);
});

test('traveler completion is restricted to booked trips after their end date', async () => {
  const migration = await source('../supabase/migrations/20260907143549_phase2_post_selection_lifecycle.sql');
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.complete_trip_request\(request_id uuid\)/);
  assert.match(migration, /v_request\.user_id <> \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /IF v_request\.status <> 'booked'/);
  assert.match(migration, /v_request\.end_date > CURRENT_DATE/);
  assert.match(migration, /SET status = 'completed'/);
});

test('traveler cancellation closes current lifecycle slots and marks request cancelled', async () => {
  const migration = await source('../supabase/migrations/20260907144304_phase2_cancelled_booking_slot_closure.sql');
  assert.match(migration, /Only the traveler who created this request can cancel it/);
  assert.match(migration, /status IN \('accepted','chatting','selected','finalized'\)/);
  assert.match(migration, /SET status = 'closed'/);
  assert.match(migration, /SET status = 'cancelled'/);
  assert.match(migration, /'request_cancelled'/);
});

test('browser lifecycle mutations are protected by database triggers', async () => {
  const migration = await source('../supabase/migrations/20260907143549_phase2_post_selection_lifecycle.sql');
  assert.match(migration, /trg_protect_trip_request_lifecycle_fields/);
  assert.match(migration, /trg_protect_trip_slot_lifecycle_fields/);
  assert.match(migration, /trg_protect_trip_slot_delete/);
  assert.match(migration, /Lifecycle fields must be changed through the canonical trip request RPCs/);
});

test('lifecycle RPCs are authenticated-only at the database grant layer', async () => {
  const migration = await source('../supabase/migrations/20260907144442_phase2_lifecycle_rpc_execute_hardening.sql');
  assert.match(migration, /FROM PUBLIC, anon/);
  assert.match(migration, /TO authenticated/);
});

test('frontend exposes the canonical guide and traveler lifecycle actions', async () => {
  const guideFlow = await source('../src/api/tourRequestFlow.js');
  const tripApi = await source('../src/api/tripRequests.js');
  const guideView = await source('../src/components/dashboard/GuideRequestsView.jsx');
  const travelerView = await source('../src/pages/MyTripRequests.jsx');

  assert.match(guideFlow, /guideConfirmBooking/);
  assert.match(guideFlow, /rpc\('finalize_selected_trip_slot'/);
  assert.match(guideView, /Confirm booking/);

  assert.match(tripApi, /completeTripRequest/);
  assert.match(tripApi, /rpc\('complete_trip_request'/);
  assert.match(tripApi, /cancelTripRequest/);
  assert.match(tripApi, /rpc\('cancel_trip_request'/);
  assert.match(travelerView, /Mark trip as completed/);
  assert.match(travelerView, /Cancel trip request/);
});
