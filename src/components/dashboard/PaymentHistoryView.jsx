import { useQuery } from '@tanstack/react-query';
import { CreditCard, Loader2 } from 'lucide-react';
import { fetchMyPayments } from '@/api/bookings';

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency || 'USD',
}).format(Number(value) || 0);

export default function PaymentHistoryView() {
  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchMyPayments,
  });

  if (isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (error) return <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">{error.message || 'Could not load payment history.'}</p>;

  return (
    <section>
      <h2 className="text-xl font-bold text-white">Payment History</h2>
      <p className="mt-1 text-sm text-white/40">Server-recorded payment attempts and verified provider transactions only.</p>
      {payments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-16 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">No payment transactions have been recorded.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08]">
          {payments.map(payment => (
            <div key={payment.id} className="grid grid-cols-2 gap-3 border-b border-white/[0.07] bg-[hsl(222,45%,14%)] p-4 text-xs last:border-b-0 sm:grid-cols-5">
              <div><p className="text-white/35">Type</p><p className="mt-1 font-medium text-white">{payment.payment_type}</p></div>
              <div><p className="text-white/35">Amount</p><p className="mt-1 font-medium text-white">{money(payment.total_amount, payment.currency)}</p></div>
              <div><p className="text-white/35">Status</p><p className="mt-1 font-medium text-white">{payment.status}</p></div>
              <div><p className="text-white/35">Provider</p><p className="mt-1 font-medium text-white">{payment.provider || 'Not assigned'}</p></div>
              <div><p className="text-white/35">Recorded</p><p className="mt-1 font-medium text-white">{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</p></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
