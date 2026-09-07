import {
  getPaymentEnvironment,
  readRawBody,
  safeErrorPayload,
  sendJson,
  serviceRpc,
  verifyStripeSignature,
} from '../../server/payments.js';

const PROVIDER = 'stripe';
const SUPPORTED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURITY_FAILURES = new Set([
  'payment_not_found',
  'provider_mismatch',
  'session_mismatch',
  'amount_mismatch',
  'currency_mismatch',
  'booking_not_found',
]);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'method_not_allowed' });
  }

  const env = getPaymentEnvironment();
  if (!env.stripeWebhookSecret || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return sendJson(response, 503, { error: 'webhook_not_configured' });
  }

  try {
    const rawBody = await readRawBody(request);
    const signature = request.headers['stripe-signature'];
    if (!verifyStripeSignature(rawBody, signature, env.stripeWebhookSecret)) {
      return sendJson(response, 400, { error: 'invalid_signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return sendJson(response, 400, { error: 'invalid_event_json' });
    }

    if (!event?.id || !event?.type || !event?.data?.object) {
      return sendJson(response, 400, { error: 'invalid_event' });
    }

    if (!SUPPORTED_EVENTS.has(event.type)) {
      return sendJson(response, 200, { received: true, ignored: true });
    }

    const session = event.data.object;
    const paymentId = session.metadata?.payment_id || session.client_reference_id || '';
    if (!UUID_RE.test(paymentId)) {
      return sendJson(response, 400, { error: 'missing_payment_id' });
    }

    const providerPaymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;
    const amountMinor = Number.isSafeInteger(session.amount_total) ? session.amount_total : null;
    const paidAt = Number.isFinite(Number(event.created))
      ? new Date(Number(event.created) * 1000).toISOString()
      : null;

    const result = await serviceRpc('process_payment_provider_event', {
      p_provider: PROVIDER,
      p_event_id: event.id,
      p_event_type: event.type,
      p_payment_id: paymentId,
      p_provider_session_id: session.id || null,
      p_provider_payment_intent_id: providerPaymentIntentId,
      p_provider_amount_minor: amountMinor,
      p_provider_currency: session.currency || null,
      p_provider_payment_status: session.payment_status || null,
      p_paid_at: paidAt,
      p_metadata: {
        livemode: Boolean(event.livemode),
        checkout_status: session.status || null,
        payment_status: session.payment_status || null,
      },
    }, env);

    const normalizedResult = typeof result === 'string' ? result : result?.result || result;
    if (SECURITY_FAILURES.has(normalizedResult)) {
      return sendJson(response, 400, {
        error: 'payment_event_rejected',
        reason: normalizedResult,
      });
    }

    return sendJson(response, 200, {
      received: true,
      result: normalizedResult || 'processed',
    });
  } catch (error) {
    const payload = safeErrorPayload(error);
    return sendJson(response, payload.status, payload.body);
  }
}
