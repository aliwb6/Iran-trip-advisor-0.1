import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('a selected proposal creates the locked booking snapshot before provider confirmation', async () => {
  const sql = await source('../supabase/migrations/20260915120000_enable_deposit_on_provider_selection.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.create_selected_trip_booking/);
  assert.match(sql, /PERFORM private\.create_selected_trip_booking\(v_request_id\)/);
  assert.match(sql, /'guide_selected'/);
  assert.match(sql, /UPDATE public\.trip_requests SET status = 'booked'/);
});

test('traveler surfaces make the deposit available immediately after selection', async () => {
  const [gate, requests, proposals] = await Promise.all([
    source('../src/components/profile/RequestPaymentGate.jsx'),
    source('../src/pages/MyTripRequests.jsx'),
    source('../src/components/profile/ProposalsPanel.jsx'),
  ]);
  assert.doesNotMatch(gate, /must confirm the booking first/);
  assert.match(requests, /\['confirmed', 'booked'\]\.includes\(trip\.status\)/);
  assert.match(proposals, /Your 15% deposit is ready to pay/);
});
