import { supabase } from '../supabaseClient';

const toDestinationArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const normalizeTripRequest = (trip) => ({
  ...trip,
  destination: toDestinationArray(trip.destination ?? trip.cities),
  goals: Array.isArray(trip.goals)
    ? trip.goals
    : Array.isArray(trip.holiday_types)
      ? trip.holiday_types
      : [],
  proposals_count: Number(trip.proposals_count) || 0,
  max_proposals: Math.max(1, Number(trip.max_proposals) || 5),
  rebroadcast_count: Number(trip.rebroadcast_count) || 0,
});

export async function createTripRequest(travelerId, tripData) {
  const destinations = toDestinationArray(tripData.destination);
  const groupSize = Math.max(1, Number(tripData.groupSize) || 1);

  const { data, error } = await supabase
    .from('trip_requests')
    .insert({
      user_id: travelerId,
      title: tripData.title || null,
      destination: destinations,
      cities: destinations,
      start_date: tripData.dates?.start || null,
      end_date: tripData.dates?.end || null,
      adults: groupSize,
      num_people: groupSize,
      goals: tripData.interests || [],
      holiday_types: tripData.interests || [],
      budget_tier: tripData.budget || null,
      requirements: tripData.notes || null,
      status: 'active',
      proposals_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return normalizeTripRequest(data);
}

export async function getAvailableTripRequests(guideId) {
  // A guide cannot re-apply to a request while the unique
  // (trip_request_id, guide_id) slot row exists, even if it was rejected.
  const { data: mySlots, error: slotsError } = await supabase
    .from('trip_slots')
    .select('trip_request_id')
    .eq('guide_id', guideId);

  if (slotsError) throw slotsError;
  const excludeIds = (mySlots || []).map(slot => slot.trip_request_id);

  let query = supabase
    .from('trip_requests')
    .select('*')
    .in('status', ['open', 'active', 'pending'])
    .order('created_at', { ascending: false });

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data: trips, error } = await query;
  if (error) throw error;
  if (!trips?.length) return [];

  const availableTrips = trips
    .map(normalizeTripRequest)
    .filter(trip => trip.proposals_count < trip.max_proposals);

  const travelerIds = [...new Set(availableTrips.map(trip => trip.user_id).filter(Boolean))];
  let profiles = [];
  if (travelerIds.length > 0) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', travelerIds);
    if (profileError) throw profileError;
    profiles = data || [];
  }

  const profileMap = Object.fromEntries(profiles.map(profile => [profile.id, profile]));
  return availableTrips.map(trip => ({
    ...trip,
    traveler: profileMap[trip.user_id] || null,
  }));
}

export async function getMyTripRequests(travelerId) {
  const { data: trips, error } = await supabase
    .from('trip_requests')
    .select('*')
    .eq('user_id', travelerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!trips?.length) return [];

  const tripIds = trips.map(trip => trip.id);
  const { data: slots, error: slotsError } = await supabase
    .from('trip_slots')
    .select('*')
    .in('trip_request_id', tripIds);
  if (slotsError) throw slotsError;

  const guideIds = [...new Set((slots || []).map(slot => slot.guide_id).filter(Boolean))];
  let guideProfiles = [];
  if (guideIds.length > 0) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', guideIds);
    if (profileError) throw profileError;
    guideProfiles = data || [];
  }

  const guideMap = Object.fromEntries(guideProfiles.map(profile => [profile.id, profile]));
  const slotsByTrip = {};
  (slots || []).forEach(slot => {
    if (!slotsByTrip[slot.trip_request_id]) slotsByTrip[slot.trip_request_id] = [];
    slotsByTrip[slot.trip_request_id].push({
      ...slot,
      guide: guideMap[slot.guide_id] || null,
    });
  });

  return trips.map(trip => ({
    ...normalizeTripRequest(trip),
    slots: slotsByTrip[trip.id] || [],
  }));
}

export async function rejectTripSlot(_guideId, tripRequestId) {
  const { data, error } = await supabase.rpc('guide_reject_trip_slot', {
    request_id: tripRequestId,
  });
  if (error) throw error;
  if (!data) throw new Error('Could not reject this proposal.');
  return data;
}

export async function finalizeTripSlot(_guideId, tripRequestId) {
  const { data, error } = await supabase.rpc('finalize_selected_trip_slot', {
    request_id: tripRequestId,
  });
  if (error) throw error;
  if (!data) throw new Error('Could not finalize this trip request.');
  return data;
}

export async function rebroadcastTripRequest(tripRequestId) {
  const { data, error } = await supabase.rpc('rebroadcast_trip_request', {
    request_id: tripRequestId,
  });
  if (error) throw error;
  if (!data) throw new Error('Could not rebroadcast this trip request.');
  return data;
}
