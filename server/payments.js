import { createHmac, timingSafeEqual } from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);
const THREE_DECIMAL_CURRENCIES = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);

export class PaymentServerError extends Error {
  constructor(message, status = 500, code = 'payment_server_error') {
    super(message);
    this.name = 'PaymentServerError';
    this.status = status;
    this.code = code;
  }
}

const cleanBaseUrl = value => String(value || '').trim().replace(/\/+$/, '');

export function getPaymentEnvironment() {
  const supabaseUrl = cleanBaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '';
  const appUrl = cleanBaseUrl(process.env.PAYMENT_APP_URL || productionHost);
  const supportedCurrencies = new Set(
    String(process.env.PAYMENT_SUPPORTED_CURRENCIES || 'usd')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    stripeSecretKey,
    stripeWebhookSecret,
    appUrl,
    supportedCurrencies,
    enabled: Boolean(
      supabaseUrl &&
      supabaseAnonKey &&
      supabaseServiceRoleKey &&
      stripeSecretKey &&
      stripeWebhookSecret &&
      appUrl
    ),
  };
}

export function sendJson(response, status, payload) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

export async function readRawBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body, 'utf8');
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  const raw = await readRawBody(request);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new PaymentServerError('Invalid JSON request body', 400, 'invalid_json');
  }
}

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function getAuthenticatedUser(request, env = getPaymentEnvironment()) {
  const token = bearerToken(request);
  if (!token) throw new PaymentServerError('Authentication required', 401, 'auth_required');
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new PaymentServerError('Authentication service is not configured', 503, 'auth_not_configured');
  }

  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await parseResponse(response);
  if (!response.ok || !data?.id) {
    throw new PaymentServerError('Invalid or expired session', 401, 'invalid_session');
  }
  return data;
}

export async function serviceRpc(name, payload, env = getPaymentEnvironment()) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new PaymentServerError('Payment database service is not configured', 503, 'database_not_configured');
  }

  const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload || {}),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    const message = data?.message || data?.error_description || `Database RPC ${name} failed`;
    throw new PaymentServerError(message, response.status >= 500 ? 502 : 400, 'database_rpc_failed');
  }
  return data;
}

export async function stripeRequest(path, options = {}, env = getPaymentEnvironment()) {
  if (!env.stripeSecretKey) {
    throw new PaymentServerError('Stripe is not configured', 503, 'stripe_not_configured');
  }

  const method = options.method || 'POST';
  const headers = {
    Authorization: `Bearer ${env.stripeSecretKey}`,
  };
  let body;
  if (options.params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.params).toString();
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, { method, headers, body });
  const data = await parseResponse(response);
  if (!response.ok) {
    const message = data?.error?.message || 'Stripe request failed';
    const error = new PaymentServerError(message, response.status >= 500 ? 502 : 400, 'stripe_request_failed');
    error.providerResponse = data;
    throw error;
  }
  return data;
}

export function currencyExponent(currency) {
  const normalized = String(currency || '').toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(normalized)) return 3;
  return 2;
}

export function toMinorUnits(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new PaymentServerError('Invalid payment amount', 400, 'invalid_payment_amount');
  }
  const factor = 10 ** currencyExponent(currency);
  const minor = Math.round((numeric + Number.EPSILON) * factor);
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new PaymentServerError('Payment amount is outside the supported range', 400, 'invalid_payment_amount');
  }
  return minor;
}

export function paymentCurrencyAllowed(currency, env = getPaymentEnvironment()) {
  return env.supportedCurrencies.has(String(currency || '').toLowerCase());
}

export function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!secret || !signatureHeader) return false;
  const fields = String(signatureHeader).split(',').map(part => part.trim());
  const timestampPart = fields.find(part => part.startsWith('t='));
  const signatures = fields.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some(signature => {
    if (!/^[0-9a-f]+$/i.test(signature) || signature.length !== expected.length) return false;
    const actualBuffer = Buffer.from(signature, 'hex');
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

export function paymentAppUrl(env = getPaymentEnvironment(), request = null) {
  if (env.appUrl) return env.appUrl;
  const proto = request?.headers?.['x-forwarded-proto'] || 'https';
  const host = request?.headers?.host;
  if (!host) throw new PaymentServerError('Payment return URL is not configured', 503, 'return_url_not_configured');
  return cleanBaseUrl(`${proto}://${host}`);
}

export function publicPaymentConfig(env = getPaymentEnvironment()) {
  return {
    provider: 'stripe',
    enabled: env.enabled,
    supportedCurrencies: [...env.supportedCurrencies],
    paymentTypes: ['deposit'],
    contactReleaseOn: 'deposit_paid',
  };
}

export function safeErrorPayload(error) {
  if (error instanceof PaymentServerError) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  console.error('Unhandled payment server error', error);
  return {
    status: 500,
    body: { error: 'payment_server_error', message: 'The payment service could not complete the request.' },
  };
}
