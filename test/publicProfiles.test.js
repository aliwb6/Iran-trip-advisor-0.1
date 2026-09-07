import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPublicProfileVisibility, selectPublicProfiles } from '../src/lib/publicProfiles.js';

function rpcClient(rows, calls = []) {
  return {
    rpc(name) {
      calls.push(['rpc', name]);
      return Promise.resolve({ data: rows, error: null });
    },
  };
}

test('public profile queries use the allowlisted get_public_profiles RPC', async () => {
  const calls = [];
  const client = rpcClient([
    { id: 'guide-1', username: 'zara-guide', role: 'guide', full_name: 'Zara', city: 'Tehran', rating: 4.9 },
    { id: 'agency-1', username: 'atlas-agency', role: 'agency', full_name: 'Atlas', city: 'Shiraz', rating: 4.7 },
  ], calls);

  const query = selectPublicProfiles(client, 'id, full_name, rating')
    .eq('id', 'guide-1')
    .in('role', ['guide'])
    .ilike('city', '%ehr%')
    .single();

  assert.equal(applyPublicProfileVisibility(query), query);
  assert.deepEqual(await query, {
    data: { id: 'guide-1', full_name: 'Zara', rating: 4.9 },
    error: null,
  });
  assert.deepEqual(calls, [['rpc', 'get_public_profiles']]);
});

test('public profile RPC adapter preserves guide, agency, username, ordering, and paging filters', async () => {
  const rows = [
    { id: 'guide-1', username: 'zara-guide', role: 'guide', full_name: 'Zara', city: 'Tehran', rating: 4.9 },
    { id: 'guide-2', username: 'amir-guide', role: 'guide', full_name: 'Amir', city: 'Tehran', rating: 4.7 },
    { id: 'agency-1', username: 'atlas-agency', role: 'agency', full_name: 'Atlas', city: 'Shiraz', rating: 4.8 },
  ];

  const guide = await selectPublicProfiles(rpcClient(rows)).eq('id', 'guide-1').single();
  const agency = await selectPublicProfiles(rpcClient(rows)).eq('id', 'agency-1').single();
  const byUsername = await selectPublicProfiles(rpcClient(rows)).eq('username', 'atlas-agency').single();
  const list = await selectPublicProfiles(rpcClient(rows), 'id, username')
    .in('role', ['guide'])
    .ilike('city', '%tehran%')
    .order('rating', { ascending: false })
    .range(0, 0);

  assert.equal(guide.data?.id, 'guide-1');
  assert.equal(agency.data?.id, 'agency-1');
  assert.equal(byUsername.data?.id, 'agency-1');
  assert.deepEqual(list, {
    data: [{ id: 'guide-1', username: 'zara-guide' }],
    error: null,
  });
});
