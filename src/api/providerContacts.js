import { supabase } from '@/supabaseClient';

export const PROVIDER_CONTACT_TYPES = [
  { type: 'whatsapp', label: 'WhatsApp', order: 10 },
  { type: 'telegram', label: 'Telegram', order: 20 },
  { type: 'instagram', label: 'Instagram', order: 30 },
  { type: 'website', label: 'Website', order: 40 },
];

export async function fetchMyProviderContactMethods(providerId) {
  if (!providerId) return [];
  const { data, error } = await supabase
    .from('provider_contact_methods')
    .select('id, provider_id, type, value, is_enabled, display_order')
    .eq('provider_id', providerId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveMyProviderContactMethods(providerId, values) {
  if (!providerId) throw new Error('Provider id is required.');

  for (const definition of PROVIDER_CONTACT_TYPES) {
    const value = String(values?.[definition.type] || '').trim();
    if (!value) {
      const { error } = await supabase
        .from('provider_contact_methods')
        .delete()
        .eq('provider_id', providerId)
        .eq('type', definition.type);
      if (error) throw error;
      continue;
    }

    const { error } = await supabase
      .from('provider_contact_methods')
      .upsert({
        provider_id: providerId,
        type: definition.type,
        value,
        is_enabled: true,
        display_order: definition.order,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider_id,type' });
    if (error) throw error;
  }
}

export async function fetchBookingContactMethods(bookingId) {
  if (!bookingId) return [];
  const { data, error } = await supabase.rpc('get_booking_contact_methods', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data || [];
}
