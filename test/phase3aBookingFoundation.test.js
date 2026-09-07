import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

async function browserSource() {
  const root = new URL('../src/', import.meta.url);
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name, directory);
      if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, directory));
      else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) files.push(await readFile(url, 'utf8'));
    }
  }
  await walk(root);
  return files.join('\n');
}

test('recovered Phase 3A foundation enforces unique canonical bookings and read-only browser access', async () => {
  const migration = await source('../supabase/migrations/20260907200532_phase3a_booking_finance_foundation.sql');
  assert.match(migration, /bookings_request_id_key UNIQUE \(request_id\)/);
  assert.match(migration, /bookings_slot_id_key UNIQUE \(slot_id\)/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.bookings FROM anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.payments FROM anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.bookings TO authenticated/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.payments TO authenticated/);
});

test('finalization creates the booking and snapshots server-calculated financial terms', async () => {
  const migration = await source('../supabase/migrations/20260907200532_phase3a_booking_finance_foundation.sql');
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.finalize_selected_trip_slot\(request_id uuid\)/);
  assert.match(migration, /v_slot\.price\s*\* CASE WHEN v_slot\.price_type = 'per_person' THEN v_people ELSE 1 END\s*\* CASE WHEN v_slot\.price_period = 'per_day' THEN v_days ELSE 1 END/);
  assert.match(migration, /INSERT INTO public\.bookings/);
  assert.match(migration, /v_commission_amount := round\(v_total \* v_commission_rate, 2\)/);
  assert.match(migration, /v_deposit_amount := round\(v_total \* v_deposit_percentage, 2\)/);
  assert.match(migration, /WHERE b\.request_id = v_request_id\s+AND b\.guide_id = \(SELECT auth\.uid\(\)\)/);
});

test('financial hardening preserves booking history and canonical fields', async () => {
  const migration = await source('../supabase/migrations/20260907200618_phase3a_financial_integrity_hardening.sql');
  assert.match(migration, /ALTER COLUMN quoted_unit_price SET NOT NULL/);
  assert.match(migration, /ALTER COLUMN commission_rate SET NOT NULL/);
  assert.match(migration, /ALTER COLUMN deposit_percentage SET NOT NULL/);
  assert.match(migration, /FOREIGN KEY \(request_id\) REFERENCES public\.trip_requests\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /FOREIGN KEY \(slot_id\) REFERENCES public\.trip_slots\(id\) ON DELETE RESTRICT/);
});

test('browser source never writes bookings or payments directly', async () => {
  const sourceText = await browserSource();
  assert.doesNotMatch(sourceText, /from\(['"]bookings['"]\)[\s\S]{0,300}\.(?:insert|update|upsert|delete)\(/);
  assert.doesNotMatch(sourceText, /from\(['"]payments['"]\)[\s\S]{0,300}\.(?:insert|update|upsert|delete)\(/);
});

test('booking API is read-only and preserves authoritative financial snapshot values', async () => {
  const api = await source('../src/api/bookings.js');
  assert.match(api, /fetchMyBookings/);
  assert.match(api, /fetchBookingByRequestId/);
  assert.match(api, /fetchBookingById/);
  assert.match(api, /from\('bookings'\)[\s\S]{0,80}\.select\('\*'\)/);
  assert.match(api, /from\('payments'\)[\s\S]{0,80}\.select\('\*'\)/);
  assert.doesNotMatch(api, /\.(?:insert|update|upsert|delete)\(/);
  assert.match(api, /commission_amount/);
  assert.match(api, /deposit_amount/);
  assert.match(api, /guide_payout/);
});

test('guide finalization uses the RPC and refreshes request, slot, and booking reads', async () => {
  const flow = await source('../src/api/tourRequestFlow.js');
  const view = await source('../src/components/dashboard/GuideRequestsView.jsx');
  assert.match(flow, /rpc\('finalize_selected_trip_slot', \{\s*request_id: requestId/);
  assert.doesNotMatch(flow, /from\(['"]bookings['"]\)/);
  assert.match(view, /queryKey: \['trip_request', entry\.trip_request_id\]/);
  assert.match(view, /queryKey: \['trip_slots_proposals', entry\.trip_request_id\]/);
  assert.match(view, /queryKey: \['bookings'\]/);
});

test('booking surfaces use server snapshots and payment history contains no fake rows or actions', async () => {
  const bookings = await source('../src/components/dashboard/BookingsView.jsx');
  const payments = await source('../src/components/dashboard/PaymentHistoryView.jsx');
  const traveler = await source('../src/pages/MyTripRequests.jsx');
  assert.match(bookings, /booking\.price/);
  assert.match(bookings, /booking\.commission_amount/);
  assert.match(bookings, /booking\.deposit_amount/);
  assert.match(bookings, /booking\.guide_payout/);
  assert.match(traveler, /trip\.booking\.price/);
  assert.match(traveler, /trip\.booking\.deposit_amount/);
  assert.match(payments, /fetchMyPayments/);
  assert.match(payments, /No payment transactions have been recorded/);
  assert.doesNotMatch(payments, /mock|fake|mark as paid|pay now/i);
});

test('Phase 2 lifecycle RPC contract remains present', async () => {
  const flow = await source('../src/api/tourRequestFlow.js');
  const trips = await source('../src/api/tripRequests.js');
  const proposals = await source('../src/components/profile/ProposalsPanel.jsx');
  assert.match(flow, /rpc\('select_trip_guide'/);
  assert.match(proposals, /rpc\('reject_trip_proposal'/);
  assert.match(trips, /rpc\('complete_trip_request'/);
  assert.match(trips, /rpc\('cancel_trip_request'/);
  assert.match(trips, /rpc\('rebroadcast_trip_request'/);
});
