import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('expiration migration installs a server-only scheduled expiration worker', async () => {
  const migration = await source('../supabase/migrations/20260907141252_phase2_trip_request_expiration_lifecycle.sql');
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_cron/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.expire_trip_requests\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.expire_trip_requests\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /'expire-trip-requests'/);
  assert.match(migration, /'\*\/15 \* \* \* \*'/);
  assert.match(migration, /SELECT public\.expire_trip_requests\(\);/);
});

test('server business logic blocks proposals and guide selection after expires_at', async () => {
  const migration = await source('../supabase/migrations/20260907141252_phase2_trip_request_expiration_lifecycle.sql');
  const expiryCheck = /v_request\.expires_at IS NOT NULL AND v_request\.expires_at <= now\(\)/g;
  assert.ok((migration.match(expiryCheck) || []).length >= 2);
  assert.match(migration, /RAISE EXCEPTION 'This trip request has expired'/);
  assert.match(migration, /status IN \('active','pending','open','proposals_ready'\)/);
});

test('expiration closes current-round active proposals and keeps selected work intact', async () => {
  const migration = await source('../supabase/migrations/20260907141252_phase2_trip_request_expiration_lifecycle.sql');
  assert.match(migration, /s\.proposal_round = v_request\.proposal_round/);
  assert.match(migration, /s\.status IN \('selected','finalized'\)/);
  assert.match(migration, /SET status = 'closed'/);
  assert.match(migration, /status IN \('accepted','chatting'\)/);
  assert.match(migration, /SET status = 'expired'/);
});

test('rebroadcast works immediately after the deadline without waiting for cron', async () => {
  const migration = await source('../supabase/migrations/20260907141252_phase2_trip_request_expiration_lifecycle.sql');
  assert.match(migration, /v_request\.status NOT IN \('active','pending','open','proposals_ready'\)/);
  assert.match(migration, /v_request\.expires_at > now\(\)/);
  assert.match(migration, /proposal_round = proposal_round \+ 1/);
  assert.match(migration, /expires_at = now\(\) \+ interval '7 days'/);
});

test('guide-facing APIs hide overdue requests and surface expiration clearly', async () => {
  const legacyApi = await source('../src/api/tripRequests.js');
  const flow = await source('../src/api/tourRequestFlow.js');

  assert.match(legacyApi, /const isRequestExpired = \(trip\)/);
  assert.match(legacyApi, /!isRequestExpired\(trip\)/);

  assert.match(flow, /const isExpired = \(expiresAt\)/);
  assert.match(flow, /currentRequests = normalized\.filter\(request => !isExpired\(request\.expires_at\)\)/);
  assert.match(flow, /select\('proposal_round, status, expires_at'\)/);
  assert.match(flow, /throw new Error\('This trip request has expired\.'\)/);
  assert.doesNotMatch(legacyApi, /rpc\('expire_trip_requests'/);
  assert.doesNotMatch(flow, /rpc\('expire_trip_requests'/);
});

test('tourist UI derives effective expiry immediately and enables rebroadcast', async () => {
  const page = await source('../src/pages/MyTripRequests.jsx');
  assert.match(page, /const OPEN_REQUEST_STATUSES = new Set\(\['open', 'active', 'pending', 'proposals_ready'\]\)/);
  assert.match(page, /const effectiveRequestStatus = \(trip\)/);
  assert.match(page, /new Date\(trip\.expires_at\)\.getTime\(\) <= Date\.now\(\)/);
  assert.match(page, /const effectiveStatus = effectiveRequestStatus\(trip\)/);
  assert.match(page, /<StatusBadge status=\{effectiveStatus\} \/>/);
  assert.match(page, /effectiveStatus === 'expired'/);
  assert.match(page, /window\.setTimeout\(\(\) => refreshExpiry/);
  assert.match(page, /Re-broadcast to Guides/);
});
