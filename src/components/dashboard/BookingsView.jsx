import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Contact, Loader2, Mail, Phone, Users, Wallet } from 'lucide-react';
import { fetchMyBookings } from '@/api/bookings';
import { fetchReleasedBookingContact } from '@/api/participantProfiles';

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency || 'USD',
}).format(Number(value) || 0);

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

function BookingCard({ booking }) {
  const currency = booking.currency || 'USD';
  const dates = [booking.start_date, booking.end_date].filter(Boolean).join(' → ') || 'Dates not set';
  const [contact, setContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState('');

  const loadContact = async () => {
    if (!booking.contact_released || contactLoading) return;
    setContactLoading(true);
    setContactError('');
    try {
      const result = await fetchReleasedBookingContact(booking.id);
      if (!result) throw new Error('Contact details are not available yet.');
      setContact(result);
    } catch (error) {
      setContactError(error.message || 'Could not load contact details.');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[hsl(222,45%,14%)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{booking.tour_title || 'Custom trip booking'}</h3>
          <p className="mt-1 text-xs text-white/45">{dates}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            {booking.status}
          </span>
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
        {booking.contact_released ? (
          contact ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <Contact className="h-4 w-4" />
                <span className="font-semibold">Traveler contact</span>
              </div>
              <p className="mt-2 font-medium text-white">{contact.full_name || 'Traveler'}</p>
              {contact.email && <p className="mt-1 flex items-center gap-2 text-white/60"><Mail className="h-3.5 w-3.5" />{contact.email}</p>}
              {contact.phone && <p className="mt-1 flex items-center gap-2 text-white/60"><Phone className="h-3.5 w-3.5" />{contact.phone}</p>}
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={loadContact}
                disabled={contactLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-60"
              >
                {contactLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Contact className="h-3.5 w-3.5" />}
                {contactLoading ? 'Loading contact…' : 'View traveler contact'}
              </button>
              {contactError && <p className="mt-2 text-xs text-red-300">{contactError}</p>}
            </div>
          )
        ) : (
          <p className="text-xs text-white/35">Private traveler contact unlocks only after the booking deposit is confirmed.</p>
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
      <p className="mt-1 text-sm text-white/40">Server-confirmed commercial snapshots for your selected proposals.</p>
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
