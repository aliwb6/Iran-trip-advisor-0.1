import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Loader2, LockKeyhole, MessageCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { fetchPaymentProviderConfig, redirectToDepositCheckout } from '@/api/payments';
import { useI18n } from '@/lib/i18n.jsx';
import BookingContactCard from '@/components/profile/BookingContactCard';

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency || 'USD',
}).format(Number(value) || 0);

const percent = value => Math.round((Number(value) || 0) * 100);

export default function RequestPaymentGate({ requestId, requestStatus }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const [startingPayment, setStartingPayment] = useState(false);
  const shouldLoadBooking = ['confirmed', 'booked', 'completed'].includes(requestStatus);

  const {
    data: booking = null,
    isLoading: bookingLoading,
    error: bookingError,
    refetch: refetchBooking,
  } = useQuery({
    queryKey: ['booking', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, request_id, guide_id, price, currency, deposit_percentage, deposit_amount, balance_due, payment_status, contact_released, status')
        .eq('request_id', requestId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    enabled: Boolean(requestId && shouldLoadBooking),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const { data: paymentConfig = null, isLoading: paymentConfigLoading } = useQuery({
    queryKey: ['payment-provider-config'],
    queryFn: fetchPaymentProviderConfig,
    enabled: shouldLoadBooking,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!booking || !['deposit_pending', 'payment_pending'].includes(booking.payment_status)) return undefined;
    const timer = window.setInterval(() => refetchBooking(), 2000);
    return () => window.clearInterval(timer);
  }, [booking, refetchBooking]);

  if (!shouldLoadBooking) return null;

  const tx = {
    waiting: lang === 'fa'
      ? 'رزرو در حال آماده‌سازی است. چت بعد از ایجاد رابطه درخواست/پروپوزال در دسترس است و پرداخت فقط اطلاعات تماس را آزاد می‌کند.'
      : lang === 'ar'
        ? 'يجري تجهيز الحجز. المحادثة متاحة ضمن علاقة الطلب/العرض، والدفع يفتح معلومات الاتصال فقط.'
        : 'Your booking is being prepared. Chat is available through the request/proposal relationship; payment only unlocks private contact details.',
    paymentRequired: lang === 'fa' ? 'پرداخت بیعانه برای تأیید رزرو و اطلاعات تماس' : lang === 'ar' ? 'دفع العربون لتأكيد الحجز وفتح معلومات الاتصال' : 'Secure the booking and unlock contact details',
    depositCopy: lang === 'fa'
      ? 'می‌توانید همین حالا داخل سایت با راهنما/آژانس چت کنید. با پرداخت بیعانه، اطلاعات تماس خصوصی برای هماهنگی نهایی آزاد می‌شود.'
      : lang === 'ar'
        ? 'يمكنك الدردشة الآن داخل الموقع. بعد دفع العربون ستصبح معلومات الاتصال الخاصة متاحة للتنسيق النهائي.'
        : 'You can keep chatting on the platform now. Paying the booking deposit unlocks private contact details for final coordination.',
    pay: lang === 'fa' ? 'پرداخت بیعانه' : lang === 'ar' ? 'دفع العربون' : 'Pay booking deposit',
    processing: lang === 'fa' ? 'پرداخت در حال تأیید امن است؛ چت همچنان فعال است.' : lang === 'ar' ? 'جارٍ تأكيد الدفع بأمان؛ المحادثة ما زالت متاحة.' : 'Payment is being securely confirmed. Chat remains available.',
    released: lang === 'fa' ? 'پرداخت تأیید شد؛ اطلاعات تماس خصوصی آزاد شده است.' : lang === 'ar' ? 'تم تأكيد الدفع؛ معلومات الاتصال الخاصة متاحة الآن.' : 'Payment confirmed. Private contact details are now available.',
    chat: lang === 'fa' ? 'چت با راهنما / آژانس' : lang === 'ar' ? 'محادثة المرشد / الوكالة' : 'Chat with guide / agency',
    unavailable: lang === 'fa' ? 'پرداخت آنلاین برای این رزرو هنوز در دسترس نیست.' : lang === 'ar' ? 'الدفع الإلكتروني غير متاح لهذا الحجز بعد.' : 'Online payment is not available for this booking yet.',
  };

  if (bookingLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/40 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading booking status…
      </div>
    );
  }

  if (bookingError) {
    return <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{bookingError.message || 'Could not load the booking status.'}</div>;
  }

  if (!booking) {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm leading-relaxed text-foreground/75">{tx.waiting}</p>
      </div>
    );
  }

  const paymentStatus = booking.payment_status || 'unpaid';
  const contactReleased = booking.contact_released === true && ['deposit_paid', 'paid'].includes(paymentStatus);
  const paymentPending = ['deposit_pending', 'payment_pending'].includes(paymentStatus);
  const currency = String(booking.currency || 'USD').toLowerCase();
  const paymentSupported = Boolean(
    paymentConfig?.enabled
    && paymentConfig?.paymentTypes?.includes('deposit')
    && paymentConfig?.supportedCurrencies?.includes(currency)
  );
  const canPay = ['unpaid', 'failed'].includes(paymentStatus) && paymentSupported;
  const depositPercent = percent(booking.deposit_percentage);

  const startPayment = async () => {
    if (!canPay || startingPayment) return;
    setStartingPayment(true);
    try {
      await redirectToDepositCheckout(booking.id);
    } catch (error) {
      toast.error(error.message || 'Could not start payment.');
      setStartingPayment(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-bold text-foreground">{lang === 'fa' ? 'گفتگو داخل سایت فعال است' : lang === 'ar' ? 'المحادثة داخل الموقع متاحة' : 'In-platform chat is available'}</p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {lang === 'fa' ? 'برای گفتگو نیازی به پرداخت نیست. تا قبل از تأیید پرداخت، اطلاعات تماس خارج از سایت قابل اشتراک نیست.' : lang === 'ar' ? 'لا يلزم الدفع للمحادثة. قبل تأكيد الدفع لا يمكن مشاركة معلومات الاتصال خارج الموقع.' : 'Payment is not required to chat. Off-platform contact information remains blocked until payment is confirmed.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => navigate(`/chat/${booking.guide_id}`)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90">
            <MessageCircle className="h-4 w-4" /> {tx.chat}
          </button>
        </div>
      </div>

      {contactReleased ? (
        <>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{tx.released}</p>
          </div>
          <BookingContactCard bookingId={booking.id} released />
        </>
      ) : paymentPending ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-500" />
          <p className="text-sm leading-relaxed text-foreground/75">{tx.processing}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-accent/5 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-foreground">{tx.paymentRequired}</p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{tx.depositCopy}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {money(booking.deposit_amount, booking.currency)}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">({depositPercent || 15}% of {money(booking.price, booking.currency)})</span>
                </p>
              </div>
            </div>
            <button type="button" onClick={startPayment} disabled={!canPay || startingPayment || paymentConfigLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
              {startingPayment || paymentConfigLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {startingPayment ? 'Redirecting…' : tx.pay}
            </button>
          </div>
          {!paymentConfigLoading && !paymentSupported && <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">{tx.unavailable}</p>}
        </div>
      )}
    </div>
  );
}
