import { supabase } from '../supabaseClient';

// ── Guide: fetch all open requests this guide hasn't applied to this round ────

export async function fetchAvailableRequests(guideId) {
  const { data: requests, error: requestError } = await supabase
    .from('trip_requests')
    .select('*')
    .in('status', ['active', 'pending', 'open'])
    .order('created_at', { ascending: false });

  if (requestError) throw requestError;
  if (!requests?.length) return [];

  const normalized = requests.map(request => ({
    ...request,
    proposal_round: Math.max(1, Number(request.proposal_round) || 1),
    accepted_count: Number(request.proposals_count) || 0,
    max_proposals: Math.max(1, Number(request.max_proposals) || 5),
  }));

  const requestIds = normalized.map(request => request.id);
  const { data: mySlots, error: slotError } = await supabase
    .from('trip_slots')
    .select('trip_request_id, id, status, price, price_type, price_period, accepted_at, proposal_round')
    .eq('guide_id', guideId)
    .in('trip_request_id', requestIds);

  if (slotError) throw slotError;

  const mySlotMap = {};
  (mySlots || []).forEach(slot => {
    mySlotMap[`${slot.trip_request_id}:${Number(slot.proposal_round) || 1}`] = slot;
  });

  return normalized
    .map(request => ({
      ...request,
      my_slot: mySlotMap[`${request.id}:${request.proposal_round}`] || null,
    }))
    .filter(request => !request.my_slot && request.accepted_count < request.max_proposals);
}

// ── Guide: fetch requests this guide submitted proposals for this round ───────

export async function fetchMyAcceptedRequests(guideId) {
  const { data: slots, error: sErr } = await supabase
    .from('trip_slots')
    .select('id, status, accepted_at, finalized_at, trip_request_id, price, currency, price_type, price_period, itinerary, message, proposal_round')
    .eq('guide_id', guideId)
    .order('accepted_at', { ascending: false });

  if (sErr) throw sErr;
  if (!slots?.length) return [];

  const reqIds = [...new Set(slots.map(slot => slot.trip_request_id))];
  const { data: requests, error: rErr } = await supabase
    .from('trip_requests')
    .select('id, destination, start_date, end_date, adults, children, status, proposal_round')
    .in('id', reqIds);

  if (rErr) throw rErr;

  const reqMap = Object.fromEntries((requests || []).map(request => [request.id, request]));
  return slots
    .filter(slot => {
      const request = reqMap[slot.trip_request_id];
      if (!request) return false;
      return (Number(slot.proposal_round) || 1) === (Number(request.proposal_round) || 1);
    })
    .map(slot => ({ ...slot, request: reqMap[slot.trip_request_id] }));
}

// ── Guide: submit a full proposal ────────────────────────────────────────────

export async function guideSubmitProposal(guideId, requestId, proposal) {
  // Remote validation/unique constraints are authoritative. This current-round
  // check only gives the guide a faster, clearer duplicate-submission message.
  const { data: request, error: requestError } = await supabase
    .from('trip_requests')
    .select('proposal_round')
    .eq('id', requestId)
    .single();

  if (requestError) throw requestError;
  const proposalRound = Math.max(1, Number(request?.proposal_round) || 1);

  const { data: mine, error: mineError } = await supabase
    .from('trip_slots')
    .select('id, status')
    .eq('trip_request_id', requestId)
    .eq('guide_id', guideId)
    .eq('proposal_round', proposalRound)
    .maybeSingle();

  if (mineError) throw mineError;
  if (mine) {
    throw new Error('You have already submitted a proposal for this request round.');
  }

  const { data, error } = await supabase
    .from('trip_slots')
    .insert({
      trip_request_id: requestId,
      guide_id: guideId,
      ...proposal,
    })
    .select()
    .single();
  if (error) {
    if (/proposal limit|not accepting proposals/i.test(error.message || '')) {
      throw new Error('This request is no longer accepting proposals.');
    }
    if (/trip_slots_request_guide_round_unique|duplicate key/i.test(error.message || '')) {
      throw new Error('You have already submitted a proposal for this request round.');
    }
    throw error;
  }
  return data;
}

// ── Tourist: select a guide atomically through the canonical RPC ──────────────

export async function touristSelectGuide(requestId, selectedGuideId) {
  const { data, error } = await supabase.rpc('select_trip_guide', {
    request_id: requestId,
    selected_guide_id: selectedGuideId,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not select this guide for the trip request.');
  return data;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(notifId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notifId);
}
