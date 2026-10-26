import IconSwap from '@/components/ui/IconSwap';
import { useState, useEffect, useCallback } from 'react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { Bell, CheckCheck, RefreshCw, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { fetchNotifications, markNotificationRead } from '@/api/tourRequestFlow';
import { notificationDestination } from '@/lib/notificationDestination';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

function timeAgo(dateStr, lang) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return localize(lang, 'Just now', 'همین حالا', 'الآن');
  if (mins < 60) return localize(lang, `${mins}m ago`, `${mins} دقیقه پیش`, `منذ ${mins} دقيقة`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return localize(lang, `${hours}h ago`, `${hours} ساعت پیش`, `منذ ${hours} ساعة`);
  const days = Math.floor(hours / 24);
  if (days < 7) return localize(lang, `${days}d ago`, `${days} روز پیش`, `قبل ${days} يوم`);
  return new Date(dateStr).toLocaleDateString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG = {
  new_request:     { dot: 'bg-blue-400',               label: 'New Request' },
  tour_request:    { dot: 'bg-blue-400',               label: 'New Request' },
  direct_trip_request: { dot: 'bg-blue-400',           label: 'Direct Request' },
  message:         { dot: 'bg-violet-400',             label: 'New Message' },
  proposals_ready: { dot: 'bg-violet-400',             label: 'Guides Ready' },
  guide_selected:  { dot: 'bg-emerald-400',            label: 'Selected! 🎉' },
  request_filled:  { dot: 'bg-muted',               label: 'Not selected' },
  info:            { dot: 'bg-[hsl(178,85%,45%)]',     label: 'Info' },
};

function NotifCard({ notif, onMarkRead, onNavigate }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
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
          ? 'bg-card border-border hover:border-accent/30'
          : 'bg-card border-[hsl(178,85%,45%)]/20 hover:border-[hsl(178,85%,45%)]/35'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${notif.is_read ? 'bg-muted' : cfg.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className={`font-body text-[10px] font-semibold uppercase tracking-wider ${
              notif.is_read ? 'text-muted-foreground' : 'text-accent'
            }`}>
              {({ new_request: l('New Request', 'درخواست جدید', 'طلب جديد'), tour_request: l('New Request', 'درخواست جدید', 'طلب جديد'), direct_trip_request: l('Direct Request', 'درخواست مستقیم', 'طلب مباشر'), message: l('New Message', 'پیام جدید', 'رسالة جديدة'), proposals_ready: l('Guides Ready', 'راهنماها آماده‌اند', 'المرشدون جاهزون'), guide_selected: l('Selected! 🎉', 'انتخاب شدید! 🎉', 'تم اختيارك! 🎉'), request_filled: l('Not selected', 'انتخاب نشدید', 'لم يتم اختيارك'), info: l('Info', 'اطلاع‌رسانی', 'معلومة') })[notif.type] || cfg.label}
            </span>
            <span className="font-body text-[10px] text-muted-foreground shrink-0">{timeAgo(notif.created_at, lang)}</span>
          </div>
          <p className="font-body text-xs text-foreground/80 leading-relaxed">{notif.message}</p>
          {notificationDestination(notif) && (
            <p className="font-body text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {notif.type === 'message' ? l('Tap to open chat', 'برای باز کردن گفتگو بزنید', 'اضغط لفتح المحادثة') : l('Tap to view request', 'برای دیدن درخواست بزنید', 'اضغط لعرض الطلب')}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default function NotificationsView({ userId }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
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
          <h2 className="text-foreground font-bold text-xl">{l('Notifications', 'اعلان‌ها', 'الإشعارات')}</h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {unreadCount > 0 ? l(`${unreadCount} unread`, `${unreadCount} خوانده‌نشده`, `غير المقروءة: ${unreadCount}`) : l('All caught up', 'همهٔ اعلان‌ها را دیده‌اید', 'اطّلعت على جميع الإشعارات')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 text-xs transition"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {l('Mark all read', 'علامت‌گذاری همه به‌عنوان خوانده‌شده', 'تحديد الكل كمقروء')}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 text-xs transition disabled:opacity-40"
          >
            {<IconSwap active={loading} a={<RefreshCw className="w-3 h-3" />} b={<BreathingGlow className="w-3 h-3" label={l('Refreshing notifications', 'در حال تازه‌سازی اعلان‌ها', 'جارٍ تحديث الإشعارات')} />} keepMounted={false} />}
            {l('Refresh', 'تازه‌سازی', 'تحديث')}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-card rounded-xl p-1 mb-6 w-fit gap-1">
        {[
          { id: 'all', label: l('All', 'همه', 'الكل'), count: notifications.length },
          { id: 'unread', label: l('Unread', 'خوانده‌نشده', 'غير المقروءة'), count: unreadCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              filter === tab.id
                ? 'bg-[hsl(178,85%,32%)] text-white shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                filter === tab.id ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
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
          <BreathingGlow label={l('Loading notifications', 'در حال بارگذاری اعلان‌ها', 'جارٍ تحميل الإشعارات')} />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium text-sm mb-1">
            {filter === 'unread' ? l('No unread notifications', 'اعلان خوانده‌نشده‌ای ندارید', 'لا توجد إشعارات غير مقروءة') : l('No notifications yet', 'هنوز اعلانی ندارید', 'لا توجد إشعارات بعد')}
          </p>
          <p className="text-muted-foreground text-xs max-w-xs">
            {filter === 'unread'
              ? l('Switch to "All" to see your notification history.', 'برای دیدن سابقهٔ اعلان‌ها، «همه» را انتخاب کنید.', 'اختر «الكل» لعرض سجل إشعاراتك.')
              : l('New trip requests and updates will appear here.', 'درخواست‌های سفر و به‌روزرسانی‌های جدید اینجا نمایش داده می‌شوند.', 'ستظهر هنا طلبات الرحلات والتحديثات الجديدة.')}
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
