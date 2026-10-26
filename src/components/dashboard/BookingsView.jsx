import {
  useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays,
  MessageCircle,
  Users,
  Wallet,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { fetchMyBookings } from '@/api/bookings';
import BookingContactCard from '@/components/profile/BookingContactCard';
import { useI18n } from '@/lib/i18n.jsx';
import { localize, localizeBookingStatus, localizePriceBasis } from '@/lib/localize';

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency || 'USD',
}).format(Number(value) || 0);

const percent = value => `${Math.round((Number(value) || 0) * 100)}%`;

function BookingCard({ booking }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const currency = booking.currency || 'USD';
  const dateLocale = lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-US';
  const dates = [booking.start_date, booking.end_date]
    .filter(Boolean)
    .map(date => new Date(`${date}T00:00:00`).toLocaleDateString(dateLocale))
    .join(' → ') || l('Dates not set', 'تاریخ سفر مشخص نشده است', 'لم تُحدَّد مواعيد الرحلة');
  const contactReleased = booking.contact_released === true
    && ['deposit_paid', 'paid'].includes(booking.payment_status);

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{booking.tour_title || l('Custom trip booking', 'رزرو سفر اختصاصی', 'حجز رحلة مخصصة')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{dates}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{localizeBookingStatus(booking.status, lang)}</span>
          <span className="text-[11px] text-muted-foreground">{l('Payment:', 'پرداخت:', 'الدفع:')} {localizeBookingStatus(booking.payment_status, lang)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-xl bg-card p-3">
          <Users className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-muted-foreground">{l('Travelers', 'مسافران', 'المسافرون')}</p>
          <p className="mt-0.5 font-semibold text-foreground">{booking.traveler_count}</p>
        </div>
        <div className="rounded-xl bg-card p-3">
          <CalendarDays className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-muted-foreground">{l('Duration', 'مدت سفر', 'مدة الرحلة')}</p>
          <p className="mt-0.5 font-semibold text-foreground">{booking.trip_duration_days} {l('day(s)', 'روز', 'يوم')}</p>
        </div>
        <div className="rounded-xl bg-card p-3">
          <Wallet className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-muted-foreground">{l('Booking total', 'مبلغ کل رزرو', 'إجمالي الحجز')}</p>
          <p className="mt-0.5 font-semibold text-foreground">{money(booking.price, currency)}</p>
        </div>
        <div className="rounded-xl bg-card p-3">
          <p className="text-muted-foreground">{l('Original unit quote', 'قیمت پایه پیشنهادی', 'السعر الأصلي للوحدة')}</p>
          <p className="mt-0.5 font-semibold text-foreground">{money(booking.quoted_unit_price, currency)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{localizePriceBasis(booking.price_type, lang)} · {localizePriceBasis(booking.price_period, lang)}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-4 text-xs sm:grid-cols-4">
        <div><dt className="text-muted-foreground">{l('Commission', 'کارمزد', 'العمولة')} ({percent(booking.commission_rate)})</dt><dd className="mt-0.5 font-medium text-foreground">{money(booking.commission_amount, currency)}</dd></div>
        <div><dt className="text-muted-foreground">{l('Expected payout', 'مبلغ دریافتی پیش‌بینی‌شده', 'المبلغ المتوقع استلامه')}</dt><dd className="mt-0.5 font-medium text-emerald-700">{money(booking.guide_payout, currency)}</dd></div>
        <div><dt className="text-muted-foreground">{l('Deposit', 'پیش‌پرداخت', 'العربون')} ({percent(booking.deposit_percentage)})</dt><dd className="mt-0.5 font-medium text-foreground">{money(booking.deposit_amount, currency)}</dd></div>
        <div><dt className="text-muted-foreground">{l('Balance due', 'مانده قابل پرداخت', 'الرصيد المتبقي')}</dt><dd className="mt-0.5 font-medium text-foreground">{money(booking.balance_due, currency)}</dd></div>
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">{l('Chat with traveler', 'گفت‌وگو با مسافر', 'الدردشة مع المسافر')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {contactReleased
                ? l('Payment is confirmed. Contact details and contact sharing are available.', 'پرداخت تأیید شده است. اکنون می‌توانید اطلاعات تماس را ببینید و با مسافر به اشتراک بگذارید.', 'تأكد الدفع. يمكنك الآن الاطلاع على بيانات التواصل ومشاركتها مع المسافر.')
                : l('Chat is available now. Private contact details remain locked until the traveler payment is confirmed.', 'اکنون می‌توانید گفت‌وگو کنید. اطلاعات تماس خصوصی پس از تأیید پرداخت مسافر در دسترس قرار می‌گیرد.', 'الدردشة متاحة الآن. ستظل بيانات التواصل الخاصة محجوبة حتى تأكيد دفع المسافر.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/chat/${booking.tourist_id}`)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[hsl(178,85%,32%)] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[hsl(178,85%,38%)]"
          >
            <MessageCircle className="h-3.5 w-3.5" /> {l('Chat with traveler', 'گفت‌وگو با مسافر', 'الدردشة مع المسافر')}
          </button>
        </div>

        {contactReleased && (
          <BookingContactCard bookingId={booking.id} released className="mt-3" />
        )}
      </div>
    </article>
  );
}

export default function BookingsView() {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: fetchMyBookings,
  });

  if (isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{l('Could not load bookings.', 'بارگذاری رزروها انجام نشد.', 'تعذر تحميل الحجوزات.')}</p>;

  return (
    <section>
      <h2 className="text-xl font-bold text-foreground">{l('My Bookings', 'رزروهای من', 'حجوزاتي')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{l('Chat remains on-platform before payment; verified payment releases private contact details.', 'تا پیش از پرداخت، گفت‌وگو در همین سایت انجام می‌شود. پس از تأیید پرداخت، اطلاعات تماس خصوصی در دسترس قرار می‌گیرد.', 'تظل المحادثة داخل الموقع قبل الدفع. وبعد تأكيده، تصبح بيانات التواصل الخاصة متاحة.')}</p>
      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{l('No confirmed bookings yet.', 'هنوز رزرو تأییدشده‌ای ندارید.', 'ليس لديك حجوزات مؤكدة بعد.')}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">{bookings.map(booking => <BookingCard key={booking.id} booking={booking} />)}</div>
      )}
    </section>
  );
}
