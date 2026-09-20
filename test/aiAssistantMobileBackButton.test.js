import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('AI assistant shows a working back button on mobile and desktop', async () => {
  const page = await readFile(new URL('../src/pages/AIAssistant.jsx', import.meta.url), 'utf8');

  assert.match(page, /onClick=\{\(\) => navigate\(-1\)\}/);
  assert.match(page, /className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors shrink-0"/);
  assert.doesNotMatch(page, /hidden lg:flex h-9 w-9/);
});

test('AI assistant sidebar close button handles touch and click input', async () => {
  const page = await readFile(new URL('../src/pages/AIAssistant.jsx', import.meta.url), 'utf8');

  assert.match(page, /type="button"\s+onPointerDown=\{onClose\}\s+onClick=\{onClose\}/);
});
