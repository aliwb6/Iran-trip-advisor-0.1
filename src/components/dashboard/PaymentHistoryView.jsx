import {
  useQuery } from '@tanstack/react-query';
import { CreditCard,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
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

  if (isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{error.message || 'Could not load payment history.'}</p>;

  return (
    <section>
      <h2 className="text-xl font-bold text-foreground">Payment History</h2>
      <p className="mt-1 text-sm text-muted-foreground">Server-recorded payment attempts and verified provider transactions only.</p>
      {payments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card py-16 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No payment transactions have been recorded.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          {payments.map(payment => (
            <div key={payment.id} className="grid grid-cols-2 gap-3 border-b border-border bg-card p-4 text-xs last:border-b-0 sm:grid-cols-5">
              <div><p className="text-muted-foreground">Type</p><p className="mt-1 font-medium text-foreground">{payment.payment_type}</p></div>
              <div><p className="text-muted-foreground">Amount</p><p className="mt-1 font-medium text-foreground">{money(payment.total_amount, payment.currency)}</p></div>
              <div><p className="text-muted-foreground">Status</p><p className="mt-1 font-medium text-foreground">{payment.status}</p></div>
              <div><p className="text-muted-foreground">Provider</p><p className="mt-1 font-medium text-foreground">{payment.provider || 'Not assigned'}</p></div>
              <div><p className="text-muted-foreground">Recorded</p><p className="mt-1 font-medium text-foreground">{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</p></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
