import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = '../supabase/migrations/20260910150000_marketplace_trip_request_dispatch.sql';
async function source(path) { return readFile(new URL(path, import.meta.url), 'utf8'); }

test('marketplace dispatch ledger is private, unique per provider and round, and indexed', async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.trip_request_dispatches/);
  assert.match(sql, /UNIQUE \(trip_request_id, provider_id, proposal_round\)/);
  assert.match(sql, /status IN \('pending', 'responded', 'declined', 'expired', 'closed'\)/);
  assert.match(sql, /idx_trip_request_dispatches_provider_actionable/);
  assert.match(sql, /idx_trip_request_dispatches_request_round/);
  assert.match(sql, /idx_trip_request_dispatches_pending_expiry/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.trip_request_dispatches FROM anon, authenticated/);
  assert.doesNotMatch(sql, /GRANT (?:ALL|INSERT|UPDATE|DELETE) ON TABLE public\.trip_request_dispatches TO authenticated/);
});

test('dispatch is a locked, idempotent five-provider server operation with one notification per inserted invite', async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /FOR UPDATE;/);
  assert.match(sql, /v_capacity := GREATEST\(0, 5 - v_active\)/);
  assert.match(sql, /LIMIT v_capacity/);
  assert.match(sql, /ON CONFLICT \(trip_request_id, provider_id, proposal_round\) DO NOTHING/);
  assert.match(sql, /INSERT INTO public\.notifications[\s\S]*FROM inserted i/);
  assert.match(sql, /now\(\) \+ interval '24 hours'/);
  assert.match(sql, /private\.marketplace_provider_is_eligible/);
  assert.match(sql, /is_approved IS TRUE[\s\S]*is_rejected IS NOT TRUE[\s\S]*is_published IS TRUE[\s\S]*accept_bookings IS TRUE/);
});

test('only an invitation/proposal/direct target/admin relationship can read and propose', async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /CREATE POLICY trip_requests_authenticated_select/);
  assert.match(sql, /public\.current_user_is_admin\(\)/);
  assert.match(sql, /trip_request_dispatches d[\s\S]*d\.provider_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /This trip request was not dispatched to this provider/);
  assert.match(sql, /UPDATE public\.trip_request_dispatches SET status = 'responded'/);
  assert.match(sql, /This direct trip request is currently private to another provider/);
});

test('expiry, decline, rebroadcast and direct escalation use controlled replacement batches', async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.decline_trip_request_invitation/);
  assert.match(sql, /status = 'declined'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.process_trip_request_dispatches/);
  assert.match(sql, /status = 'expired'/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.rebroadcast_trip_request/);
  assert.match(sql, /proposal_round = proposal_round \+ 1/);
  assert.match(sql, /PERFORM public\.dispatch_trip_request\(request_id\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.escalate_stale_direct_trip_requests/);
  assert.match(sql, /cron\.schedule\('process-trip-request-dispatches', '\*\/5 \* \* \* \*'/);
});

test('Find Jobs, its badge, and every notification surface use the dispatched request flow', async () => {
  const [api, navbar, page, bell, dashboardBell, dashboard] = await Promise.all([
    source('../src/api/tripRequests.js'), source('../src/components/layout/Navbar.jsx'),
    source('../src/pages/FindJobs.jsx'), source('../src/components/layout/NotificationBell.jsx'),
    source('../src/components/navbar/NotificationBell.jsx'), source('../src/components/dashboard/NotificationsView.jsx'),
  ]);
  assert.match(api, /from\('trip_request_dispatches'\)/);
  assert.match(api, /eq\('status', 'pending'\)/);
  assert.match(navbar, /getAvailableTripRequests\(user\.id\)/);
  assert.match(page, /table: 'trip_request_dispatches'/);
  assert.match(bell, /notification\.type === 'tour_request'/);
  assert.match(dashboardBell, /`\/dashboard\/requests\/\$\{related_request_id\}`/);
  assert.match(dashboard, /\['new_request', 'tour_request', 'direct_trip_request'\]/);
});
