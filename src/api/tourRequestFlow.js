import { supabase } from '../supabaseClient';

const OPEN_REQUEST_STATUSES = ['active', 'pending', 'open'];
const FILLED_REQUEST_STATUSES = ['confirmed', 'booked', 'completed'];

const isExpired = (expiresAt) => Boolean(
  expiresAt && new Date(expiresAt).getTime() <= Date.now()
);

const normalizeRequest = (request) => ({
  ...request,
  proposal_round: Math.max(1, Number(request.proposal_round) || 1),
  accepted_count: Number(request.proposals_count) || 0,
  max_proposals: Math.max(1, Number(request.max_proposals) || 5),
});

// ── Guide: fetch active invitations plus requests that were filled by another provider ──

export async function fetchAvailableRequests(guideId) {
  const { data: dispatches, error: dispatchError } = await supabase
    .from('trip_request_dispatches')
    .select('proposal_round, status, expires_at, invited_at, trip_request:trip_requests!inner(*)')
    .eq('provider_id', guideId)
    .in('status', ['pending', 'expired'])
    .in('trip_request.status', [...OPEN_REQUEST_STATUSES, ...FILLED_REQUEST_STATUSES])
    .order('invited_at', { ascending: false });

  if (dispatchError) throw dispatchError;

  // Direct-profile requests are private to their target before escalation and do
  // not have a marketplace dispatch row yet, so preserve that inbox path.
  const { data: directRequests, error: directError } = await supabase
    .from('trip_requests')
    .select('*, source_tour:tours!source_tour_id(id, slug, title, description, itinerary, duration, price, price_usd, price_from, cities, city, location, included, excluded, not_included, image_url, gallery, tour_type)')
    .eq('request_channel', 'direct_profile')
    .eq('direct_provider_id', guideId)
    .is('direct_escalated_at', null)
    .in('status', OPEN_REQUEST_STATUSES)
    .order('created_at', { ascending: false });

  if (directError) throw directError;

  const requestMap = new Map();

  (dispatches || []).forEach((dispatch) => {
    if (!dispatch.trip_request) return;
    const request = normalizeRequest(dispatch.trip_request);
    const dispatchRound = Math.max(1, Number(dispatch.proposal_round) || 1);
    if (dispatchRound !== request.proposal_round) return;

    const filledByAnother = Boolean(
      request.selected_guide_id &&
      request.selected_guide_id !== guideId &&
      FILLED_REQUEST_STATUSES.includes(request.status)
    );
    const actionable = Boolean(
      OPEN_REQUEST_STATUSES.includes(request.status) &&
      dispatch.status === 'pending' &&
      !isExpired(dispatch.expires_at) &&
      !isExpired(request.expires_at)
    );

    // A timed-out invitation must not reappear as actionable just because the
    // parent request is still open. Keep only live invitations or filled history.
    if (!actionable && !filledByAnother) return;

    requestMap.set(request.id, {
      ...request,
      dispatch_status: dispatch.status,
      dispatch_expires_at: dispatch.expires_at,
      provider_request_state: filledByAnother ? 'expired' : 'available',
    });
  });

  (directRequests || []).forEach((rawRequest) => {
    const request = normalizeRequest(rawRequest);
    if (isExpired(request.expires_at)) return;
    if (!requestMap.has(request.id)) {
      requestMap.set(request.id, {
        ...request,
        dispatch_status: 'direct',
        provider_request_state: 'available',
      });
    }
  });

  const requests = [...requestMap.values()];
  if (!requests.length) return [];

  const requestIds = requests.map(request => request.id);
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

  return requests
    .map(request => ({
      ...request,
      my_slot: mySlotMap[`${request.id}:${request.proposal_round}`] || null,
    }))
    .filter(request => {
      if (request.my_slot) return false;
      if (request.provider_request_state === 'expired') return true;
      return request.accepted_count < request.max_proposals;
    });
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
    .select('id, destination, start_date, end_date, adults, children, status, selected_guide_id, proposal_round, expires_at')
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
  const { data: request, error: requestError } = await supabase
    .from('trip_requests')
    .select('proposal_round, status, expires_at')
    .eq('id', requestId)
    .single();

  if (requestError) throw requestError;
  if (isExpired(request?.expires_at)) {
    throw new Error('This trip request has expired.');
  }

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
    if (/expired/i.test(error.message || '')) {
      throw new Error('This trip request has expired.');
    }
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

export async function declinePackageTripRequest(requestId) {
  const { data, error } = await supabase.rpc('decline_package_trip_request', {
    request_id: requestId,
  });
  if (error) throw error;
  if (!data) throw new Error('This package request can no longer be declined.');
  return data;
}

// ── Guide: confirm the traveler-selected proposal as a booked trip ───────────

export async function guideConfirmBooking(requestId) {
  const { data, error } = await supabase.rpc('finalize_selected_trip_slot', {
    request_id: requestId,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not confirm this booking.');
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
