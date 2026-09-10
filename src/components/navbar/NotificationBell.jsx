import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { fetchNotifications, markNotificationRead } from '@/api/tourRequestFlow';
import { useI18n } from '@/lib/i18n.jsx';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_DOT = {
  // actual table types
  tour_request:    'bg-blue-500',
  direct_trip_request: 'bg-blue-500',
  message:         'bg-violet-500',
  // legacy types kept for backward compat with existing DB rows
  new_request:     'bg-blue-500',
  proposals_ready: 'bg-violet-500',
  guide_selected:  'bg-emerald-500',
  request_filled:  'bg-muted-foreground',
  info:            'bg-accent',
};

export default function NotificationBell({ userId, isLight = false }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { t, dir } = useI18n();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
    } catch {
      // silent — bell is non-critical
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel(`notifs_bell_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, load)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => markNotificationRead(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClickNotif = async (notif) => {
    if (!notif.is_read) await handleMarkRead(notif.id);
    setOpen(false);

    const { type, related_request_id } = notif;

    if (type === 'tour_request' || type === 'new_request' || type === 'direct_trip_request') {
      navigate(related_request_id ? `/dashboard/requests/${related_request_id}` : '/dashboard/requests');
    } else if (type === 'message') {
      // If related_request_id holds the sender's user id, go to that chat thread;
      // otherwise fall back to the dashboard chat section.
      navigate(related_request_id ? `/chat/${related_request_id}` : '/dashboard/chat');
    } else if (type === 'proposals_ready') {
      navigate('/my-trips');
    } else if (related_request_id) {
      navigate('/my-trips');
    }
  };

  return (
    <div className="relative" ref={dropdownRef} dir={dir}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          isLight
            ? 'text-white/70 hover:text-white hover:bg-white/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        }`}
        aria-label={t('notif_title')}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 min-w-[16px] h-4 px-0.5 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute end-0 top-full mt-2 w-80 bg-background border border-border/60 rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="font-body text-sm font-semibold text-foreground">{t('notif_title')}</span>
                {unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 font-body text-xs text-accent hover:text-accent/80 transition px-1.5 py-0.5 rounded-lg hover:bg-accent/10"
                  >
                    <CheckCheck className="w-3 h-3" />
                    {t('notif_mark_all_read')}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[340px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="font-body text-sm text-muted-foreground">{t('notif_empty')}</p>
                  <p className="font-body text-xs text-muted-foreground/60 mt-0.5">
                    {t('notif_empty_sub')}
                  </p>
                </div>
              ) : (
                notifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    className={`w-full text-start px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/40 transition-colors ${
                      !notif.is_read ? 'bg-accent/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        !notif.is_read
                          ? (TYPE_DOT[notif.type] || 'bg-accent')
                          : 'bg-transparent'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-xs text-foreground leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="font-body text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          {timeAgo(notif.created_at)}
                          {notif.related_request_id && (
                            <>
                              <span>·</span>
                              <MapPin className="w-2.5 h-2.5" />
                              <span>{t('notif_view_trip')}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
