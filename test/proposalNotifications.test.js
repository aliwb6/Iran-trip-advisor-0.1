import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

const migrationPath = '../supabase/migrations/20260910123718_notify_traveler_on_proposal.sql';

test('every newly inserted proposal notifies the traveler while the final proposal stays proposals_ready', async () => {
  const migration = await source(migrationPath);

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.handle_trip_slot_insert\(\)/);
  assert.match(migration, /v_notification_type := 'proposal_received'/);
  assert.match(migration, /v_notification_type := 'proposals_ready'/);
  assert.match(migration, /INSERT INTO public\.notifications \(user_id, type, message, related_request_id\)/);
  assert.match(migration, /NEW\.trip_request_id/);
  assert.match(migration, /Travel agency/);
  assert.match(migration, /Guide /);
});

test('proposal notifications are published to Supabase realtime', async () => {
  const migration = await source(migrationPath);

  assert.match(migration, /pg_publication_tables/);
  assert.match(migration, /pubname = 'supabase_realtime'/);
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.notifications/);
});

test('navbar notification context uses the canonical notifications schema', async () => {
  const context = await source('../src/lib/NotificationsContext.jsx');

  assert.match(context, /id,user_id,type,message,related_request_id,is_read,created_at/);
  assert.doesNotMatch(context, /type,title,body,link,is_read/);
  assert.match(context, /event: 'INSERT'/);
  assert.match(context, /event: 'UPDATE'/);
});

test('proposal notification click opens the exact tourist request detail page', async () => {
  const bell = await source('../src/components/layout/NotificationBell.jsx');

  assert.match(bell, /notification\.type === 'proposal_received' \|\| notification\.type === 'proposals_ready'/);
  assert.match(bell, /return `\/profile\/requests\/\$\{requestId\}`/);
  assert.match(bell, /notification\.message/);
  assert.match(bell, /await markOneRead\(notification\.id\)/);
});
