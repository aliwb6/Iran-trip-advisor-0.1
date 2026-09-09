import { supabase } from '@/supabaseClient';

const PUBLIC_LICENSE_URL_TTL_SECONDS = 10 * 60;

export function isPdfLicensePath(path) {
  return typeof path === 'string' && /\.pdf$/i.test(path.split('?')[0]);
}

// `public_license_path` is produced only by the allowlisted public-profile RPC.
// The private bucket policy independently verifies the same eligibility rules
// before it will sign the object URL.
export async function resolvePublicLicenseUrl(publicLicensePath) {
  if (typeof publicLicensePath !== 'string' || !publicLicensePath.trim()) {
    return { signedUrl: null, error: null };
  }

  const { data, error } = await supabase.storage
    .from('licenses')
    .createSignedUrl(publicLicensePath, PUBLIC_LICENSE_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return { signedUrl: null, error: error || new Error('License preview is unavailable.') };
  }

  return { signedUrl: data.signedUrl, error: null };
}
