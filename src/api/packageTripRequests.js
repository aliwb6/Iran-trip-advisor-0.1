import { supabase } from '@/supabaseClient';
import { normalizeProviderCode } from '@/lib/packageTripRequest';

export async function beginPackageTripRequest(tourId, providerCode = null) {
  if (!tourId) throw new Error('Tour package not found.');

  const normalizedCode = providerCode == null ? null : normalizeProviderCode(providerCode);
  if (providerCode != null && normalizedCode == null) {
    throw new Error('Enter a valid numeric guide or agency ID.');
  }

  const { data, error } = await supabase.rpc('begin_package_trip_request', {
    p_tour_id: tourId,
    p_provider_code: normalizedCode,
  });

  if (error) throw error;
  if (!data?.intent_id) throw new Error('Could not prepare this tour request.');
  return data;
}

export async function cancelPackageTripRequestIntent(intentId) {
  if (!intentId) return false;
  const { data, error } = await supabase.rpc('cancel_direct_trip_request_intent', {
    intent_id: intentId,
  });
  if (error) throw error;
  return Boolean(data);
}

