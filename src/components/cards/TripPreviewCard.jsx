import { motion } from 'framer-motion';
import { ChevronLeft, CheckCircle } from 'lucide-react';

import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { localize, localizeTripOption } from '@/lib/localize';
function InfoBox({ icon, label, value, lang }) {
  return (
    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{icon} {label}</p>
      <p className="text-lg font-bold text-slate-900">{value || '—'}</p>
    </div>
  );
}

export default function TripPreviewCard({
  tripData,
  onEdit,
  onSave,
  loading,
  lang,
  dir
}) {
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const displayDays = tripData.duration || '—';
  const displayDestinations = tripData.destinations || '—';
  const displayGroupSize = tripData.groupSize || '—';
  const displayBudget = tripData.budget || '—';
  const displayPurpose = tripData.purpose || '—';
  const displayActivityLevel = tripData.activityLevel || '—';
  const displayDietary = Array.isArray(tripData.dietary) ? tripData.dietary.map(item => localizeTripOption(item, lang)).join(lang === 'en' ? ', ' : '، ') : (localizeTripOption(tripData.dietary, lang) || '—');
  const displayAccommodation = Array.isArray(tripData.accommodation) ? tripData.accommodation.map(item => localizeTripOption(item, lang)).join(lang === 'en' ? ', ' : '، ') : (localizeTripOption(tripData.accommodation, lang) || '—');
  const displayPace = tripData.pace || '—';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      dir={dir}
      className="w-full max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-slate-900 mb-2">
          {l(`${displayDays}-day trip to ${displayDestinations}`, `سفر ${displayDays}روزه به ${displayDestinations}`, `رحلة إلى ${displayDestinations} · المدة بالأيام: ${displayDays}`)}
        </h2>
        <p className="text-slate-600">
          {lang === 'fa' ? 'خلاصه سفر سفارشی شما' : lang === 'ar' ? 'ملخص رحلتك المخصصة' : 'Your personalized trip summary'}
        </p>
      </div>

      {/* Trip Overview Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6">
          {l('Trip Details', 'جزئیات سفر', 'تفاصيل الرحلة')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <InfoBox icon="🗓️" label={l('Duration', 'مدت', 'المدة')} value={l(`${displayDays} days`, `${displayDays} روز`, `عدد الأيام: ${displayDays}`)} lang={lang} />
          <InfoBox icon="👥" label={l('Group Size', 'تعداد مسافران', 'عدد المسافرين')} value={l(`${displayGroupSize} people`, `${displayGroupSize} نفر`, `${displayGroupSize}`)} lang={lang} />
          <InfoBox icon="💰" label={l('Budget', 'بودجه', 'الميزانية')} value={localizeTripOption(displayBudget, lang)} lang={lang} />
          <InfoBox icon="🎯" label={l('Purpose', 'هدف سفر', 'هدف الرحلة')} value={localizeTripOption(displayPurpose, lang)} lang={lang} />
          <InfoBox icon="🚶" label={l('Activity Level', 'میزان فعالیت', 'مستوى النشاط')} value={localizeTripOption(displayActivityLevel, lang)} lang={lang} />
          <InfoBox icon="🏨" label={l('Accommodation', 'اقامتگاه', 'الإقامة')} value={localizeTripOption(displayAccommodation, lang)} lang={lang} />
        </div>

        {/* Additional Details */}
        {(displayDietary !== '—' || displayPace !== '—' || tripData.healthConsiderations || tripData.children.hasChildren) && (
          <div className="border-t border-slate-200 pt-6">
            <h4 className="font-semibold text-slate-900 mb-4">
              {lang === 'fa' ? 'اطلاعات بیشتر' : lang === 'ar' ? 'معلومات إضافية' : 'Additional Information'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayDietary !== '—' && (
                <InfoBox icon="🍽️" label={l('Dietary', 'رژیم غذایی', 'النظام الغذائي')} value={displayDietary} lang={lang} />
              )}
              {displayPace !== '—' && (
                <InfoBox icon="⚡" label={l('Pace', 'سرعت سفر', 'وتيرة الرحلة')} value={localizeTripOption(displayPace, lang)} lang={lang} />
              )}
              {tripData.children.hasChildren && (
                <InfoBox icon="👨‍👩‍👧" label={l('Children', 'کودکان', 'الأطفال')} value={l(`${tripData.children.count} children`, `${tripData.children.count} کودک`, `عدد الأطفال: ${tripData.children.count}`)} lang={lang} />
              )}
              {tripData.healthConsiderations && (
                <InfoBox icon="⚕️" label={l('Health', 'سلامت', 'الصحة')} value={l('Special needs', 'نیازهای ویژه', 'احتياجات خاصة')} lang={lang} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notes Section */}
      {tripData.notes && (
        <div className="bg-teal-50 rounded-xl p-6 border border-teal-200 mb-8">
          <h4 className="font-semibold text-slate-900 mb-2">
            {lang === 'fa' ? '📝 یادداشت‌های اضافی' : lang === 'ar' ? '📝 ملاحظات إضافية' : '📝 Additional Notes'}
          </h4>
          <p className="text-slate-700 leading-relaxed">{tripData.notes}</p>
        </div>
      )}

      {/* Health Considerations */}
      {tripData.healthConsiderations && (
        <div className="bg-amber-50 rounded-xl p-6 border border-amber-200 mb-8">
          <h4 className="font-semibold text-slate-900 mb-2">
            {lang === 'fa' ? '⚕️ اعتبارات سلامتی' : lang === 'ar' ? '⚕️ الاعتبارات الصحية' : '⚕️ Health Considerations'}
          </h4>
          <p className="text-slate-700 leading-relaxed">{tripData.healthConsiderations}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onEdit}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border-2 border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 transition"
        >
          <ChevronLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          {lang === 'fa' ? 'ویرایش' : lang === 'ar' ? 'تحرير' : 'Edit'}
        </button>

        <button
          onClick={onSave}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-teal-500 text-white font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <>
              <BreathingGlow className="h-5 w-5" label={l('Loading trip', 'در حال بارگذاری سفر', 'جارٍ تحميل الرحلة')} />
              {lang === 'fa' ? 'در حال ذخیره...' : lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {lang === 'fa' ? '✓ ذخیره در پروفایل' : lang === 'ar' ? '✓ حفظ في الملف الشخصي' : '✓ Save to Profile'}
            </>
          )}
        </button>
      </div>

      {/* Information Text */}
      <p className="text-center text-sm text-slate-500 mt-6">
        {lang === 'fa' ? 'سفر شما با ایمنی ذخیره خواهد شد' : lang === 'ar' ? 'سيتم حفظ رحلتك بأمان' : 'Your trip will be saved securely'}
      </p>
    </motion.div>
  );
}
