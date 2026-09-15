import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2, MessageCircle, Users, Wallet } from 'lucide-react';
import { fetchMyBookings } from '@/api/bookings';
import BookingContactCard from '@/components/profile/BookingContactCard';

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency || 'USD',
}).format(Number(value) || 0);

const percent = value => `${Math.round((Number(value) || 0) * 100)}%`;

function BookingCard({ booking }) {
  const navigate = useNavigate();
  const currency = booking.currency || 'USD';
  const dates = [booking.start_date, booking.end_date].filter(Boolean).join(' → ') || 'Dates not set';
  const contactReleased = booking.contact_released === true
    && ['deposit_paid', 'paid'].includes(booking.payment_status);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[hsl(222,45%,14%)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{booking.tour_title || 'Custom trip booking'}</h3>
          <p className="mt-1 text-xs text-white/45">{dates}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">{booking.status}</span>
          <span className="text-[11px] text-white/40">Payment: {booking.payment_status}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <Users className="mb-1 h-3.5 w-3.5 text-white/40" />
          <p className="text-white/40">Travelers</p>
          <p className="mt-0.5 font-semibold text-white">{booking.traveler_count}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <CalendarDays className="mb-1 h-3.5 w-3.5 text-white/40" />
          <p className="text-white/40">Duration</p>
          <p className="mt-0.5 font-semibold text-white">{booking.trip_duration_days} day(s)</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <Wallet className="mb-1 h-3.5 w-3.5 text-white/40" />
          <p className="text-white/40">Booking total</p>
          <p className="mt-0.5 font-semibold text-white">{money(booking.price, currency)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-white/40">Original unit quote</p>
          <p className="mt-0.5 font-semibold text-white">{money(booking.quoted_unit_price, currency)}</p>
          <p className="mt-0.5 text-[10px] text-white/35">{booking.price_type} · {booking.price_period}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.07] pt-4 text-xs sm:grid-cols-4">
        <div><dt className="text-white/40">Commission ({percent(booking.commission_rate)})</dt><dd className="mt-0.5 font-medium text-white">{money(booking.commission_amount, currency)}</dd></div>
        <div><dt className="text-white/40">Expected payout</dt><dd className="mt-0.5 font-medium text-emerald-300">{money(booking.guide_payout, currency)}</dd></div>
        <div><dt className="text-white/40">Deposit ({percent(booking.deposit_percentage)})</dt><dd className="mt-0.5 font-medium text-white">{money(booking.deposit_amount, currency)}</dd></div>
        <div><dt className="text-white/40">Balance due</dt><dd className="mt-0.5 font-medium text-white">{money(booking.balance_due, currency)}</dd></div>
      </dl>

      <div className="mt-4 border-t border-white/[0.07] pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-white">Chat with traveler</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              {contactReleased
                ? 'Payment is confirmed. Contact details and contact sharing are available.'
                : 'Chat is available now. Private contact details remain locked until the traveler payment is confirmed.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/chat/${booking.tourist_id}`)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[hsl(178,85%,32%)] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[hsl(178,85%,38%)]"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Chat with traveler
          </button>
        </div>

        {contactReleased && (
          <BookingContactCard bookingId={booking.id} released dark className="mt-3" />
        )}
      </div>
    </article>
  );
}

export default function BookingsView() {
  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: fetchMyBookings,
  });

  if (isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (error) return <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">{error.message || 'Could not load bookings.'}</p>;

  return (
    <section>
      <h2 className="text-xl font-bold text-white">My Bookings</h2>
      <p className="mt-1 text-sm text-white/40">Chat remains on-platform before payment; verified payment releases private contact details.</p>
      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">No confirmed bookings yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">{bookings.map(booking => <BookingCard key={booking.id} booking={booking} />)}</div>
      )}
    </section>
  );
}
