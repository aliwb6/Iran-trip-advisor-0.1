const PUBLIC_READ_TIMEOUT_MS = 12000;

// Keep writes and authentication on the normal fetch path. Only public reads
// need a deadline so listing pages cannot display a spinner indefinitely.
export function fetchWithPublicReadTimeout(input, init = {}) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const isPublicRead = url.includes('/rest/v1/') && (
    method === 'GET' || (method === 'POST' && url.includes('/rpc/get_public_profiles'))
  );

  if (!isPublicRead) return fetch(input, init);

  const controller = new AbortController();
  const originalSignal = init.signal || (input instanceof Request ? input.signal : null);
  const forwardAbort = () => controller.abort(originalSignal.reason);
  if (originalSignal?.aborted) forwardAbort();
  else originalSignal?.addEventListener('abort', forwardAbort, { once: true });

  const timeout = setTimeout(() => {
    controller.abort(new DOMException('The server did not respond in time. Please try again.', 'TimeoutError'));
  }, PUBLIC_READ_TIMEOUT_MS);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
    originalSignal?.removeEventListener('abort', forwardAbort);
  });
}
