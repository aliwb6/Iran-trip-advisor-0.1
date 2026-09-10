import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Loader2, LockKeyhole, MessageCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { fetchPaymentProviderConfig, redirectToDepositCheckout } from '@/api/payments';
import { useI18n } from '@/lib/i18n.jsx';

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

  // Stripe redirect success is only a UX signal. Settlement authority remains
  // the verified webhook, so keep refreshing while the server reports pending.
  useEffect(() => {
    if (!booking || !['deposit_pending', 'payment_pending'].includes(booking.payment_status)) return undefined;
    const timer = window.setInterval(() => {
      refetchBooking();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [booking, refetchBooking]);

  if (!shouldLoadBooking) return null;

  const tx = {
    waiting: lang === 'fa'
      ? 'راهنما یا آژانس انتخاب‌شده باید ابتدا رزرو را تأیید کند. بعد از تأیید، پرداخت ۱۵٪ فعال می‌شود.'
      : lang === 'ar'
        ? 'يجب أن يؤكد المرشد أو الوكالة الحجز أولاً. بعد التأكيد سيتم تفعيل دفعة 15٪.'
        : 'The selected guide or agency must confirm the booking first. The 15% deposit will unlock after confirmation.',
    paymentRequired: lang === 'fa' ? 'پرداخت برای فعال شدن چت' : lang === 'ar' ? 'الدفع لتفعيل المحادثة' : 'Payment required to unlock chat',
    depositCopy: lang === 'fa'
      ? 'برای قطعی شدن رزرو، ۱۵٪ مبلغ را پرداخت کن. بعد از تأیید امن پرداخت، چت دوطرفه باز می‌شود.'
      : lang === 'ar'
        ? 'ادفع 15٪ لتثبيت الحجز. بعد تأكيد الدفع بشكل آمن سيتم فتح المحادثة الثنائية.'
        : 'Pay the 15% booking deposit. Two-way chat unlocks only after secure payment confirmation.',
    pay: lang === 'fa' ? 'پرداخت ۱۵٪' : lang === 'ar' ? 'دفع 15٪' : 'Pay 15% deposit',
    processing: lang === 'fa' ? 'پرداخت در حال تأیید است…' : lang === 'ar' ? 'جارٍ تأكيد الدفع…' : 'Payment is being securely confirmed…',
    unlocked: lang === 'fa' ? 'پرداخت تأیید شد؛ چت دوطرفه فعال است.' : lang === 'ar' ? 'تم تأكيد الدفع؛ المحادثة الثنائية مفعّلة.' : 'Payment confirmed. Two-way chat is unlocked.',
    chat: lang === 'fa' ? 'چت با راهنما / آژانس' : lang === 'ar' ? 'محادثة المرشد / الوكالة' : 'Chat with guide / agency',
    unavailable: lang === 'fa' ? 'پرداخت آنلاین برای این رزرو هنوز در دسترس نیست.' : lang === 'ar' ? 'الدفع الإلكتروني غير متاح لهذا الحجز بعد.' : 'Online payment is not available for this booking yet.',
  };

  if (bookingLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/40 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading booking payment status…
      </div>
    );
  }

  if (bookingError) {
    return (
      <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
        {bookingError.message || 'Could not load the booking payment status.'}
      </div>
    );
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
  const chatUnlocked = booking.contact_released === true && ['deposit_paid', 'paid'].includes(paymentStatus);
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

  if (chatUnlocked) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{tx.unlocked}</p>
            <button
              type="button"
              onClick={() => navigate(`/chat/${booking.guide_id}`)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              {tx.chat}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentPending) {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-500" />
        <p className="text-sm leading-relaxed text-foreground/75">{tx.processing}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-accent/5 p-4">
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

        <button
          type="button"
          onClick={startPayment}
          disabled={!canPay || startingPayment || paymentConfigLoading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startingPayment || paymentConfigLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {startingPayment ? 'Redirecting…' : tx.pay}
        </button>
      </div>
      {!paymentConfigLoading && !paymentSupported && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">{tx.unavailable}</p>
      )}
    </div>
  );
}
