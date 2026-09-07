import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('guide selection uses the atomic RPC and never directly updates trip_requests', async () => {
  const flow = await source('../src/api/tourRequestFlow.js');
  const proposals = await source('../src/components/profile/ProposalsPanel.jsx');
  const trips = await source('../src/pages/MyTripRequests.jsx');
  assert.match(flow, /rpc\('select_trip_guide', \{\s*request_id: requestId,\s*selected_guide_id: selectedGuideId,/);
  const selection = flow.slice(flow.indexOf('export async function touristSelectGuide'));
  assert.doesNotMatch(selection, /from\('trip_requests'\)\s*\.update/);
  assert.match(selection, /if \(error\) throw error/);
  assert.match(selection, /if \(!data\) throw new Error/);
  assert.match(proposals, /touristSelectGuide\(requestId, slot\.guide_id\)/);
  assert.match(trips, /touristSelectGuide\(trip\.id, slot\.guide_id\)/);
});

test('proposal availability uses max_proposals and leaves cap/expiry enforcement to Remote', async () => {
  const flow = await source('../src/api/tourRequestFlow.js');
  assert.match(flow, /max_proposals: Math\.max\(1, Number\(request\.max_proposals\) \|\| 5\)/);
  assert.match(flow, /request\.accepted_count < request\.max_proposals/);
  assert.match(flow, /!isExpired\(request\.expires_at\)/);
  const submit = flow.slice(flow.indexOf('export async function guideSubmitProposal'), flow.indexOf('export async function touristSelectGuide'));
  assert.doesNotMatch(submit, />= 5/);
  assert.match(submit, /\.eq\('proposal_round', proposalRound\)/);
  assert.match(submit, /trip_slots_request_guide_round_unique\|duplicate key/);
  assert.match(submit, /proposal limit\|not accepting proposals/);
});

test('reject UI and canonical RPC block terminal proposal states and refresh request state', async () => {
  const panel = await source('../src/components/profile/ProposalsPanel.jsx');
  const migration = await source('../supabase/migrations/20260907131512_phase2_trip_request_business_logic.sql');
  assert.match(panel, /\['rejected', 'finalized', 'selected', 'closed'\]/);
  assert.match(panel, /queryKey: \['trip_request', requestId\]/);
  assert.match(migration, /WHEN status = 'proposals_ready' AND v_count < v_max THEN 'active'/);
  assert.match(migration, /proposals_count = 1/);
});

test('no browser notification inserts or removed selection-trigger calls remain', async () => {
  const flow = await source('../src/api/tourRequestFlow.js');
  assert.doesNotMatch(flow, /from\(['"]notifications['"]\)[\s\S]{0,300}\.insert\(/);
  assert.doesNotMatch(flow, /on_trip_request_confirmed|handle_trip_request_confirmed|trg_notify_guide_selected|notify_on_guide_selected/);
});

test('Phase 2 canonical migration filename and transactional selection contract match Remote', async () => {
  const migration = await source('../supabase/migrations/20260907131512_phase2_trip_request_business_logic.sql');
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.select_trip_guide\(request_id uuid, selected_guide_id uuid\)/);
  assert.match(migration, /request\.user_id <> \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.handle_trip_request_confirmed\(\)/);
});
