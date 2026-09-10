import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/components/profile/ProposalsPanel.jsx', import.meta.url),
  'utf8',
);

test('traveler proposals are queried oldest-first with null-safe deterministic ordering', () => {
  const queryStart = source.indexOf(".from('trip_slots')");
  const queryEnd = source.indexOf('if (error) throw error;', queryStart);
  const query = source.slice(queryStart, queryEnd);

  assert.match(query, /\.eq\('trip_request_id', requestId\)/);
  assert.match(query, /\.eq\('proposal_round', proposalRound\)/);
  assert.match(query, /\.order\('accepted_at', \{ ascending: true, nullsFirst: false \}\)/);
  assert.match(query, /\.order\('id', \{ ascending: true \}\)/);
  assert.ok(
    query.indexOf(".order('accepted_at'") < query.indexOf(".order('id'"),
    'accepted_at must remain the primary ordering field',
  );
  assert.doesNotMatch(query, /\.order\('accepted_at', \{ ascending: false/);
});

test('rendered proposal numbers follow the chronologically ordered array', () => {
  assert.match(source, /slots\.map\(\(slot, index\) =>/);
  assert.match(source, /`Proposal \$\{index \+ 1\}`/);
  assert.doesNotMatch(source, /slots\.reverse|\.toReversed\(\)/);
});
