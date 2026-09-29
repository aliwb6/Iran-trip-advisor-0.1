import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = () => readFile(new URL('../src/pages/CityPage.jsx', import.meta.url), 'utf8');

test('city guide cards open provider profiles instead of direct chat', async () => {
  const cityPage = await source();

  assert.match(cityPage, /guide\.role === 'agency' \? `\/agencies\/\$\{guide\.id\}` : `\/guides\/\$\{guide\.id\}`/);
  assert.match(cityPage, /View Guide Profile/);
  assert.doesNotMatch(cityPage, /to=\{`\/chat\/\$\{guide\.id\}`\}/);
});
