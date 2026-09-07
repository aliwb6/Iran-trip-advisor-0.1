import { supabase } from '../supabaseClient';

// This API is the only authenticated cross-user profile lookup. Keep its
// client-side shape aligned with the server RPC's deliberately safe fields.
export const PARTICIPANT_PROFILE_FIELDS = [
  'id', 'full_name', 'avatar_url', 'gender', 'role', 'city', 'bio',
];

const normalizeParticipantProfile = (profile) => Object.fromEntries(
  PARTICIPANT_PROFILE_FIELDS.map(field => [field, profile?.[field] ?? null])
);

export async function fetchParticipantProfiles(profileIds) {
  const ids = [...new Set((profileIds || []).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase.rpc('get_participant_profiles', {
    profile_ids: ids,
  });
  if (error) throw error;
  return (data || []).map(normalizeParticipantProfile);
}

export async function fetchParticipantProfile(profileId) {
  if (!profileId) return null;
  const profiles = await fetchParticipantProfiles([profileId]);
  return profiles.find(profile => profile.id === profileId) || null;
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
