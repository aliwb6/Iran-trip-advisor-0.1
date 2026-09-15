import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { canChatWithUser } from '@/api/chatAccess';

export default function ChatRelationshipRoute({ children }) {
  const { guideId } = useParams();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { lang, dir } = useI18n();

  const { data: allowed = false, isLoading, error } = useQuery({
    queryKey: ['chat-relationship-access', guideId],
    queryFn: () => canChatWithUser(guideId),
    enabled: Boolean(isAuthenticated && !isLoadingAuth && guideId),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          {lang === 'fa' ? 'در حال بررسی دسترسی چت…' : lang === 'ar' ? 'جارٍ التحقق من صلاحية المحادثة…' : 'Checking chat access…'}
        </div>
      </div>
    );
  }

  if (!allowed || error) {
    const title = lang === 'fa' ? 'هنوز گفت‌وگویی ایجاد نشده' : lang === 'ar' ? 'لم تبدأ المحادثة بعد' : 'Chat is not available yet';
    const copy = lang === 'fa'
      ? 'پس از ایجاد درخواست مستقیم، درخواست تور یا ارسال پروپوزال، چت داخل سایت فعال می‌شود. برای شروع لازم نیست پرداخت انجام شده باشد.'
      : lang === 'ar'
        ? 'تتاح المحادثة داخل الموقع بعد إنشاء طلب مباشر أو طلب جولة أو إرسال عرض. لا يلزم الدفع لبدء المحادثة.'
        : 'Chat becomes available after a direct request, tour request, or proposal relationship exists. Payment is not required to start chatting.';
    const action = lang === 'fa' ? 'مشاهده درخواست‌ها' : lang === 'ar' ? 'عرض الطلبات' : 'View requests';

    return (
      <div dir={dir} className="min-h-screen bg-background px-5 py-24 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-heading text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy}</p>
          <a href="/profile/requests" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
            <MessageCircle className="h-4 w-4" />
            {action}
          </a>
        </div>
      </div>
    );
  }

  return children;
}
