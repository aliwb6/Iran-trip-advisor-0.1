export function normalizeExternalImageUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new TypeError('Enter an image URL.');
  }

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new TypeError('Enter a valid image URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('Image URLs must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new TypeError('Image URLs must not contain credentials.');
  }

  return url.toString();
}
