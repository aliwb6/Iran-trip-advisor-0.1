import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  supabaseServiceHeaders,
  toMinorUnits,
  verifyStripeSignature,
} from '../server/payments.js';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('payment migration keeps provider mutations server-role only and idempotent', async () => {
  const sql = await source('../supabase/migrations/20260907220102_phase3b_stripe_payment_lifecycle.sql');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.payment_provider_events/);
  assert.match(sql, /UNIQUE \(provider, event_id\)/);
  assert.match(sql, /idx_payments_one_active_attempt_per_type/);
  assert.match(sql, /FUNCTION public\.create_booking_payment_attempt/);
  assert.match(sql, /FUNCTION public\.process_payment_provider_event/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_booking_payment_attempt[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_booking_payment_attempt[\s\S]*TO service_role/);
  assert.match(sql, /ON CONFLICT \(provider, event_id\) DO NOTHING/);
});

test('contact release happens only in verified paid provider event processing', async () => {
  const sql = await source('../supabase/migrations/20260907220102_phase3b_stripe_payment_lifecycle.sql');
  const processor = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.process_payment_provider_event'));

  assert.match(processor, /p_provider_payment_status = 'paid'/);
  assert.match(processor, /SET payment_status = v_new_booking_status,\s*contact_released = true/s);
  const attempt = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION public.create_booking_payment_attempt'),
    sql.indexOf('CREATE OR REPLACE FUNCTION public.attach_payment_provider_session')
  );
  assert.doesNotMatch(attempt, /contact_released\s*=\s*true/);
});

test('client checkout sends booking identity only, never an authoritative amount', async () => {
  const client = await source('../src/api/payments.js');

  assert.match(client, /bookingId/);
  assert.match(client, /paymentType:\s*'deposit'/);
  assert.doesNotMatch(client, /body:\s*JSON\.stringify\([^)]*(amount|commission|deposit_amount|balance_due)/s);
  assert.doesNotMatch(client, /from\(['"]payments['"]\).*\.(insert|update|delete)/s);
  assert.doesNotMatch(client, /from\(['"]bookings['"]\).*\.(insert|update|delete)/s);
});

test('checkout endpoint authenticates Supabase session and derives amount from server attempt', async () => {
  const endpoint = await source('../api/payments/create-checkout.js');

  assert.match(endpoint, /getAuthenticatedUser\(request, env\)/);
  assert.match(endpoint, /create_booking_payment_attempt/);
  assert.match(endpoint, /toMinorUnits\(attempt\.amount, currency\)/);
  assert.match(endpoint, /attach_payment_provider_session/);
  assert.doesNotMatch(endpoint, /body\.amount|body\.deposit_amount|body\.total_amount/);
});

test('Stripe webhook requires raw-body signature verification before service-role processing', async () => {
  const webhook = await source('../api/payments/stripe-webhook.js');

  assert.match(webhook, /bodyParser:\s*false/);
  assert.match(webhook, /verifyStripeSignature\(rawBody, signature, env\.stripeWebhookSecret\)/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhook, /checkout\.session\.expired/);
  assert.match(webhook, /process_payment_provider_event/);
  assert.match(webhook, /booking_not_payable/);
});

test('current Supabase secret keys use apikey only while legacy service-role JWT keeps bearer auth', () => {
  const modern = supabaseServiceHeaders('sb_secret_example');
  assert.equal(modern.apikey, 'sb_secret_example');
  assert.equal('Authorization' in modern, false);

  const legacy = supabaseServiceHeaders('eyJlegacy-service-role-jwt');
  assert.equal(legacy.apikey, 'eyJlegacy-service-role-jwt');
  assert.equal(legacy.Authorization, 'Bearer eyJlegacy-service-role-jwt');
});

test('minor-unit conversion handles two, zero, and three decimal currencies', () => {
  assert.equal(toMinorUnits(12.34, 'usd'), 1234);
  assert.equal(toMinorUnits(1234, 'jpy'), 1234);
  assert.equal(toMinorUnits(1.234, 'kwd'), 1234);
});

test('Stripe signature helper validates the signed raw body and freshness', () => {
  const body = Buffer.from('{"id":"evt_test"}', 'utf8');
  const secret = 'whsec_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${body.toString('utf8')}`)
    .digest('hex');

  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${digest}`, secret), true);
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${'0'.repeat(64)}`, secret), false);
  assert.equal(verifyStripeSignature(body, `t=${timestamp - 1000},v1=${digest}`, secret), false);
});
