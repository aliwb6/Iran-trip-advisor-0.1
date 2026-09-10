import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/components/profile/TripRequestForm.jsx', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

test('trip request requirements are mandatory with an 80-character minimum', () => {
  assert.match(source, /const REQUIREMENTS_MIN_LENGTH = 80;/);
  assert.match(source, /minLength=\{REQUIREMENTS_MIN_LENGTH\}/);
  assert.match(source, /trimmedRequirements\.length < REQUIREMENTS_MIN_LENGTH/);
  assert.doesNotMatch(source, /no_requirements/);
});

test('requirements are the final preference section', () => {
  const tourTypeIndex = source.indexOf('{/* Tour type */}');
  const requirementsIndex = source.indexOf('{/* Requirements — intentionally last');
  const stepTwoEndIndex = source.indexOf('// ── Main export', requirementsIndex);

  assert.ok(tourTypeIndex >= 0, 'Tour type section should exist');
  assert.ok(requirementsIndex > tourTypeIndex, 'Requirements should render after tour type');
  assert.ok(stepTwoEndIndex > requirementsIndex, 'Requirements should remain inside Step 2');
});
