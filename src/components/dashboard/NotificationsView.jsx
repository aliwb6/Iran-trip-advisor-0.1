import { useState, useEffect, useCallback } from 'react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { Bell, CheckCheck, RefreshCw, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { fetchNotifications, markNotificationRead } from '@/api/tourRequestFlow';
import { notificationDestination } from '@/lib/notificationDestination';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG = {
  new_request:     { dot: 'bg-blue-400',               label: 'New Request' },
  tour_request:    { dot: 'bg-blue-400',               label: 'New Request' },
  direct_trip_request: { dot: 'bg-blue-400',           label: 'Direct Request' },
  message:         { dot: 'bg-violet-400',             label: 'New Message' },
  proposals_ready: { dot: 'bg-violet-400',             label: 'Guides Ready' },
  guide_selected:  { dot: 'bg-emerald-400',            label: 'Selected! 🎉' },
  request_filled:  { dot: 'bg-white/30',               label: 'Not selected' },
  info:            { dot: 'bg-[hsl(178,85%,45%)]',     label: 'Info' },
};

function NotifCard({ notif, onMarkRead, onNavigate }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => {
        if (!notif.is_read) onMarkRead(notif.id);
        const destination = notificationDestination(notif);
        if (destination) onNavigate(destination);
      }}
      className={`w-full text-left rounded-2xl border p-4 transition-colors ${
        notif.is_read
          ? 'bg-[hsl(222,45%,14%)] border-white/[0.06] hover:border-white/[0.12]'
          : 'bg-[hsl(222,45%,16%)] border-[hsl(178,85%,45%)]/20 hover:border-[hsl(178,85%,45%)]/35'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${notif.is_read ? 'bg-white/15' : cfg.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className={`font-body text-[10px] font-semibold uppercase tracking-wider ${
              notif.is_read ? 'text-white/30' : 'text-[hsl(178,85%,55%)]'
            }`}>
              {cfg.label}
            </span>
            <span className="font-body text-[10px] text-white/30 shrink-0">{timeAgo(notif.created_at)}</span>
          </div>
          <p className="font-body text-xs text-white/70 leading-relaxed">{notif.message}</p>
          {notificationDestination(notif) && (
            <p className="font-body text-[10px] text-white/30 mt-1 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {notif.type === 'message' ? 'Tap to open chat' : 'Tap to view request'}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default function NotificationsView({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel(`notifs_dashboard_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => markNotificationRead(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayed = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Notifications</h2>
          <p className="text-white/40 text-xs mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs transition"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs transition disabled:opacity-40"
          >
            {loading ? <BreathingGlow className="w-3 h-3" label="Refreshing notifications" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-white/[0.05] rounded-xl p-1 mb-6 w-fit gap-1">
        {[
          { id: 'all', label: 'All', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              filter === tab.id
                ? 'bg-[hsl(178,85%,32%)] text-white shadow'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                filter === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[16rem] items-center justify-center">
          <BreathingGlow label="Loading notifications" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/50 font-medium text-sm mb-1">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-white/30 text-xs max-w-xs">
            {filter === 'unread'
              ? 'Switch to "All" to see your notification history.'
              : 'New trip requests and updates will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {displayed.map(notif => (
              <NotifCard
                key={notif.id}
                notif={notif}
                onMarkRead={handleMarkRead}
                onNavigate={navigate}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
