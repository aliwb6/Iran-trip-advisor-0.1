import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('proposal rounds preserve history while allowing one provider proposal per round', async () => {
  const migration = await source('../supabase/migrations/20260907135720_phase2_proposal_rounds_and_rebroadcast.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS proposal_round integer NOT NULL DEFAULT 1/);
  assert.match(migration, /UNIQUE \(trip_request_id, guide_id, proposal_round\)/);
  assert.match(migration, /proposal_round = proposal_round \+ 1/);
  assert.match(migration, /NEW\.proposal_round := v_request\.proposal_round/);
  assert.match(migration, /s\.proposal_round = v_request\.proposal_round/);
});

test('available jobs exclude only a guide application in the current proposal round', async () => {
  const api = await source('../src/api/tripRequests.js');
  assert.match(api, /select\('trip_request_id, proposal_round'\)/);
  assert.match(api, /currentRoundApplications/);
  assert.match(api, /trip\.proposal_round/);
  assert.doesNotMatch(api, /one-proposal-ever|unique\s*\(trip_request_id, guide_id\)/i);
});

test('guide dashboard duplicate checks and accepted requests are current-round aware', async () => {
  const flow = await source('../src/api/tourRequestFlow.js');
  assert.match(flow, /select\('proposal_round'\)/);
  assert.match(flow, /\.eq\('proposal_round', proposalRound\)/);
  assert.match(flow, /request round/);
  assert.match(flow, /proposal_round: Math\.max\(1, Number\(request\.proposal_round\) \|\| 1\)/);
});

test('proposal modal renders request max_proposals instead of a hardcoded closing cap', async () => {
  const modal = await source('../src/components/dashboard/SubmitProposalModal.jsx');
  assert.match(modal, /const maxProposals = Math\.max\(1, Number\(request\?\.max_proposals\) \|\| 5\)/);
  assert.match(modal, /Request closes when \{maxProposals\} guide/);
  assert.doesNotMatch(modal, /Request closes when 5 guides apply/);
});

test('selection, rejection and finalization operate only on the current round', async () => {
  const migration = await source('../supabase/migrations/20260907135720_phase2_proposal_rounds_and_rebroadcast.sql');
  assert.match(migration, /s\.proposal_round = r\.proposal_round/);
  assert.match(migration, /proposal_round = v_request\.proposal_round/);
  assert.match(migration, /proposal_round = v_round/);
});
