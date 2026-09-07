import { supabase } from '../supabaseClient';

// ── Guide: fetch all open requests this guide hasn't applied to yet ───────────

export async function fetchAvailableRequests(guideId) {
  // Find all slots for this guide (to know which they applied to + their slot data)
  const { data: mySlots } = await supabase
    .from('trip_slots')
    .select('trip_request_id, id, status, price, price_type, price_period, accepted_at')
    .eq('guide_id', guideId);

  const mySlotMap = {};
  (mySlots || []).forEach(s => { mySlotMap[s.trip_request_id] = s; });
  const excludeIds = Object.keys(mySlotMap);

  let query = supabase
    .from('trip_requests')
    .select('*')
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false });

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return [];

  return data
    .map(r => ({
      ...r,
      accepted_count: r.proposals_count || 0,
      max_proposals: r.max_proposals || 5,
      my_slot: mySlotMap[r.id] || null,
    }))
    .filter(r => r.accepted_count < r.max_proposals);
}

// ── Guide: fetch requests this guide already submitted proposals for ───────────

export async function fetchMyAcceptedRequests(guideId) {
  const { data: slots, error: sErr } = await supabase
    .from('trip_slots')
    .select('id, status, accepted_at, finalized_at, trip_request_id, price, currency, price_type, price_period, itinerary, message')
    .eq('guide_id', guideId)
    .order('accepted_at', { ascending: false });

  if (sErr) throw sErr;
  if (!slots?.length) return [];

  const reqIds = slots.map(s => s.trip_request_id);
  const { data: requests, error: rErr } = await supabase
    .from('trip_requests')
    .select('id, destination, start_date, end_date, adults, children, status')
    .in('id', reqIds);

  if (rErr) throw rErr;

  const reqMap = Object.fromEntries((requests || []).map(r => [r.id, r]));
  return slots.map(slot => ({ ...slot, request: reqMap[slot.trip_request_id] || null }));
}

// ── Guide: submit a full proposal ────────────────────────────────────────────

export async function guideSubmitProposal(guideId, requestId, proposal) {
  // The database trigger is authoritative for request state, eligibility, and cap.
  // This check is only a fast UX guard against submitting the same proposal twice.
  const { data: mine } = await supabase
    .from('trip_slots')
    .select('id, status')
    .eq('trip_request_id', requestId)
    .eq('guide_id', guideId)
    .maybeSingle();
  if (mine) {
    throw new Error('You have already submitted a proposal for this request.');
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
