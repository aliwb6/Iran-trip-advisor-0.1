import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

const legacyNotificationMigration = '../supabase/migrations/20260910123718_notify_traveler_on_proposal.sql';
const queueMigration = '../supabase/migrations/20260915205338_traveler_proposal_queue_and_pending.sql';

test('latest proposal lifecycle notifies traveler only when an approved offer is revealed', async () => {
  const migration = await source(queueMigration);

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.handle_trip_slot_insert\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.reveal_available_trip_proposals/);
  assert.match(migration, /s\.approval_status = 'approved'/);
  assert.match(migration, /s\.traveler_visible_at IS NULL/);
  assert.match(migration, /'proposal_received'/);
  assert.match(migration, /PERFORM private\.reveal_available_trip_proposals\(v_request_id, v_round\)/);

  const handlerStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.handle_trip_slot_insert');
  const revealStart = migration.indexOf('CREATE OR REPLACE FUNCTION private.reveal_available_trip_proposals', handlerStart);
  const insertHandler = migration.slice(handlerStart, revealStart);
  assert.doesNotMatch(insertHandler, /INSERT INTO public\.notifications/);
});

test('proposal notifications remain published to Supabase realtime', async () => {
  const migration = await source(legacyNotificationMigration);

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

test('pending notification opens the exact provider request detail page', async () => {
  const bell = await source('../src/components/layout/NotificationBell.jsx');

  assert.match(bell, /proposal_pending/);
  assert.match(bell, /return `\/dashboard\/requests\/\$\{requestId\}`/);
});
