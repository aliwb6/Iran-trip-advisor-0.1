import {
  PaymentServerError,
  getAuthenticatedUser,
  getPaymentEnvironment,
  paymentAppUrl,
  paymentCurrencyAllowed,
  readJsonBody,
  safeErrorPayload,
  sendJson,
  serviceRpc,
  stripeRequest,
  toMinorUnits,
} from '../../server/payments.js';

const PROVIDER = 'stripe';
const ALLOWED_PAYMENT_TYPES = new Set(['deposit']);

async function prepareAttempt(bookingId, touristId, paymentType, env) {
  const result = await serviceRpc('create_booking_payment_attempt', {
    p_booking_id: bookingId,
    p_tourist_id: touristId,
    p_provider: PROVIDER,
    p_payment_type: paymentType,
  }, env);
  const attempt = Array.isArray(result) ? result[0] : result;
  if (!attempt?.payment_id) {
    throw new PaymentServerError('Payment attempt could not be created', 502, 'payment_attempt_missing');
  }
  return attempt;
}

async function failAttempt(paymentId, reason, env) {
  if (!paymentId) return;
  try {
    await serviceRpc('fail_booking_payment_attempt', {
      p_payment_id: paymentId,
      p_reason: String(reason || 'Payment attempt failed').slice(0, 500),
    }, env);
  } catch (error) {
    console.error('Could not fail payment attempt', error);
  }
}

async function fetchExistingCheckout(attempt, env) {
  if (!attempt.provider_session_id) {
    throw new PaymentServerError(
      'A payment session is being prepared. Please try again in a moment.',
      409,
      'payment_initializing'
    );
  }

  const session = await stripeRequest(
    `/checkout/sessions/${encodeURIComponent(attempt.provider_session_id)}`,
    { method: 'GET' },
    env
  );

  if (session?.status === 'open' && session?.url) return { reusable: true, session };

  if (session?.status === 'complete') {
    throw new PaymentServerError(
      'This payment was submitted and is waiting for confirmation.',
      409,
      'payment_processing'
    );
  }

  await failAttempt(attempt.payment_id, `Stripe Checkout session is ${session?.status || 'unavailable'}`, env);
  return { reusable: false, session: null };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'method_not_allowed' });
  }

  const env = getPaymentEnvironment();
  if (!env.enabled) {
    return sendJson(response, 503, {
      error: 'payments_not_configured',
      message: 'Online payments are not enabled yet.',
    });
  }

  let activePaymentId = null;
  let createdSessionId = null;

  try {
    const user = await getAuthenticatedUser(request, env);
    const body = await readJsonBody(request);
    const bookingId = String(body.bookingId || '').trim();
    const paymentType = String(body.paymentType || 'deposit').trim().toLowerCase();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
      throw new PaymentServerError('A valid booking id is required', 400, 'invalid_booking_id');
    }
    if (!ALLOWED_PAYMENT_TYPES.has(paymentType)) {
      throw new PaymentServerError('This payment type is not enabled', 400, 'payment_type_not_enabled');
    }

    let attempt = await prepareAttempt(bookingId, user.id, paymentType, env);
    activePaymentId = attempt.payment_id;

    if (!paymentCurrencyAllowed(attempt.currency, env)) {
      await failAttempt(activePaymentId, `Unsupported checkout currency: ${attempt.currency}`, env);
      throw new PaymentServerError(
        `Online payment is not available for ${String(attempt.currency || '').toUpperCase()}.`,
        400,
        'unsupported_currency'
      );
    }

    if (attempt.is_existing) {
      const existing = await fetchExistingCheckout(attempt, env);
      if (existing.reusable) {
        return sendJson(response, 200, {
          provider: PROVIDER,
          paymentId: attempt.payment_id,
          sessionId: existing.session.id,
          url: existing.session.url,
          reused: true,
        });
      }
      attempt = await prepareAttempt(bookingId, user.id, paymentType, env);
      activePaymentId = attempt.payment_id;
    }

    const currency = String(attempt.currency || '').toLowerCase();
    const amountMinor = toMinorUnits(attempt.amount, currency);
    const appUrl = paymentAppUrl(env, request);
    const successUrl = `${appUrl}/profile/requests?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/profile/requests?payment=cancelled`;
    const productName = `Booking deposit${attempt.booking_title ? ` — ${attempt.booking_title}` : ''}`.slice(0, 120);

    const params = {
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: attempt.payment_id,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': String(amountMinor),
      'line_items[0][price_data][product_data][name]': productName,
      'metadata[payment_id]': attempt.payment_id,
      'metadata[booking_id]': attempt.booking_id,
      'metadata[payment_type]': paymentType,
      'payment_intent_data[metadata][payment_id]': attempt.payment_id,
      'payment_intent_data[metadata][booking_id]': attempt.booking_id,
      'payment_intent_data[metadata][payment_type]': paymentType,
    };
    if (user.email) params.customer_email = user.email;

    const session = await stripeRequest('/checkout/sessions', { params }, env);
    if (!session?.id || !session?.url) {
      throw new PaymentServerError('Stripe did not return a checkout session', 502, 'stripe_session_missing');
    }
    createdSessionId = session.id;

    try {
      await serviceRpc('attach_payment_provider_session', {
        p_payment_id: attempt.payment_id,
        p_provider_session_id: session.id,
        p_provider_amount_minor: amountMinor,
        p_provider_currency: currency,
        p_provider_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      }, env);
    } catch (attachError) {
      try {
        await stripeRequest(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, { params: {} }, env);
      } catch (expireError) {
        console.error('Could not expire orphan Stripe Checkout session', expireError);
      }
      await failAttempt(attempt.payment_id, 'Could not attach Stripe Checkout session', env);
      throw attachError;
    }

    return sendJson(response, 200, {
      provider: PROVIDER,
      paymentId: attempt.payment_id,
      sessionId: session.id,
      url: session.url,
      reused: false,
    });
  } catch (error) {
    if (activePaymentId && !createdSessionId && error?.code === 'stripe_request_failed') {
      await failAttempt(activePaymentId, error.message, env);
    }
    const payload = safeErrorPayload(error);
    return sendJson(response, payload.status, payload.body);
  }
}
