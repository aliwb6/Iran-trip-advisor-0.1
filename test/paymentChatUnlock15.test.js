import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectContactSharing } from '../src/lib/contactSharing.js';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('chat authorization is request/proposal based while contact sharing remains payment based', async () => {
  const sql = await source('../supabase/migrations/20260915234000_pre_payment_chat_and_contact_release.sql');
  assert.match(sql, /current_user_has_chat_relationship/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.can_chat_with_user/);
  assert.match(sql, /current_user_can_message[\s\S]*current_user_has_chat_relationship/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.can_share_contact_with_user/);
  assert.match(sql, /current_user_has_released_booking/);
  assert.match(sql, /provider_contact_methods/);
  assert.match(sql, /get_booking_contact_methods/);
});

test('pre-payment contact detector blocks contacts without flagging ordinary dates and prices', () => {
  assert.deepEqual(detectContactSharing('Trip starts on 2026-09-15 and costs 1200 USD.'), []);
  assert.equal(detectContactSharing('Call me on ۰۹۱۲ ۱۲۳ ۴۵۶۷').includes('Phone number'), true);
  assert.equal(detectContactSharing('my telegram is @sample_user').includes('Telegram'), true);
  assert.equal(detectContactSharing('name@example.com').includes('Email'), true);
  assert.equal(detectContactSharing('https://example.com').includes('External link'), true);
});

test('chat route uses relationship guard instead of paid chat guard', async () => {
  const app = await source('../src/App.jsx');
  const guard = await source('../src/components/chat/ChatRelationshipRoute.jsx');
  assert.match(app, /ChatRelationshipRoute/);
  assert.doesNotMatch(app, /PaidChatRoute/);
  assert.match(guard, /Payment is not required to start chatting/);
});

test('chat has client contact validation and server contact permission refresh', async () => {
  const chat = await source('../src/pages/Chat.jsx');
  assert.match(chat, /detectContactSharing/);
  assert.match(chat, /canShareContactWithUser/);
  assert.match(chat, /conversations may be reviewed/);
  assert.match(chat, /Contact details are automatically blocked until booking payment is confirmed/);
});

test('payment gate unlocks contact details rather than chat', async () => {
  const gate = await source('../src/components/profile/RequestPaymentGate.jsx');
  assert.match(gate, /BookingContactCard/);
  assert.match(gate, /In-platform chat is available/);
  assert.match(gate, /navigate\(\x60\/chat\/\$\{booking\.guide_id\}\x60\)/);
  assert.doesNotMatch(gate, /Payment required to unlock chat/);
  assert.doesNotMatch(gate, /Two-way chat unlocks only after/);
});

test('provider booking surface keeps chat available and gates only contact card', async () => {
  const bookings = await source('../src/components/dashboard/BookingsView.jsx');
  assert.match(bookings, /navigate\(\x60\/chat\/\$\{booking\.tourist_id\}\x60\)/);
  assert.match(bookings, /BookingContactCard/);
  assert.match(bookings, /Private contact details remain locked until/);
  assert.doesNotMatch(bookings, /chatUnlocked/);
});

test('provider profile editor exposes private post-payment contact methods', async () => {
  const dashboard = await source('../src/pages/Dashboard.jsx');
  const card = await source('../src/components/dashboard/ProviderContactMethodsCard.jsx');
  assert.match(dashboard, /ProviderContactMethodsCard/);
  assert.match(card, /never shown on your public profile/);
  assert.match(card, /verified booking payment/);
});

test('public provider profiles no longer describe chat as a paid-only feature', async () => {
  const [guide, agency] = await Promise.all([
    source('../src/pages/GuideDetails.jsx'),
    source('../src/pages/AgencyProfile.jsx'),
  ]);
  for (const profile of [guide, agency]) {
    assert.doesNotMatch(profile, /Complete a paid booking to unlock chat/);
    assert.doesNotMatch(profile, /Available after booking payment/);
    assert.match(profile, /request or proposal relationship/i);
  }
});
