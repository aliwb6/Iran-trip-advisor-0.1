import { supabase } from '../supabaseClient';

const toDestinationArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const toCanonicalTrip = (trip) => {
  const destinations = toDestinationArray(trip.destination ?? trip.cities);
  return {
    ...trip,
    destinations,
    // Temporary compatibility aliases for legacy page presentation only.
    // All database reads/writes in this module use canonical columns.
    destination: destinations.join(', '),
    travel_dates: {
      start: trip.start_date ?? null,
      end: trip.end_date ?? null,
    },
    interests: trip.goals ?? trip.holiday_types ?? [],
    group_size: trip.adults ?? trip.num_people ?? 1,
    budget_range: trip.budget_tier ?? null,
    notes: trip.requirements ?? null,
    slot_count: trip.proposals_count ?? 0,
    broadcast_count: trip.rebroadcast_count ?? 0,
  };
};

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
  return toCanonicalTrip(data);
}

export async function getAvailableTripRequests(guideId) {
  const { data: mySlots, error: slotsError } = await supabase
    .from('trip_slots')
    .select('trip_request_id')
    .eq('guide_id', guideId)
    .neq('status', 'rejected');

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

  const availableTrips = trips.filter(trip => (
    (trip.proposals_count ?? 0) < (trip.max_proposals ?? 5)
  ));

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
    ...toCanonicalTrip(trip),
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
    ...toCanonicalTrip(trip),
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
