import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('public provider profiles display only the numeric Provider ID', async () => {
  for (const path of ['../src/pages/GuideDetails.jsx', '../src/pages/AgencyProfile.jsx']) {
    const page = await source(path);
    assert.match(page, /provider_code/);
    assert.doesNotMatch(page, /@\{(?:guide|agency)\.username\}/);
    assert.doesNotMatch(page, /clipboard\.writeText\((?:guide|agency)\.username\)/);
  }
});
