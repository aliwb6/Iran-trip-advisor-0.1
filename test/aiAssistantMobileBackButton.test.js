import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('AI assistant keeps the back action in the header with an accessible touch target', async () => {
  const page = await readFile(new URL('../src/pages/AIAssistant.jsx', import.meta.url), 'utf8');

  assert.match(page, /onClick=\{\(\) => navigate\(-1\)\}/);
  assert.match(page, /className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-95 shrink-0"/);
  assert.doesNotMatch(page, /hidden lg:flex h-9 w-9/);
});

test('AI assistant keeps mobile recommendations out of the message composer', async () => {
  const page = await readFile(new URL('../src/pages/AIAssistant.jsx', import.meta.url), 'utf8');

  assert.match(page, /Mobile recommendations live in the header, never over the composer/);
  assert.match(page, /lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl/);
  assert.doesNotMatch(page, /fixed bottom-24 end-4/);
});

test('AI assistant sidebar close button handles touch and click input', async () => {
  const page = await readFile(new URL('../src/pages/AIAssistant.jsx', import.meta.url), 'utf8');

  assert.match(page, /type="button"\s+onPointerDown=\{onClose\}\s+onClick=\{onClose\}/);
});
