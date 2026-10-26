import {
  useQuery } from '@tanstack/react-query';
import { CreditCard,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { fetchMyPayments } from '@/api/bookings';
import { useI18n } from '@/lib/i18n.jsx';
import { localize, localizeBookingStatus } from '@/lib/localize';

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency || 'USD',
}).format(Number(value) || 0);

export default function PaymentHistoryView() {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchMyPayments,
  });

  if (isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{l('Could not load payment history.', 'بارگذاری تاریخچه پرداخت انجام نشد.', 'تعذر تحميل سجل المدفوعات.')}</p>;

  return (
    <section>
      <h2 className="text-xl font-bold text-foreground">{l('Payment History', 'تاریخچه پرداخت', 'سجل المدفوعات')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{l('Server-recorded payment attempts and verified provider transactions only.', 'فقط تلاش‌های پرداخت ثبت‌شده و تراکنش‌های تأییدشده نمایش داده می‌شوند.', 'تظهر هنا محاولات الدفع المسجلة والمعاملات التي أكدها مزود الدفع فقط.')}</p>
      {payments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card py-16 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{l('No payment transactions have been recorded.', 'هنوز تراکنش پرداختی ثبت نشده است.', 'لم تُسجَّل أي معاملات دفع بعد.')}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          {payments.map(payment => (
            <div key={payment.id} className="grid grid-cols-2 gap-3 border-b border-border bg-card p-4 text-xs last:border-b-0 sm:grid-cols-5">
              <div><p className="text-muted-foreground">{l('Type', 'نوع', 'النوع')}</p><p className="mt-1 font-medium text-foreground">{localizeBookingStatus(payment.payment_type, lang)}</p></div>
              <div><p className="text-muted-foreground">{l('Amount', 'مبلغ', 'المبلغ')}</p><p className="mt-1 font-medium text-foreground">{money(payment.total_amount, payment.currency)}</p></div>
              <div><p className="text-muted-foreground">{l('Status', 'وضعیت', 'الحالة')}</p><p className="mt-1 font-medium text-foreground">{localizeBookingStatus(payment.status, lang)}</p></div>
              <div><p className="text-muted-foreground">{l('Provider', 'درگاه پرداخت', 'مزود الدفع')}</p><p className="mt-1 font-medium text-foreground">{payment.provider || l('Not assigned', 'تعیین نشده', 'لم يُحدَّد')}</p></div>
              <div><p className="text-muted-foreground">{l('Recorded', 'تاریخ ثبت', 'تاريخ التسجيل')}</p><p className="mt-1 font-medium text-foreground">{payment.created_at ? new Date(payment.created_at).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-US') : '—'}</p></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
