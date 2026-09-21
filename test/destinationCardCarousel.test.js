import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../src/components/SpotlightDestinations.jsx', import.meta.url);

test('homepage destinations use the interactive card carousel without losing city routes', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /animate=\{\{ x: -activeIndex \* layout\.slideWidth \}\}/);
  assert.match(source, /visibleDistance \* 16/);
  assert.match(source, /isActive \? 1\.045/);
  assert.match(source, /drag=\{destinations\.length > 1 \? 'x' : false\}/);
  assert.match(source, /if \(index === activeIndex\) return/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /to=\{`\/destinations\/\$\{city\.slug\}`\}/);
  assert.match(source, /useReducedMotion/);
  assert.match(source, /aria-roledescription="carousel"/);
});
