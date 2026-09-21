import { Bell, BookOpen, CheckCheck, Clock3, MessageSquare, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { useNotificationsContext } from '@/lib/NotificationsContext';

const EVENT_CONFIG = {
  admin_article_submitted: { label: 'Article awaiting review', Icon: BookOpen, section: 'articles' },
  admin_provider_registered: { label: 'New provider', Icon: UserPlus, section: 'guides' },
  admin_chat_started: { label: 'New chat', Icon: MessageSquare, section: 'chats' },
  admin_tour_submitted: { label: 'New tour', Icon: Clock3, section: 'pending' },
  admin_trip_request_created: { label: 'New trip request', Icon: Clock3, section: 'overview' },
  admin_proposal_submitted: { label: 'New proposal', Icon: Clock3, section: 'proposals' },
  admin_review_submitted: { label: 'New review', Icon: Clock3, section: 'comments' },
  admin_booking_created: { label: 'New booking', Icon: ShieldCheck, section: 'overview' },
};

function timeAgo(value) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminNotificationsView({ onNavigate }) {
  const { notifications, unreadCount, loading, markAllRead, markOneRead, refresh } = useNotificationsContext();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Notifications</h2>
          <p className="mt-1 text-xs text-white/40">
            {unreadCount ? `${unreadCount} unread events need your attention` : 'You are all caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/65 transition hover:border-white/20 hover:text-white">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
          <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/65 transition hover:border-white/20 hover:text-white disabled:opacity-40">
            {loading ? <BreathingGlow className="h-3.5 w-3.5" label="Refreshing notifications" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </button>
        </div>
      </div>

      {!notifications.length && !loading ? (
        <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[hsl(222,45%,14%)] px-4 py-20 text-center">
          <Bell className="mb-4 h-8 w-8 text-white/20" />
          <p className="text-sm font-medium text-white/55">No notifications yet</p>
          <p className="mt-1 max-w-xs text-xs text-white/30">New activity across the platform will appear here in real time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = EVENT_CONFIG[notification.type] || { label: 'Platform activity', Icon: Bell, section: 'overview' };
            const Icon = config.Icon;
            return (
              <button
                key={notification.id}
                onClick={() => {
                  if (!notification.is_read) markOneRead(notification.id);
                  onNavigate(config.section);
                }}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  notification.is_read
                    ? 'border-white/[0.06] bg-[hsl(222,45%,14%)] hover:border-white/[0.13]'
                    : 'border-teal-400/25 bg-[hsl(222,45%,16%)] hover:border-teal-300/45'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notification.is_read ? 'bg-white/[0.06] text-white/35' : 'bg-teal-400/10 text-teal-300'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${notification.is_read ? 'text-white/35' : 'text-teal-300'}`}>{config.label}</span>
                      <span className="shrink-0 text-[10px] text-white/30">{timeAgo(notification.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-white/75">{notification.message}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
