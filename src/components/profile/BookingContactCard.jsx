import {
  useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Contact,
  Copy,
  ExternalLink,
  Globe2,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { fetchBookingContactMethods } from '@/api/providerContacts';

const iconFor = type => {
  if (type === 'phone') return Phone;
  if (type === 'email') return Mail;
  if (type === 'instagram') return Instagram;
  if (type === 'website') return Globe2;
  if (type === 'whatsapp' || type === 'telegram') return MessageCircle;
  return Contact;
};

function externalHref(type, value) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  if (type === 'phone') return `tel:${clean}`;
  if (type === 'email') return `mailto:${clean}`;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (type === 'whatsapp') {
    const digits = clean.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (type === 'telegram') return `https://t.me/${clean.replace(/^@/, '')}`;
  if (type === 'instagram') return `https://instagram.com/${clean.replace(/^@/, '')}`;
  if (type === 'website') return `https://${clean}`;
  return null;
}

export default function BookingContactCard({ bookingId, released = false, dark = false, className = '' }) {
  const [copied, setCopied] = useState('');
  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['booking-contact-methods', bookingId],
    queryFn: () => fetchBookingContactMethods(bookingId),
    enabled: Boolean(bookingId && released),
    staleTime: 30_000,
    retry: 1,
  });

  if (!released) return null;

  const panel = dark
    ? 'border-emerald-500/20 bg-emerald-500/10 text-white'
    : 'border-emerald-400/30 bg-emerald-500/10 text-foreground';
  const muted = dark ? 'text-white/50' : 'text-muted-foreground';

  return (
    <section className={`rounded-2xl border p-4 ${panel} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
          <Contact className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Contact information</p>
          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
            Payment is confirmed. These private details are now available for booking coordination.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className={`mt-4 flex items-center gap-2 text-xs ${muted}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contact details…
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-red-400">{error.message || 'Could not load contact details.'}</p>
      ) : contacts.length === 0 ? (
        <p className={`mt-4 text-xs ${muted}`}>No contact methods have been added yet.</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {contacts.map(contact => {
            const Icon = iconFor(contact.contact_type);
            const href = externalHref(contact.contact_type, contact.value);
            const key = `${contact.contact_type}:${contact.value}`;
            return (
              <div key={key} className={`rounded-xl border p-3 ${dark ? 'border-white/10 bg-black/10' : 'border-emerald-500/15 bg-background/60'}`}>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-emerald-500" />
                  <span className={`text-[11px] font-semibold ${muted}`}>{contact.label}</span>
                </div>
                <p className="mt-1.5 break-all text-xs font-medium">{contact.value}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(contact.value);
                      setCopied(key);
                      window.setTimeout(() => setCopied(''), 1500);
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${dark ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === key ? 'Copied' : 'Copy'}
                  </button>
                  {href && (
                    <a
                      href={href}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel={href.startsWith('http') ? 'noreferrer' : undefined}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
