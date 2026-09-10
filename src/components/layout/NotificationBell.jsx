import { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationsContext } from '@/lib/NotificationsContext';
import { useAuth } from '@/lib/AuthContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_CONFIG = {
  info:              { label: 'Info',            color: 'bg-blue-500/10 text-blue-500' },
  success:           { label: 'Success',         color: 'bg-emerald-500/10 text-emerald-500' },
  warning:           { label: 'Warning',         color: 'bg-amber-500/10 text-amber-500' },
  request:           { label: 'Request',         color: 'bg-accent/10 text-accent' },
  tour_request:      { label: 'Trip Request',    color: 'bg-blue-500/10 text-blue-500' },
  new_request:       { label: 'Trip Request',    color: 'bg-blue-500/10 text-blue-500' },
  proposal_received: { label: 'New Proposal',    color: 'bg-violet-500/10 text-violet-500' },
  proposals_ready:   { label: 'Proposals Ready', color: 'bg-violet-500/10 text-violet-500' },
  guide_selected:    { label: 'Selected',        color: 'bg-emerald-500/10 text-emerald-500' },
  request_filled:    { label: 'Trip Update',     color: 'bg-muted text-muted-foreground' },
  message:           { label: 'Message',         color: 'bg-violet-500/10 text-violet-500' },
};

function notificationDestination(notification) {
  const requestId = notification.related_request_id;
  if (!requestId) return null;

  if (notification.type === 'proposal_received' || notification.type === 'proposals_ready') {
    return `/profile/requests/${requestId}`;
  }

  if (notification.type === 'tour_request' || notification.type === 'new_request') {
    return `/dashboard/requests/${requestId}`;
  }

  return null;
}

export default function NotificationBell({ isLight }) {
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markAllRead, markOneRead } = useNotificationsContext();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) await markOneRead(notification.id);
    setOpen(false);

    const destination = notificationDestination(notification);
    if (destination) navigate(destination);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative p-2 rounded-full transition-colors ${
          isLight ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center px-0.5 shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 sm:w-96 bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" />
              <span className="font-heading font-semibold text-sm text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-accent/10 text-accent text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-accent/5"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="text-center py-10 px-4">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            )}
            {!loading && notifications.map((notification) => {
              const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
              const destination = notificationDestination(notification);

              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                    destination ? 'cursor-pointer' : ''
                  } ${!notification.is_read ? 'bg-accent/5' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notification.is_read ? 'bg-accent' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notification.created_at)}</p>
                  </div>
                  {!notification.is_read && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        markOneRead(notification.id);
                      }}
                      className="p-1 rounded-full hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors shrink-0 mt-0.5"
                      aria-label="Mark notification as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
