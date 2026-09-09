import { useI18n } from '@/lib/i18n.jsx';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { checkProfileCompletion } from '@/lib/profileCompletion';

const FIELD_LABELS = {
  full_name:   { en: 'Full Name',              fa: 'نام کامل',             ar: 'الاسم الكامل' },
  email:       { en: 'Email',                  fa: 'ایمیل',                ar: 'البريد الإلكتروني' },
  phone:       { en: 'Phone Number',            fa: 'شماره تلفن',           ar: 'رقم الهاتف' },
  city:        { en: 'City',                    fa: 'شهر',                  ar: 'المدينة' },
  bio:         { en: 'Bio',                     fa: 'بیو',                  ar: 'نبذة' },
  languages:   { en: 'Languages (at least 1)',  fa: 'زبان‌ها (حداقل ۱)',    ar: 'اللغات (لغة واحدة على الأقل)' },
  specialty:   { en: 'Specialty',               fa: 'تخصص',                 ar: 'التخصص' },
  tour_types:  { en: 'Tour Types',              fa: 'نوع تور',              ar: 'أنواع الجولات' },
  special_abilities: { en: 'Special Abilities (at least 1)', fa: 'توانایی‌های ویژه (حداقل ۱)', ar: 'المهارات الخاصة (واحدة على الأقل)' },
  has_vehicle: { en: 'Vehicle Availability', fa: 'وضعیت وسیله نقلیه', ar: 'توفر المركبة' },
  license_url: { en: 'License Uploaded',        fa: 'مجوز آپلود شده',      ar: 'تم رفع الرخصة' },
};

export default function ProfileCompletionChecklist({ profile }) {
  const { lang } = useI18n();
  const result = checkProfileCompletion(profile);

  if (!profile || (profile.role !== 'guide' && profile.role !== 'agency')) {
    return null;
  }

  return (
    <div className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[hsl(38,62%,58%)]" />
          <p className="text-white/70 text-sm font-semibold">
            {lang === 'fa' ? 'تکمیل پروفایل' : lang === 'ar' ? 'إكمال الملف الشخصي' : 'Profile Completion'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          result.completed
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {result.completed
            ? (lang === 'fa' ? 'کامل' : lang === 'ar' ? 'مكتمل' : 'Complete')
            : `${result.percentage}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            result.completed ? 'bg-emerald-500' : 'bg-[hsl(178,85%,32%)]'
          }`}
          style={{ width: `${result.percentage}%` }}
        />
      </div>

      {!result.completed && (
        <p className="text-white/40 text-xs mb-3">
          {result.passed}/{result.total}
          {lang === 'fa' ? ' فیلد تکمیل شده' : lang === 'ar' ? ' حقلاً مكتملة' : ' fields completed'}
        </p>
      )}

      {/* Checklist */}
      <div className="space-y-2">
        {result.items.map((item) => {
          const label = FIELD_LABELS[item.label]?.[lang] || FIELD_LABELS[item.label]?.en || item.label;
          return (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              {item.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span className={item.ok ? 'text-white/60' : 'text-white/80'}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
