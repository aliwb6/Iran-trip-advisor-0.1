import { BadgeCheck, ShieldCheck } from 'lucide-react';

const copy = {
  en: {
    title: 'Verified license',
    description: 'This provider’s license has been reviewed and verified by Iran Trip Advisor.',
  },
  fa: {
    title: 'مجوز تأییدشده',
    description: 'مجوز این ارائه‌دهنده توسط ایران تریپ ادوایزر بررسی و تأیید شده است.',
  },
  ar: {
    title: 'رخصة موثقة',
    description: 'تمت مراجعة ترخيص مقدم الخدمة هذا والتحقق منه بواسطة إيران تريب أدفايزر.',
  },
};

export default function PublicLicenseCard({ profile, lang = 'en', className = '' }) {
  const labels = copy[lang] || copy.en;

  if (!profile?.is_approved || profile?.license_status !== 'verified') {
    return null;
  }

  const providerLabel = profile.role === 'agency'
    ? (lang === 'fa' ? 'آژانس تأییدشده' : lang === 'ar' ? 'وكالة موثقة' : 'Verified Agency')
    : (lang === 'fa' ? 'راهنمای تأییدشده' : lang === 'ar' ? 'مرشد موثق' : 'Verified Guide');

  return (
    <section className={`${className} p-5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-semibold text-foreground">{labels.title}</h2>
            <BadgeCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">{labels.description}</p>
          <p className="mt-2 font-body text-xs font-semibold text-emerald-600 dark:text-emerald-400">{providerLabel}</p>
        </div>
      </div>
    </section>
  );
}
