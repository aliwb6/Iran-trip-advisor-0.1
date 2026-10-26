import IconSwap from '@/components/ui/IconSwap';
import { Bell, BookOpen, CheckCheck, Clock3, MessageSquare, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { useNotificationsContext } from '@/lib/NotificationsContext';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

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

function timeAgo(value, lang) {
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return l('Just now', 'همین حالا', 'الآن');
  if (minutes < 60) return l(`${minutes}m ago`, `${minutes} دقیقه پیش`, `قبل ${minutes} دقيقة`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return l(`${hours}h ago`, `${hours} ساعت پیش`, `قبل ${hours} ساعة`);
  const days = Math.floor(hours / 24);
  return l(`${days}d ago`, `${days} روز پیش`, `قبل ${days} يوم`);
}

export default function AdminNotificationsView({ onNavigate }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const { notifications, unreadCount, loading, markAllRead, markOneRead, refresh } = useNotificationsContext();
  const eventLabel = type => ({
    admin_article_submitted: l('Article awaiting review', 'مقالهٔ در انتظار بررسی', 'مقال قيد المراجعة'),
    admin_provider_registered: l('New provider', 'ارائه‌دهندهٔ جدید', 'مقدّم خدمة جديد'),
    admin_chat_started: l('New chat', 'گفت‌وگوی جدید', 'محادثة جديدة'),
    admin_tour_submitted: l('New tour', 'تور جدید', 'جولة جديدة'),
    admin_trip_request_created: l('New trip request', 'درخواست سفر جدید', 'طلب رحلة جديد'),
    admin_proposal_submitted: l('New proposal', 'پیشنهاد جدید', 'عرض جديد'),
    admin_review_submitted: l('New review', 'دیدگاه جدید', 'تقييم جديد'),
    admin_booking_created: l('New booking', 'رزرو جدید', 'حجز جديد'),
  })[type] || l('Platform activity', 'فعالیت پلتفرم', 'نشاط المنصة');
  const eventMessage = notification => {
    const message = notification.message || '';
    const type = notification.type;
    if (type === 'admin_tour_submitted') {
      const title = message.match(/^A new tour was submitted: (.*)\.$/)?.[1];
      return title ? l(`A new tour was submitted: ${title}.`, `تور جدیدی برای بررسی ارسال شد: ${title}.`, `أُرسلت جولة جديدة للمراجعة: ${title}.`) : message;
    }
    if (type === 'admin_article_submitted') {
      const match = message.match(/^A new article was submitted by a ([^:]+): (.*)\.$/);
      if (match) return l(message, `مقالهٔ جدیدی برای بررسی ارسال شد: ${match[2]}.`, `أُرسل مقال جديد للمراجعة: ${match[2]}.`);
    }
    if (type === 'admin_provider_registered') {
      const match = message.match(/^A new (guide|agency) profile was submitted: (.*)\.$/);
      if (match) return l(message, `پروفایل ${match[1] === 'guide' ? 'راهنما' : 'آژانس'} برای بررسی ارسال شد: ${match[2]}.`, `أُرسل ملف ${match[1] === 'guide' ? 'مرشد' : 'وكالة'} للمراجعة: ${match[2]}.`);
    }
    if (type === 'admin_chat_started') {
      const match = message.match(/^A new chat started between (.*) and (.*)\.$/);
      if (match) return l(message, `گفت‌وگوی جدیدی بین ${match[1]} و ${match[2]} آغاز شد.`, `بدأت محادثة جديدة بين ${match[1]} و${match[2]}.`);
    }
    return ({
      admin_trip_request_created: l(message, 'درخواست سفر جدیدی ثبت شد.', 'أُنشئ طلب رحلة جديد.'),
      admin_proposal_submitted: l(message, 'ارائه‌دهنده‌ای پیشنهاد سفر جدیدی ثبت کرد.', 'قدّم مقدّم خدمة عرضًا جديدًا للرحلة.'),
      admin_review_submitted: l(message, 'دیدگاه جدیدی برای بررسی ارسال شد.', 'أُرسل تقييم جديد للمراجعة.'),
      admin_booking_created: l(message, 'رزرو جدیدی ثبت شد.', 'أُنشئ حجز جديد.'),
    })[type] || message;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">{l('Notifications', 'اعلان‌ها', 'الإشعارات')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {unreadCount ? l(`${unreadCount} unread events need your attention`, `${unreadCount} رویداد خوانده‌نشده به بررسی شما نیاز دارد`, `توجد إشعارات غير مقروءة تحتاج إلى مراجعتك: ${unreadCount}`) : l('You are all caught up', 'همهٔ اعلان‌ها بررسی شده‌اند', 'اطّلعت على جميع الإشعارات')}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-accent/30 hover:text-foreground">
              <CheckCheck className="h-3.5 w-3.5" /> {l('Mark all read', 'علامت‌گذاری همه به‌عنوان خوانده‌شده', 'تحديد الكل كمقروء')}
            </button>
          )}
          <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-accent/30 hover:text-foreground disabled:opacity-40">
            {<IconSwap active={loading} a={<RefreshCw className="h-3.5 w-3.5" />} b={<BreathingGlow className="h-3.5 w-3.5" label={l('Refreshing notifications', 'در حال تازه‌سازی اعلان‌ها', 'جارٍ تحديث الإشعارات')} />} keepMounted={false} />} {l('Refresh', 'تازه‌سازی', 'تحديث')}
          </button>
        </div>
      </div>

      {!notifications.length && !loading ? (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-4 py-20 text-center">
          <Bell className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">{l('No notifications yet', 'هنوز اعلانی ندارید', 'لا توجد إشعارات بعد')}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{l('New activity across the platform will appear here in real time.', 'فعالیت‌های جدید پلتفرم همین‌جا نمایش داده می‌شوند.', 'ستظهر أنشطة المنصة الجديدة هنا فورًا.')}</p>
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
                className={`w-full rounded-2xl border p-4 text-start transition-colors ${
                  notification.is_read
                    ? 'border-border bg-card hover:border-accent/30'
                    : 'border-teal-400/25 bg-card hover:border-teal-300/45'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notification.is_read ? 'bg-muted text-muted-foreground' : 'bg-teal-400/10 text-teal-700'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${notification.is_read ? 'text-muted-foreground' : 'text-teal-700'}`}>{eventLabel(notification.type)}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(notification.created_at, lang)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/80">{eventMessage(notification)}</p>
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
