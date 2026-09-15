import { supabase } from '@/supabaseClient';

export async function fetchChatModeration(counterpartyId) {
  if (!counterpartyId) {
    return { isClosed: false, closedAt: null, closeReason: null, warnings: [] };
  }

  const [stateRes, warningsRes] = await Promise.all([
    supabase.rpc('get_chat_moderation_state', { p_counterparty_id: counterpartyId }),
    supabase.rpc('get_chat_warnings_with_user', { p_counterparty_id: counterpartyId }),
  ]);

  if (stateRes.error) throw stateRes.error;
  if (warningsRes.error) throw warningsRes.error;

  return {
    isClosed: stateRes.data?.is_closed === true,
    closedAt: stateRes.data?.closed_at || null,
    closeReason: stateRes.data?.close_reason || null,
    warnings: warningsRes.data || [],
  };
}
