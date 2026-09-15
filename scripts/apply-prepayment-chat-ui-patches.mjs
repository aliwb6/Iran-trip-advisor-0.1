import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, from, to, label) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(from)) {
    throw new Error(`Missing patch anchor for ${label} in ${path}`);
  }
  const next = source.replace(from, to);
  await writeFile(path, next, 'utf8');
  console.log(`patched ${label}: ${path}`);
}

await replaceExact(
  'src/App.jsx',
  "import PaidChatRoute from '@/components/chat/PaidChatRoute';",
  "import ChatRelationshipRoute from '@/components/chat/ChatRelationshipRoute';",
  'chat route import',
);
await replaceExact(
  'src/App.jsx',
  `<PaidChatRoute>\n                <PublicStandaloneShell><Chat /></PublicStandaloneShell>\n              </PaidChatRoute>`,
  `<ChatRelationshipRoute>\n                <PublicStandaloneShell><Chat /></PublicStandaloneShell>\n              </ChatRelationshipRoute>`,
  'chat route guard',
);

await replaceExact(
  'src/pages/Dashboard.jsx',
  "import PaymentHistoryView from '@/components/dashboard/PaymentHistoryView';",
  "import PaymentHistoryView from '@/components/dashboard/PaymentHistoryView';\nimport ProviderContactMethodsCard from '@/components/dashboard/ProviderContactMethodsCard';",
  'provider contact card import',
);
await replaceExact(
  'src/pages/Dashboard.jsx',
  `        {/* Service cities */}`,
  `        {isGuideOrAgencyProfile && (\n          <ProviderContactMethodsCard\n            providerId={userId}\n            profile={{ ...profile, phone: form.phone }}\n          />\n        )}\n\n        {/* Service cities */}`,
  'provider contact card placement',
);

for (const path of ['src/pages/GuideDetails.jsx', 'src/pages/AgencyProfile.jsx']) {
  await replaceExact(
    path,
    `        // Keep the profile CTA on the exact same server-side paid-booking\n        // predicate used by the chat route and message RLS. Authorization\n        // failures must fail closed without making the public profile unusable.`,
    `        // Chat access follows the server-side request/proposal relationship\n        // predicate. Payment is intentionally not required to start messaging.\n        // Authorization failures fail closed without breaking the public profile.`,
    'profile chat authorization comment',
  );
}

await replaceExact(
  'src/pages/GuideDetails.jsx',
  `      toast(lang === 'fa' ? 'برای چت، ابتدا یک تور پرداخت‌شده رزرو کنید.' : lang === 'ar' ? 'للدردشة، أكمل حجزاً مدفوعاً أولاً.' : 'Complete a paid booking to unlock chat.');`,
  `      toast(lang === 'fa' ? 'برای شروع چت ابتدا یک درخواست یا پروپوزال فعال با این راهنما داشته باشید.' : lang === 'ar' ? 'لبدء المحادثة يجب أن يكون لديك طلب أو عرض نشط مع هذا المرشد.' : 'Start a request or proposal relationship with this guide to open chat.');`,
  'guide chat unavailable copy',
);
await replaceExact(
  'src/pages/GuideDetails.jsx',
  `title={chatUnlocked ? '' : (lang === 'fa' ? 'پس از پرداخت تور در دسترس است' : lang === 'ar' ? 'متاح بعد الدفع' : 'Available after booking payment')}`,
  `title={chatUnlocked ? '' : (lang === 'fa' ? 'پس از ایجاد درخواست یا پروپوزال فعال می‌شود' : lang === 'ar' ? 'متاح بعد إنشاء طلب أو عرض' : 'Available after a request or proposal relationship exists')}`,
  'guide chat CTA title',
);

await replaceExact(
  'src/pages/AgencyProfile.jsx',
  `      toast(lang === 'fa' ? 'برای چت، ابتدا یک تور پرداخت‌شده رزرو کنید.' : 'Complete a paid booking to unlock chat.');`,
  `      toast(lang === 'fa' ? 'برای شروع چت ابتدا یک درخواست یا پروپوزال فعال با این آژانس داشته باشید.' : 'Start a request or proposal relationship with this agency to open chat.');`,
  'agency chat unavailable copy',
);
await replaceExact(
  'src/pages/AgencyProfile.jsx',
  `title={chatUnlocked ? '' : (lang === 'fa' ? 'پس از پرداخت تور در دسترس است' : 'Available after booking payment')}`,
  `title={chatUnlocked ? '' : (lang === 'fa' ? 'پس از ایجاد درخواست یا پروپوزال فعال می‌شود' : 'Available after a request or proposal relationship exists')}`,
  'agency chat CTA title',
);

const testSource = `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectContactSharing } from '../src/lib/contactSharing.js';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('chat authorization is request/proposal based while contact sharing remains payment based', async () => {
  const sql = await source('../supabase/migrations/20260915234000_pre_payment_chat_and_contact_release.sql');
  assert.match(sql, /current_user_has_chat_relationship/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\\.can_chat_with_user/);
  assert.match(sql, /current_user_can_message[\\s\\S]*current_user_has_chat_relationship/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\\.can_share_contact_with_user/);
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
  assert.match(gate, /navigate\\(\\x60\\/chat\\/\\$\\{booking\\.guide_id\\}\\x60\\)/);
  assert.doesNotMatch(gate, /Payment required to unlock chat/);
  assert.doesNotMatch(gate, /Two-way chat unlocks only after/);
});

test('provider booking surface keeps chat available and gates only contact card', async () => {
  const bookings = await source('../src/components/dashboard/BookingsView.jsx');
  assert.match(bookings, /navigate\\(\\x60\\/chat\\/\\$\\{booking\\.tourist_id\\}\\x60\\)/);
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
`;
await writeFile('test/paymentChatUnlock15.test.js', testSource, 'utf8');

console.log('pre-payment chat codemod complete');
