import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('traveler payment UI is fail-closed and starts deposit checkout from the booking id', async () => {
  const page = await source('../src/pages/MyTripRequests.jsx');

  assert.match(page, /fetchPaymentProviderConfig/);
  assert.match(page, /redirectToDepositCheckout\(booking\.id\)/);
  assert.match(page, /paymentConfig\?\.enabled/);
  assert.match(page, /supportedCurrencies/);
  assert.match(page, /Pay deposit/);
  assert.match(page, /Online deposit payment is not enabled yet/);
  assert.doesNotMatch(page, /from\(['"]payments['"]\).*\.(insert|update|delete)/s);
  assert.doesNotMatch(page, /from\(['"]bookings['"]\).*\.(insert|update|delete)/s);
});

test('traveler and provider contact UI remains behind the server release flag and secure RPC', async () => {
  const traveler = await source('../src/pages/MyTripRequests.jsx');
  const provider = await source('../src/components/dashboard/BookingsView.jsx');

  for (const ui of [traveler, provider]) {
    assert.match(ui, /contact_released/);
    assert.match(ui, /fetchReleasedBookingContact\(booking\.id\)/);
    assert.doesNotMatch(ui, /from\(['"]profiles['"]\)/);
  }
  assert.match(traveler, /Private contact details unlock only after the booking deposit is confirmed/);
  assert.match(provider, /Two-way chat and private traveler contact unlock only after the booking deposit is securely confirmed/);
});

test('payment return UX never treats redirect success as settlement authority', async () => {
  const page = await source('../src/pages/MyTripRequests.jsx');

  assert.match(page, /Payment submitted\. Waiting for secure provider confirmation/);
  assert.match(page, /\[500, 2000, 5000\]/);
  assert.doesNotMatch(page, /payment=success[\s\S]*(contact_released|status:\s*['"]paid)/);
});

test('payment cancellation guard blocks direct cancellation around active or settled money', async () => {
  const sql = await source('../supabase/migrations/20260907221115_phase3b_payment_cancellation_guard.sql');

  assert.match(sql, /v_booking\.payment_status IN \(\s*'deposit_pending',\s*'payment_pending',\s*'deposit_paid',\s*'paid',\s*'refunded'/s);
  assert.match(sql, /cannot be cancelled directly/);
  assert.match(sql, /IF v_booking\.status <> 'confirmed'/);
  assert.match(sql, /RETURN 'booking_not_payable'/);
});

test('provider payment history displays only server-backed payment rows', async () => {
  const view = await source('../src/components/dashboard/PaymentHistoryView.jsx');

  assert.match(view, /fetchMyPayments/);
  assert.match(view, /Server-recorded payment attempts and verified provider transactions only/);
  assert.doesNotMatch(view, /mock|fake transaction|sample payment/i);
});
