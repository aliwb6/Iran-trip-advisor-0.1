const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const hasListValue = (value) => {
  if (Array.isArray(value)) return value.some(item => hasText(String(item)));
  return hasText(value);
};

export function getRequiredGuideApprovalItems(profile) {
  const hasTourTypes = hasListValue(profile?.tour_types)
    || hasListValue(profile?.specialties)
    || hasText(profile?.specialty);

  return [
    { label: 'full_name', ok: hasText(profile?.full_name) },
    { label: 'email', ok: hasText(profile?.email) },
    { label: 'phone', ok: hasText(profile?.phone) },
    { label: 'city', ok: hasText(profile?.city) },
    { label: 'languages', ok: hasListValue(profile?.languages) },
    { label: profile?.role === 'agency' ? 'tour_types' : 'specialty', ok: hasTourTypes },
    { label: 'bio', ok: hasText(profile?.bio) },
    { label: 'license_url', ok: hasText(profile?.license_url) },
  ];
}

export function checkProfileCompletion(profile) {
  if (!profile || (profile.role !== 'guide' && profile.role !== 'agency')) {
    return { completed: false, items: [], percentage: 0, passed: 0, total: 0 };
  }

  const items = getRequiredGuideApprovalItems(profile);
  const passed = items.filter(item => item.ok).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  const completed = passed === total;

  return { completed, items, percentage, passed, total };
}

export function getGuideApprovalEligibility(profile, { submitting = false } = {}) {
  const completion = checkProfileCompletion(profile);
  return {
    ...completion,
    hasRequiredProfileFields: completion.completed,
    canApprove: completion.completed && !profile?.is_approved && !submitting,
  };
}

export function getGuideReviewValidationError({ decision, profile, rejectionReason = '', submitting = false }) {
  if (decision === 'reject' && !rejectionReason.trim()) {
    return 'A rejection reason is required.';
  }

  if (decision !== 'approve') return '';

  const eligibility = getGuideApprovalEligibility(profile, { submitting });
  if (profile?.is_approved) return 'This profile is already approved.';
  if (submitting) return 'This profile review is already being submitted.';
  if (!eligibility.completed) {
    const license = eligibility.items.find(item => item.label === 'license_url');
    return license && !license.ok
      ? 'A license document must be uploaded before approval.'
      : 'All required profile fields must be completed before approval.';
  }

  return '';
}

export function buildGuideReviewUpdates({ guide, form, parsedTourTypes, decision, rejectionReason, reviewedAt }) {
  const profileFields = { ...form };
  delete profileFields.tourTypes;
  return {
    ...profileFields,
    license_status: decision === 'approve'
      ? 'verified'
      : decision === 'reject'
        ? 'rejected'
        : profileFields.license_status,
    specialty: parsedTourTypes[0] || null,
    ...(guide.role === 'agency' ? { tour_types: parsedTourTypes } : { specialties: parsedTourTypes }),
    is_approved: decision === 'approve' ? true : decision === 'reject' ? false : guide.is_approved,
    is_rejected: decision === 'approve' ? false : decision === 'reject' ? true : Boolean(guide.is_rejected),
    is_published: decision === 'approve' ? true : decision === 'reject' ? false : Boolean(guide.is_published),
    approval_rejection_reason: decision === 'approve'
      ? null
      : decision === 'reject'
        ? rejectionReason.trim()
        : guide.approval_rejection_reason || null,
    approval_reviewed_at: decision === 'save'
      ? guide.approval_reviewed_at || null
      : reviewedAt,
  };
}

export async function persistGuideReview(client, guideId, updates) {
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', guideId)
    .select('id, full_name, email, phone, city, bio, languages, avatar_url, role, specialty, specialties, tour_types, license_url, license_status, is_approved, is_rejected, is_published, approval_rejection_reason, approval_reviewed_at');

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Profile record not found for moderation.');
  }
  if (data.length > 1) {
    throw new Error('Multiple profile records matched one moderation ID.');
  }
  return data[0];
}
