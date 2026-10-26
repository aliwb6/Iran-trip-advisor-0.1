import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchWithPublicReadTimeout } from '../src/lib/supabaseFetch.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('public reads receive a cancellable signal and preserve caller cancellation', async () => {
  const caller = new AbortController();
  let requestSignal;
  globalThis.fetch = (_input, init) => {
    requestSignal = init.signal;
    return new Promise((_resolve, reject) => {
      requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true });
    });
  };

  const pending = fetchWithPublicReadTimeout('https://example.supabase.co/rest/v1/tours', {
    method: 'GET', signal: caller.signal,
  });
  caller.abort(new Error('cancelled by caller'));
  await assert.rejects(pending, /cancelled by caller/);
  assert.equal(requestSignal.aborted, true);
});

test('profile RPC reads are bounded while writes keep their original signal', async () => {
  const calls = [];
  globalThis.fetch = (_input, init) => {
    calls.push(init);
    return Promise.resolve({ ok: true });
  };
  const signal = new AbortController().signal;
  await fetchWithPublicReadTimeout('https://example.supabase.co/rest/v1/rpc/get_public_profiles', { method: 'POST', signal });
  await fetchWithPublicReadTimeout('https://example.supabase.co/rest/v1/bookings', { method: 'POST', signal });
  assert.notEqual(calls[0].signal, signal);
  assert.equal(calls[1].signal, signal);
});
