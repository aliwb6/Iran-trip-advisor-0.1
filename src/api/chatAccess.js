import { supabase } from '@/supabaseClient';

export async function canChatWithUser(counterpartyId) {
  if (!counterpartyId) return false;

  const { data, error } = await supabase.rpc('can_chat_with_user', {
    p_counterparty_id: counterpartyId,
  });

  if (error) throw error;
  return data === true;
}
