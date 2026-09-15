import { supabase } from '@/supabaseClient';

export async function fetchChatModeration(counterpartyId, currentUserId) {
  if (!counterpartyId || !currentUserId || counterpartyId === currentUserId) {
    return { isClosed: false, closedAt: null, closeReason: null, warnings: [] };
  }

  const [participantA, participantB] = [counterpartyId, currentUserId].sort();
  const [controlRes, warningsRes] = await Promise.all([
    supabase
      .from('chat_moderation_threads')
      .select('is_closed, closed_at, close_reason')
      .eq('participant_a', participantA)
      .eq('participant_b', participantB)
      .maybeSingle(),
    supabase
      .from('chat_moderation_warnings')
      .select('id, target_user_id, reason_code, message, created_at')
      .eq('participant_a', participantA)
      .eq('participant_b', participantB)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (controlRes.error) throw controlRes.error;
  if (warningsRes.error) throw warningsRes.error;

  return {
    isClosed: controlRes.data?.is_closed === true,
    closedAt: controlRes.data?.closed_at || null,
    closeReason: controlRes.data?.close_reason || null,
    warnings: warningsRes.data || [],
  };
}
