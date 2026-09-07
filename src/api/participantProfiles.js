import { supabase } from '../supabaseClient';

export const PARTICIPANT_PROFILE_FIELDS = [
  'id',
  'full_name',
  'avatar_url',
  'gender',
  'role',
  'city',
  'bio',
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
