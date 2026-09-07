import { supabase } from '../supabaseClient';

const uniqueProfileIds = (ids) => [...new Set((ids || []).filter(Boolean))];

export async function fetchParticipantProfiles(ids) {
  const profileIds = uniqueProfileIds(ids);
  if (profileIds.length === 0) return [];

  const { data, error } = await supabase.rpc('get_participant_profiles', {
    profile_ids: profileIds,
  });

  if (error) throw error;
  return data || [];
}

export async function fetchParticipantProfile(id) {
  if (!id) return null;
  const rows = await fetchParticipantProfiles([id]);
  return rows.find(profile => profile.id === id) || null;
}

export async function resolveTourRequestRecipient(tourId) {
  if (!tourId) return null;

  const { data, error } = await supabase.rpc('resolve_tour_request_recipient', {
    p_tour_id: tourId,
  });

  if (error) throw error;
  return data || null;
}

export async function fetchReleasedBookingContact(bookingId) {
  if (!bookingId) return null;

  const { data, error } = await supabase.rpc('get_booking_contact_details', {
    p_booking_id: bookingId,
  });

  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
