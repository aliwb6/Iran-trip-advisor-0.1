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
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

const emptyValues = Object.fromEntries(PROVIDER_CONTACT_TYPES.map(item => [item.type, '']));

export default function ProviderContactMethodsCard({ providerId, profile }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
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
        if (!cancelled) toast.error(localize(lang, 'Could not load contact methods.', 'بارگذاری راه‌های ارتباطی انجام نشد.', 'تعذر تحميل وسائل التواصل.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId, lang]);

  const handleSave = async () => {
    if (!providerId || saving) return;
    setSaving(true);
    try {
      await saveMyProviderContactMethods(providerId, values);
      toast.success(l('Private contact information saved.', 'اطلاعات تماس خصوصی ذخیره شد.', 'حُفظت بيانات التواصل الخاصة.'));
    } catch (error) {
      toast.error(l('Could not save contact information.', 'ذخیره اطلاعات تماس انجام نشد.', 'تعذر حفظ بيانات التواصل.'));
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
            <h3 className="text-sm font-semibold text-foreground">{l('Private contact information', 'اطلاعات تماس خصوصی', 'بيانات التواصل الخاصة')}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {l('These details are never shown on your public profile. They become available only to the traveler after a verified booking payment.', 'این اطلاعات در پروفایل عمومی شما نمایش داده نمی‌شوند و فقط پس از تأیید پرداخت رزرو در اختیار مسافر قرار می‌گیرند.', 'لا تظهر هذه البيانات في ملفك العام، ولا تُتاح للمسافر إلا بعد تأكيد دفع الحجز.')}
            </p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <LockKeyhole className="h-3 w-3" /> {l('Payment protected', 'محافظت‌شده تا زمان پرداخت', 'محمية حتى الدفع')}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l('Phone', 'تلفن', 'الهاتف')}</p>
          <p className="mt-1 text-sm text-foreground/80">{profile?.phone || profile?.phone_number || l('Add your phone above', 'شماره تلفن را در بخش بالا وارد کنید', 'أضف رقم هاتفك في القسم أعلاه')}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{l('Uses the required phone field from your profile.', 'از شماره تلفن ثبت‌شده در پروفایل شما استفاده می‌شود.', 'يُستخدم رقم الهاتف المسجل في ملفك الشخصي.')}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l('Email', 'ایمیل', 'البريد الإلكتروني')}</p>
          <p className="mt-1 break-all text-sm text-foreground/80">{profile?.email || l('Account email', 'ایمیل حساب کاربری', 'بريد الحساب الإلكتروني')}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{l('Uses your verified account/profile email.', 'از ایمیل تأییدشده حساب کاربری شما استفاده می‌شود.', 'يُستخدم بريد حسابك الإلكتروني الذي تم التحقق منه.')}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {l('Loading optional contact methods…', 'در حال بارگذاری راه‌های ارتباطی دیگر…', 'جارٍ تحميل وسائل التواصل الإضافية…')}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {PROVIDER_CONTACT_TYPES.map(definition => (
            <label key={definition.type} className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{definition.type === 'website' ? l('Website', 'وب‌سایت', 'الموقع الإلكتروني') : definition.label}</span>
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
          {l('Phone and email remain private until payment as well.', 'شماره تلفن و ایمیل نیز تا زمان پرداخت خصوصی می‌مانند.', 'يبقى رقم الهاتف والبريد الإلكتروني خاصَّين حتى الدفع أيضاً.')}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {<IconSwap active={saving} a={<Save className="h-3.5 w-3.5" />} b={<Loader2 className="h-3.5 w-3.5 animate-spin" />} keepMounted={false} />}
          {saving ? l('Saving…', 'در حال ذخیره…', 'جارٍ الحفظ…') : l('Save contact methods', 'ذخیره راه‌های ارتباطی', 'حفظ وسائل التواصل')}
        </button>
      </div>
    </section>
  );
}
