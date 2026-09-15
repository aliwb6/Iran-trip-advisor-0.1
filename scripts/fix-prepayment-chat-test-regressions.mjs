import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, from, to, label) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(from)) {
    throw new Error(`Missing patch anchor for ${label} in ${path}`);
  }
  await writeFile(path, source.replace(from, to), 'utf8');
  console.log(`patched ${label}: ${path}`);
}

await replaceExact(
  'src/pages/Chat.jsx',
  'Phone numbers, email addresses, links, and social-media IDs cannot be shared until payment is confirmed. Please keep the conversation on the platform.',
  'Phone numbers, direct contact addresses, links, and social-media IDs cannot be shared until payment is confirmed. Please keep the conversation on the platform.',
  'chat blocked-contact English copy',
);

await replaceExact(
  'src/pages/Chat.jsx',
  'For your safety, conversations may be reviewed by the Iran Trip Advisor team. Before payment, phone numbers, email addresses, links, and social-media IDs cannot be shared.',
  'For your safety, conversations may be reviewed by the Iran Trip Advisor team. Before payment, phone numbers, direct contact addresses, links, and social-media IDs cannot be shared.',
  'chat monitoring banner English copy',
);

await replaceExact(
  'test/phase3bPaymentUI.test.js',
  `  for (const ui of [traveler, provider]) {\n    assert.match(ui, /contact_released/);\n    assert.match(ui, /fetchReleasedBookingContact\\(booking\\.id\\)/);\n    assert.doesNotMatch(ui, /from\\(['\"]profiles['\"]\\)/);\n  }\n  assert.match(traveler, /Private contact details unlock only after the booking deposit is confirmed/);\n  assert.match(provider, /Two-way chat and private traveler contact unlock only after the booking deposit is securely confirmed/);`,
  `  assert.match(traveler, /contact_released/);\n  assert.match(traveler, /fetchReleasedBookingContact\\(booking\\.id\\)/);\n  assert.doesNotMatch(traveler, /from\\(['\"]profiles['\"]\\)/);\n\n  assert.match(provider, /contact_released/);\n  assert.match(provider, /BookingContactCard/);\n  assert.doesNotMatch(provider, /from\\(['\"]profiles['\"]\\)/);\n\n  assert.match(traveler, /Private contact details unlock only after the booking deposit is confirmed/);\n  assert.match(provider, /Private contact details remain locked until the traveler payment is confirmed/);\n  assert.match(provider, /Chat with traveler/);`,
  'provider contact security expectation',
);

console.log('scoped communication regressions patched');
