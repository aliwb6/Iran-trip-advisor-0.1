import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) throw new Error('Test output path is required.');

const output = await readFile(path, 'utf8');
const failures = [...output.matchAll(/^not ok \d+ - (.+)$/gm)]
  .map(match => match[1].trim())
  .sort();

const knownPreExistingFailures = [
  'guide-facing APIs hide overdue requests and surface expiration clearly',
  'live trip request code does not query or write legacy lifecycle columns',
  'public license card contains no document access or private license fields',
].sort();

assert.deepEqual(
  failures,
  knownPreExistingFailures,
  `Full suite contains unexpected failures:\n${failures.join('\n')}`,
);

assert.match(output, /# tests 193/);
assert.match(output, /# fail 3/);

console.log('Full suite matches the known pre-existing 3-failure baseline; no new failure was introduced.');
