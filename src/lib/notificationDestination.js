const PROVIDER_REQUEST_TYPES = new Set([
  'tour_request',
  'new_request',
  'direct_trip_request',
  'tour_request_invite',
  'proposal_pending',
  'proposal_rejected',
  'request_filled',
  'guide_selected',
  'request_cancelled',
  'trip_completed',
]);

const TRAVELER_REQUEST_TYPES = new Set([
  'proposal_received',
  'proposals_ready',
  'direct_request_escalated',
  'trip_booked',
  'trip_cancelled',
]);

/**
 * Keeps notification links within the app's canonical screens.
 * Request alerts intentionally land on the dashboard inbox rather than the
 * standalone email deep-link screen.
 */
export function notificationDestination(notification) {
  if (notification?.type === 'message') {
    return notification.related_user_id ? `/chat/${notification.related_user_id}` : null;
  }

  if (PROVIDER_REQUEST_TYPES.has(notification?.type)) return '/dashboard/requests';

  if (TRAVELER_REQUEST_TYPES.has(notification?.type)) {
    return notification.related_request_id
      ? `/profile/requests/${notification.related_request_id}`
      : '/my-trips';
  }

  return notification?.related_request_id ? '/my-trips' : null;
}
