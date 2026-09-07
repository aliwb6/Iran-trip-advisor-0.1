import { supabase } from '@/supabaseClient';

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function fetchPaymentProviderConfig() {
  const response = await fetch('/api/payments/config', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.message || 'Could not load payment configuration.');
  }
  return {
    provider: data?.provider || null,
    enabled: Boolean(data?.enabled),
    supportedCurrencies: Array.isArray(data?.supportedCurrencies)
      ? data.supportedCurrencies.map(value => String(value).toLowerCase())
      : [],
    paymentTypes: Array.isArray(data?.paymentTypes) ? data.paymentTypes : [],
    contactReleaseOn: data?.contactReleaseOn || null,
  };
}

export async function createDepositCheckout(bookingId) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Please sign in again before starting payment.');

  const response = await fetch('/api/payments/create-checkout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bookingId,
      paymentType: 'deposit',
    }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data?.message || 'Could not start the payment checkout.');
    error.code = data?.error || 'payment_checkout_failed';
    throw error;
  }
  if (!data?.url) throw new Error('Payment checkout did not return a redirect URL.');
  return data;
}

export async function redirectToDepositCheckout(bookingId) {
  const checkout = await createDepositCheckout(bookingId);
  window.location.assign(checkout.url);
  return checkout;
}
