import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { normalizeExternalImageUrl } from '../src/lib/externalImageUrl.js';

test('external image URL validation accepts and normalizes HTTPS URLs', () => {
  assert.equal(
    normalizeExternalImageUrl('  https://images.example.com/tour photo.jpg?size=large  '),
    'https://images.example.com/tour%20photo.jpg?size=large',
  );
});

test('external image URL validation rejects malformed, unsafe-scheme, and credential-bearing URLs', () => {
  assert.throws(() => normalizeExternalImageUrl('not a url'), /valid image URL/i);
  assert.throws(() => normalizeExternalImageUrl('javascript:alert(1)'), /HTTP or HTTPS/i);
  assert.throws(() => normalizeExternalImageUrl('https://user:secret@images.example.com/photo.jpg'), /credentials/i);
});

test('TourForm stores validated URLs without a mandatory image preflight', async () => {
  const source = await readFile(new URL('../src/components/dashboard/TourForm.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /new\s+Image\s*\(/);
  assert.match(source, /const normalizedUrl = normalizeExternalImageUrl\(mainImageUrlDraft\)/);
  assert.match(source, /setImageUrl\(normalizedUrl\)/);
  assert.match(source, /image_url:\s+imageUrl/);
  assert.match(source, /normalizedUrl = normalizeExternalImageUrl\(pasteUrl\)/);
  assert.match(source, /setGalleryUrls\(prev => \[\.\.\.prev, normalizedUrl\]\)/);
  assert.match(source, /onError=\{\(\) => setMainPreviewError\(true\)\}/);
  assert.match(source, /setMainImageUrlDraft\(''\)/);
  assert.match(source, /setPasteUrl\(''\)/);
});
