import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('booking deposit is configured at 15 percent without rewriting active or settled attempts', async () => {
  const sql = await source('../supabase/migrations/20260910160000_payment_chat_unlock_15pct_deposit.sql');

  assert.match(sql, /booking_deposit_percentage/);
  assert.match(sql, /'0\.15'::jsonb/);
  assert.match(sql, /deposit_percentage = 0\.15/);
  assert.match(sql, /deposit_amount = round\(b\.price \* 0\.15, 2\)/);
  assert.match(sql, /p\.status IN \('pending', 'processing', 'paid', 'refunded'\)/);
});

test('direct message RLS requires a securely released paid booking', async () => {
  const sql = await source('../supabase/migrations/20260910160000_payment_chat_unlock_15pct_deposit.sql');

  assert.match(sql, /current_user_has_released_booking/);
  assert.match(sql, /b\.contact_released IS TRUE/);
  assert.match(sql, /b\.payment_status IN \('deposit_paid', 'paid'\)/);
  assert.match(sql, /CREATE POLICY messages_authenticated_select/);
  assert.match(sql, /CREATE POLICY messages_authenticated_insert/);
  assert.match(sql, /CREATE POLICY messages_authenticated_update/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.can_chat_with_user/);
  assert.doesNotMatch(sql, /recipient\.is_public IS TRUE/);
  assert.doesNotMatch(sql, /tr\.selected_guide_id = \(SELECT auth\.uid\(\)\)/);
});

test('traveler request surface exposes the booking payment gate and unlocks chat only from released payment state', async () => {
  const requests = await source('../src/pages/profile/RequestsPage.jsx');
  const gate = await source('../src/components/profile/RequestPaymentGate.jsx');

  assert.match(requests, /RequestPaymentGate/);
  assert.match(requests, /requestId=\{r\.id\}/);
  assert.match(gate, /redirectToDepositCheckout\(booking\.id\)/);
  assert.match(gate, /booking\.contact_released === true/);
  assert.match(gate, /\['deposit_paid', 'paid'\]\.includes\(paymentStatus\)/);
  assert.match(gate, /Pay 15% deposit/);
  assert.match(gate, /navigate\(`\/chat\/\$\{booking\.guide_id\}`\)/);
  assert.doesNotMatch(gate, /from\(['"]payments['"]\).*\.(insert|update|delete)/s);
  assert.doesNotMatch(gate, /from\(['"]bookings['"]\).*\.(insert|update|delete)/s);
});

test('provider booking surface exposes chat only after the same released paid state', async () => {
  const provider = await source('../src/components/dashboard/BookingsView.jsx');

  assert.match(provider, /booking\.contact_released === true/);
  assert.match(provider, /\['deposit_paid', 'paid'\]\.includes\(booking\.payment_status\)/);
  assert.match(provider, /navigate\(`\/chat\/\$\{booking\.tourist_id\}`\)/);
  assert.match(provider, /Chat with traveler/);
});

test('public guide and agency chat CTAs use the server paid-booking predicate', async () => {
  const [guide, agency] = await Promise.all([
    source('../src/pages/GuideDetails.jsx'),
    source('../src/pages/AgencyProfile.jsx'),
  ]);

  for (const profile of [guide, agency]) {
    assert.match(profile, /canChatWithUser\(id\)/);
    assert.match(profile, /disabled=\{!chatUnlocked\}/);
    assert.doesNotMatch(profile, /\.from\(['"]trip_requests['"]\)[\s\S]*selected_guide_id/);
  }
});

test('direct chat route fails closed before rendering the composer', async () => {
  const app = await source('../src/App.jsx');
  const guard = await source('../src/components/chat/PaidChatRoute.jsx');
  const api = await source('../src/api/chatAccess.js');

  assert.match(app, /<PaidChatRoute>/);
  assert.match(guard, /canChatWithUser\(guideId\)/);
  assert.match(guard, /Chat is still locked/);
  assert.match(guard, /15% deposit/);
  assert.match(api, /supabase\.rpc\('can_chat_with_user'/);
});

test('Stripe checkout returns to the canonical profile request payment surface', async () => {
  const checkout = await source('../api/payments/create-checkout.js');

  assert.match(checkout, /\/profile\/requests\?payment=success&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(checkout, /\/profile\/requests\?payment=cancelled/);
  assert.doesNotMatch(checkout, /\/my-trips\?payment=/);
});
