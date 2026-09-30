import IconSwap from '@/components/ui/IconSwap';
import {
  useEffect,
  useState } from 'react';
import { CheckCircle2,
  Contact,
  LockKeyhole,
  Save,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { toast } from 'sonner';
import {
  PROVIDER_CONTACT_TYPES,
  fetchMyProviderContactMethods,
  saveMyProviderContactMethods,
} from '@/api/providerContacts';

const emptyValues = Object.fromEntries(PROVIDER_CONTACT_TYPES.map(item => [item.type, '']));

export default function ProviderContactMethodsCard({ providerId, profile }) {
  const [values, setValues] = useState(emptyValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const methods = await fetchMyProviderContactMethods(providerId);
        if (cancelled) return;
        setValues({
          ...emptyValues,
          ...Object.fromEntries(methods.map(method => [method.type, method.value || ''])),
        });
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Could not load contact methods.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  const handleSave = async () => {
    if (!providerId || saving) return;
    setSaving(true);
    try {
      await saveMyProviderContactMethods(providerId, values);
      toast.success('Private contact information saved.');
    } catch (error) {
      toast.error(error.message || 'Could not save contact information.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-700">
            <Contact className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Private contact information</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              These details are never shown on your public profile. They become available only to the traveler after a verified booking payment.
            </p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <LockKeyhole className="h-3 w-3" /> Payment protected
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
          <p className="mt-1 text-sm text-foreground/80">{profile?.phone || profile?.phone_number || 'Add your phone above'}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Uses the required phone field from your profile.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="mt-1 break-all text-sm text-foreground/80">{profile?.email || 'Account email'}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Uses your verified account/profile email.</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading optional contact methods…
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {PROVIDER_CONTACT_TYPES.map(definition => (
            <label key={definition.type} className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{definition.label}</span>
              <input
                type="text"
                value={values[definition.type] || ''}
                onChange={event => setValues(current => ({ ...current, [definition.type]: event.target.value }))}
                placeholder={
                  definition.type === 'whatsapp' ? '+98 912 ...'
                    : definition.type === 'telegram' ? '@username'
                      : definition.type === 'instagram' ? '@username'
                        : 'https://example.com'
                }
                dir="ltr"
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/20"
                maxLength={500}
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
          Phone and email remain private until payment as well.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {<IconSwap active={saving} a={<Save className="h-3.5 w-3.5" />} b={<Loader2 className="h-3.5 w-3.5 animate-spin" />} keepMounted={false} />}
          {saving ? 'Saving…' : 'Save contact methods'}
        </button>
      </div>
    </section>
  );
}
