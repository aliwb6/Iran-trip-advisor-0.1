import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../supabase/migrations/20260916013000_admin_chat_moderation_and_contact_hardening.sql',
  import.meta.url,
);

const migration = await readFile(migrationUrl, 'utf8');

test('migration adds administrator moderation state, warnings, audit and RPCs', () => {
  for (const required of [
    'chat_moderation_threads',
    'chat_moderation_warnings',
    'chat_moderation_audit',
    'admin_set_chat_closed',
    'admin_warn_chat_user',
    'admin_edit_chat_message',
  ]) {
    assert.match(migration, new RegExp(required));
  }
});

test('migration enforces closed chats and hardens spelled-number detection', () => {
  assert.match(migration, /chat_pair_is_closed/);
  assert.match(migration, /AND NOT private\.chat_pair_is_closed/);
  assert.match(migration, /private\.current_user_can_message/);
  assert.match(migration, /ziro/);
  assert.match(migration, /eleven/);
  assert.match(migration, /double/);
  assert.match(migration, /t\[\[:space:\]._\\-\]\*e/);
  assert.match(migration, /private\.message_contains_contact_info/);
  assert.match(migration, /length\(regexp_replace\(v_match\[2\]/);
});
