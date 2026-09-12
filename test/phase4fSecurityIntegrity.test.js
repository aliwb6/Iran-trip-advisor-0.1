import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const migrationPath = '../supabase/migrations/20260909191647_phase4f_security_integrity_hardening.sql';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

async function sourceFiles(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test('ordinary profile writes cannot forge admin, approval, rejection, publication, verification, or commission state', async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.protect_profile_authorization_fields\(\)/);
  assert.match(sql, /SECURITY INVOKER\s+SET search_path = ''/);
  assert.match(sql, /current_user <> 'authenticated'/);
  assert.match(sql, /private\.current_user_is_admin\(\)/);

  for (const field of [
    'is_admin',
    'is_verified',
    'is_approved',
    'is_rejected',
    'is_published',
    'approval_rejection_reason',
    'approval_reviewed_at',
    'commission_rate',
  ]) {
    assert.match(sql, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`));
  }

  assert.match(sql, /NEW\.role NOT IN \('traveler', 'tourist', 'guide', 'agency'\)/);
  assert.match(sql, /Profile role changes are restricted to provider onboarding/);
  assert.match(sql, /Provider onboarding must begin in an unapproved state/);
  assert.match(sql, /Only an administrator or server process may change profile authorization or moderation fields/);
  assert.match(sql, /BEFORE INSERT OR UPDATE ON public\.profiles/);
});

test('signup metadata cannot create an admin and intended provider onboarding remains unapproved', async () => {
  const sql = await source(migrationPath);
  const signup = await source('../src/pages/Signup.jsx');
  const register = await source('../src/pages/Register.jsx');
  const onboarding = await source('../src/pages/GuideOnboarding.jsx');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(sql, /v_signup_role := CASE lower\(COALESCE\(NEW\.raw_user_meta_data->>'role', 'traveler'\)\)/);
  assert.match(sql, /WHEN 'guide' THEN 'guide'[\s\S]*WHEN 'agency' THEN 'agency'[\s\S]*ELSE 'traveler'/);
  assert.doesNotMatch(sql, /WHEN 'admin' THEN 'admin'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.handle_new_user\(\)\s+FROM PUBLIC, anon, authenticated, service_role/);

  assert.match(signup, /role: formData\.role/);
  assert.match(register, /data:\s*\{[\s\S]*role,/);
  assert.match(onboarding, /role: 'guide',[\s\S]*is_approved: false/);
  assert.match(sql, /OLD\.role IN \('traveler', 'tourist'\)[\s\S]*NEW\.role IN \('traveler', 'tourist', 'guide', 'agency'\)/);
});

test('safe self-service profile fields and admin moderation remain compatible', async () => {
  const sql = await source(migrationPath);
  const dashboard = await source('../src/pages/Dashboard.jsx');
  const profile = await source('../src/pages/profile/ProfilePage.jsx');
  const settings = await source('../src/pages/profile/SettingsPage.jsx');
  const moderation = await source('../src/lib/profileCompletion.js');

  assert.match(sql, /IF v_caller_is_admin THEN\s+RETURN NEW/);
  assert.match(sql, /NEW\.license_status = 'pending_review'[\s\S]*NEW\.license_url IS DISTINCT FROM OLD\.license_url/);
  assert.match(dashboard, /update\(\{ license_url: path, license_status: 'pending_review' \}\)/);
  assert.match(dashboard, /update\(profilePayload\)/);
  assert.match(profile, /update\(\{ \[key\]: storedValue \}\)/);
  assert.match(settings, /update\(\{ \[key\]: value \}\)/);
  assert.match(moderation, /is_approved: decision === 'approve' \? true/);
  assert.match(moderation, /\.from\('profiles'\)\s*\.update\(updates\)/);
});

test('trip slot proposal rows are insert-only to browsers and eligibility matches the insert trigger', async () => {
  const sql = await source(migrationPath);
  const files = await sourceFiles('src');
  const frontend = await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
  const flow = await source('../src/api/tourRequestFlow.js');
  const tripRequests = await source('../src/api/tripRequests.js');

  assert.match(sql, /DROP POLICY IF EXISTS trip_slots_authenticated_update ON public\.trip_slots/);
  assert.match(sql, /REVOKE UPDATE ON TABLE public\.trip_slots FROM authenticated/);
  assert.match(sql, /CREATE POLICY trip_slots_authenticated_insert[\s\S]*guide_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /p\.role IN \('guide', 'agency'\)[\s\S]*p\.is_approved IS TRUE[\s\S]*p\.is_rejected IS NOT TRUE/);

  for (const content of frontend) {
    assert.doesNotMatch(content, /\.from\(['"]trip_slots['"]\)[\s\S]{0,240}?\.update\(/);
  }
  assert.match(flow, /\.from\('trip_slots'\)\s*\.insert\(\{[\s\S]*trip_request_id: requestId,[\s\S]*guide_id: guideId/);
  assert.match(flow, /rpc\('select_trip_guide'/);
  assert.match(flow, /rpc\('finalize_selected_trip_slot'/);
  assert.match(tripRequests, /rpc\('guide_reject_trip_slot'/);
});

test('direct-message inserts bind sender identity and authorize the recipient relationship', async () => {
  const sql = await source(migrationPath);
  const chat = await source('../src/pages/Chat.jsx');

  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.current_user_can_message\(p_recipient_id uuid\)/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /p_recipient_id <> \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /recipient\.is_approved IS TRUE[\s\S]*recipient\.is_rejected IS NOT TRUE[\s\S]*recipient\.is_published IS TRUE/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.current_user_can_message\(uuid\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private\.current_user_can_message\(uuid\) TO authenticated/);

  assert.match(sql, /conversation_id IS NULL\s+AND sender_id = \(SELECT auth\.uid\(\)\)\s+AND receiver_id IS NOT NULL\s+AND \(SELECT private\.current_user_can_message\(receiver_id\)\)/);
  assert.match(sql, /Direct-message sender must match the authenticated caller/);
  assert.match(chat, /sender_id: user\.id,[\s\S]*receiver_id: guideId/);
});

test('message updates expose only read receipts or owner-scoped AI history edits', async () => {
  const sql = await source(migrationPath);
  const chat = await source('../src/pages/Chat.jsx');
  const history = await source('../src/hooks/useChatHistory.js');

  assert.match(sql, /REVOKE UPDATE ON TABLE public\.messages FROM authenticated/);
  assert.match(sql, /GRANT UPDATE \(is_read, content, edited, edited_at\)\s+ON TABLE public\.messages TO authenticated/);
  assert.match(sql, /OLD\.receiver_id IS DISTINCT FROM v_uid[\s\S]*NEW\.content IS DISTINCT FROM OLD\.content[\s\S]*NEW\.sender_id IS DISTINCT FROM OLD\.sender_id[\s\S]*NEW\.receiver_id IS DISTINCT FROM OLD\.receiver_id[\s\S]*NEW\.is_read IS NOT TRUE/);
  assert.match(sql, /Conversation message identity fields are immutable/);
  assert.match(sql, /CREATE POLICY messages_authenticated_delete[\s\S]*conversation_id IS NOT NULL[\s\S]*c\.user_id = \(SELECT auth\.uid\(\)\)/);

  assert.match(chat, /update\(\{ is_read: true \}\)/);
  assert.match(history, /update\(\{ content: newText, edited: true, edited_at: editedAt \}\)/);
  assert.match(history, /conversation_id: convId,[\s\S]*role: msg\.role,[\s\S]*content: msg\.content/);
});

test('legacy tour requests have no browser mutation or participant reassignment path', async () => {
  const sql = await source(migrationPath);
  const files = await sourceFiles('src');
  const frontend = await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
  const tourDetails = await source('../src/pages/TourDetails.jsx');
  const packageRequests = await source('../src/api/packageTripRequests.js');

  assert.match(sql, /DROP POLICY IF EXISTS tour_requests_authenticated_update ON public\.tour_requests/);
  assert.match(sql, /REVOKE UPDATE ON TABLE public\.tour_requests FROM authenticated/);
  for (const content of frontend) {
    assert.doesNotMatch(content, /\.from\(['"]tour_requests['"]\)[\s\S]{0,240}?\.update\(/);
    assert.doesNotMatch(content, /\.from\(['"]tour_requests['"]\)[\s\S]{0,240}?\.insert\(/);
  }
  assert.doesNotMatch(tourDetails, /\.from\('tour_requests'\)/);
  assert.match(packageRequests, /rpc\('begin_package_trip_request'/);
});

test('provider request visibility requires the same approval boundary as proposal insertion', async () => {
  const sql = await source(migrationPath);
  const policyStart = sql.indexOf('CREATE POLICY trip_requests_authenticated_select');
  const policy = sql.slice(policyStart);

  assert.match(policy, /user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(policy, /selected_guide_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(policy, /p\.role IN \('guide', 'agency'\)/);
  assert.match(policy, /p\.is_approved IS TRUE/);
  assert.match(policy, /p\.is_rejected IS NOT TRUE/);
  assert.match(policy, /request_channel <> 'direct_profile'[\s\S]*direct_escalated_at IS NOT NULL[\s\S]*direct_provider_id = \(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(policy, /TO anon/);
});
