import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Loader2, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { canChatWithUser } from '@/api/chatAccess';

export default function PaidChatRoute({ children }) {
  const { guideId } = useParams();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { lang, dir } = useI18n();

  const { data: allowed = false, isLoading, error } = useQuery({
    queryKey: ['paid-chat-access', guideId],
    queryFn: () => canChatWithUser(guideId),
    enabled: Boolean(isAuthenticated && !isLoadingAuth && guideId),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
      </div>
    );
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
    const title = lang === 'fa'
      ? 'چت هنوز قفل است'
      : lang === 'ar'
        ? 'المحادثة ما زالت مقفلة'
        : 'Chat is still locked';
    const copy = lang === 'fa'
      ? 'چت دوطرفه فقط بعد از تأیید رزرو توسط راهنما/آژانس و تأیید امن پرداخت ۱۵٪ بیعانه فعال می‌شود.'
      : lang === 'ar'
        ? 'تُفتح المحادثة الثنائية فقط بعد تأكيد الحجز من المرشد/الوكالة وتأكيد دفع عربون 15٪ بشكل آمن.'
        : 'Two-way chat unlocks only after the guide or agency confirms the booking and the 15% deposit is securely confirmed.';
    const action = lang === 'fa' ? 'رفتن به درخواست‌های سفر' : lang === 'ar' ? 'الذهاب إلى طلبات السفر' : 'Go to travel requests';

    return (
      <div dir={dir} className="min-h-screen bg-background px-5 py-24 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-heading text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy}</p>
          <a
            href="/profile/requests"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            <CreditCard className="h-4 w-4" />
            {action}
          </a>
        </div>
      </div>
    );
  }

  return children;
}
