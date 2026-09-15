import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(
  new URL('../src/components/profile/ProposalsPanel.jsx', import.meta.url),
  'utf8',
);
const bell = await readFile(
  new URL('../src/components/layout/NotificationBell.jsx', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../supabase/migrations/20260915205338_traveler_proposal_queue_and_pending.sql', import.meta.url),
  'utf8',
);

test('traveler proposal UI exposes approve, pending, and irreversible reject decisions', () => {
  assert.match(component, /set_trip_proposal_pending/);
  assert.match(component, /is_pending: moveToPending/);
  assert.match(component, /Pending/);
  assert.match(component, /Once rejected, you cannot restore or approve it later/);
  assert.match(component, /touristSelectGuide\(requestId, slot\.guide_id\)/);
});

test('traveler proposals remain chronologically ordered', () => {
  const queryStart = component.indexOf(".from('trip_slots')");
  const queryEnd = component.indexOf('if (error) throw error;', queryStart);
  const query = component.slice(queryStart, queryEnd);

  assert.match(query, /\.order\('accepted_at', \{ ascending: true, nullsFirst: false \}\)/);
  assert.match(query, /\.order\('id', \{ ascending: true \}\)/);
  assert.ok(query.indexOf(".order('accepted_at'") < query.indexOf(".order('id'"));
});

test('traveler decision state is independent from provider proposal lifecycle', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS traveler_decision text NOT NULL DEFAULT 'undecided'/);
  assert.match(migration, /traveler_decision IN \('undecided', 'pending', 'rejected', 'approved'\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS traveler_visible_at timestamptz/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS visibility_advanced_at timestamptz/);
});

test('RLS only exposes admin-approved proposals after the queue reveals them', () => {
  assert.match(migration, /approval_status = 'approved'/);
  assert.match(migration, /traveler_visible_at IS NOT NULL/);
  assert.match(migration, /private\.current_user_owns_trip_request\(trip_request_id\)/);
});

test('proposal queue starts with two positions and advances at most once per proposal', () => {
  assert.match(migration, /2 \+ count\(\*\)::integer/);
  assert.match(migration, /visibility_advanced_at IS NOT NULL/);
  assert.match(migration, /v_first_advance := v_slot\.visibility_advanced_at IS NULL/);
  assert.match(migration, /visibility_advanced_at = COALESCE\(visibility_advanced_at, now\(\)\)/);
  assert.match(migration, /IF v_first_advance THEN/);
  assert.match(migration, /PERFORM private\.reveal_available_trip_proposals/);
});

test('traveler reject is terminal and does not reopen a responded marketplace slot', () => {
  const rejectStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.reject_trip_proposal');
  const selectStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.select_trip_guide', rejectStart);
  const rejectFn = migration.slice(rejectStart, selectStart);

  assert.match(rejectFn, /traveler_decision = 'rejected'/);
  assert.match(rejectFn, /This proposal was already rejected and cannot be restored/);
  assert.doesNotMatch(rejectFn, /SET status = 'declined'/);
  assert.match(rejectFn, /IF v_escalate_direct THEN[\s\S]*PERFORM public\.dispatch_trip_request/);
});

test('pending sends provider notification and email and notification routes to request', () => {
  assert.match(migration, /'proposal_pending'/);
  assert.match(migration, /The traveler marked your proposal as Pending/);
  assert.match(migration, /'proposal-pending:' \|\| proposal_id::text/);
  assert.match(migration, /ELSIF v_row\.template = 'proposal_pending'/);

  assert.match(bell, /proposal_pending:\s*\{ label: 'Proposal Pending'/);
  assert.match(bell, /notification\.type === 'proposal_pending'/);
  assert.match(bell, /return `\/dashboard\/requests\/\$\{requestId\}`/);
});
