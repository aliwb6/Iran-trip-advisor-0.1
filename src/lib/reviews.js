export const PUBLIC_REVIEW_COLUMNS =
  'id, profile_id, rating, review_text, title, admin_reply, reviewer_name, created_at';

export function getReviewValidationError({ user, rating, reviewText }) {
  if (!user?.id) return 'You must be signed in to write a review.';

  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return 'Choose a rating between 1 and 5 stars.';
  }

  if (!reviewText?.trim()) return 'Review text is required.';
  return '';
}

export function buildProfileReviewInsert({
  user,
  targetType,
  targetId,
  rating,
  reviewText,
  title = '',
}) {
  const validationError = getReviewValidationError({ user, rating, reviewText });
  if (validationError) throw new Error(validationError);
  if (!targetId) throw new Error('Review target not found.');
  if (targetType !== 'guide' && targetType !== 'agency') {
    throw new Error('Invalid review target type.');
  }

  return {
    profile_id: targetId,
    guide_id: null,
    agency_id: null,
    tour_id: null,
    reviewer_id: user.id,
    rating: Number(rating),
    title: title.trim() || null,
    review_text: reviewText.trim(),
    status: 'pending',
  };
}

export async function fetchApprovedProfileReviews(client, { targetType, profileId }) {
  if (targetType !== 'guide' && targetType !== 'agency') {
    throw new Error('Invalid review target type.');
  }
  if (!profileId) throw new Error('Review target not found.');

  // Public review display must not embed/read raw profiles after profile privacy
  // lockdown. The SECURITY DEFINER RPC exposes only an approved review plus the
  // reviewer's display name; no email, phone, license or other private fields.
  const { data, error } = await client.rpc('get_public_profile_reviews', {
    p_profile_id: profileId,
  });

  if (error) throw error;
  return data || [];
}

export async function fetchProfileReviewsSafely(client, options) {
  try {
    return {
      reviews: await fetchApprovedProfileReviews(client, options),
      error: null,
    };
  } catch (error) {
    return {
      reviews: [],
      error: error?.message || 'Reviews could not be loaded.',
    };
  }
}

export async function submitProfileReview(client, options) {
  const payload = buildProfileReviewInsert({ ...options, targetId: options.profileId });
  const { data, error } = await client
    .from('reviews')
    .insert(payload)
    .select('id, status, profile_id, rating, review_text');

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Review submission was not persisted.');
  }
  if (data.length > 1) {
    throw new Error('Review submission returned multiple records.');
  }
  return data[0];
}

export function buildReviewModerationUpdates({
  decision,
  reviewText,
  reviewedBy,
  reviewedAt = new Date().toISOString(),
}) {
  const trimmedText = reviewText?.trim();
  if (!trimmedText) throw new Error('Review text cannot be empty.');

  if (decision === 'save') return { review_text: trimmedText };
  if (decision !== 'approve' && decision !== 'reject') {
    throw new Error('Invalid review moderation action.');
  }
  if (!reviewedBy) throw new Error('An administrator is required to moderate a review.');

  return {
    review_text: trimmedText,
    status: decision === 'approve' ? 'approved' : 'rejected',
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
  };
}

export async function persistReviewModeration(client, reviewId, updates) {
  const { data, error } = await client
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)
    .select('*');

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Review record not found for moderation.');
  }
  if (data.length > 1) {
    throw new Error('Multiple review records matched the moderation request.');
  }
  return data[0];
}
