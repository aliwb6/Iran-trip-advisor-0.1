import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('Tour Packages keeps per-filter removal separate from Clear all', async () => {
  const filters = await source('../src/components/tours/TourFilters.jsx');
  const dropdown = await source('../src/components/ui/FilterDropdown.jsx');

  // Every Tour Packages filter updates only its own key while preserving the
  // rest of the active filter state.
  assert.match(filters, /onChange=\{\(value\) => onChange\(\{ \.\.\.filters, city: value \}\)\}/);
  assert.match(filters, /onChange=\{\(value\) => onChange\(\{ \.\.\.filters, theme: value \}\)\}/);
  assert.match(filters, /onChange=\{\(value\) => onChange\(\{ \.\.\.filters, duration: value \}\)\}/);
  assert.match(filters, /onChange=\{\(value\) => onChange\(\{ \.\.\.filters, price: value \}\)\}/);
  assert.match(filters, /onChange=\{\(value\) => onChange\(\{ \.\.\.filters, tourType: value \}\)\}/);

  // An active dropdown exposes its own clear button. Single-value filters go
  // back to their inactive key; multi-value filters clear only that array.
  assert.match(dropdown, /const clearCurrent = \(\) => \{[\s\S]*onChange\(multiple \? \[\] : inactiveKey\);[\s\S]*close\(\);[\s\S]*\};/);
  assert.match(dropdown, /\{isActive && \([\s\S]*onClick=\{clearCurrent\}[\s\S]*Clear \$\{label\} filter/);

  // Clear all remains a distinct action in Tour Packages.
  assert.match(filters, /const reset = \(\) => onChange\(\{[\s\S]*theme: 'all'[\s\S]*duration: 'all'[\s\S]*city: \[\][\s\S]*price: 'all'[\s\S]*tourType: 'all'/);
  assert.match(filters, /onClick=\{reset\}/);
});

test('multi-city Tour Packages selections can remove one selected destination without clearing the others', async () => {
  const dropdown = await source('../src/components/ui/FilterDropdown.jsx');

  assert.match(dropdown, /onChange\(checked[\s\S]*\? selectedValues\.filter\(item => item !== option\.key\)[\s\S]*: \[\.\.\.selectedValues, option\.key\]\);/);
});
