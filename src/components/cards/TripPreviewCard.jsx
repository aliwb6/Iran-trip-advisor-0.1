import { motion } from 'framer-motion';
import { ChevronLeft, CheckCircle } from 'lucide-react';

import { BreathingGlow } from '@/components/ui/BreathingGlow';
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
  const displayDays = tripData.duration || '—';
  const displayDestinations = tripData.destinations || '—';
  const displayGroupSize = tripData.groupSize || '—';
  const displayBudget = tripData.budget || '—';
  const displayPurpose = tripData.purpose || '—';
  const displayActivityLevel = tripData.activityLevel || '—';
  const displayDietary = Array.isArray(tripData.dietary) ? tripData.dietary.join(', ') : (tripData.dietary || '—');
  const displayAccommodation = Array.isArray(tripData.accommodation) ? tripData.accommodation.join(', ') : (tripData.accommodation || '—');
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
          {displayDays}-{lang === 'fa' ? 'روزه' : lang === 'ar' ? 'يوم' : 'day'} {lang === 'fa' ? 'سفر به' : lang === 'ar' ? 'رحلة إلى' : 'trip to'} {displayDestinations}
        </h2>
        <p className="text-slate-600">
          {lang === 'fa' ? 'خلاصه سفر سفارشی شما' : lang === 'ar' ? 'ملخص رحلتك المخصصة' : 'Your personalized trip summary'}
        </p>
      </div>

      {/* Trip Overview Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6">
          {lang === 'fa' ? 'تفاصیل سفر' : lang === 'ar' ? 'تفاصيل الرحلة' : 'Trip Details'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <InfoBox icon="🗓️" label={lang === 'fa' ? 'مدت' : 'Duration'} value={`${displayDays} ${lang === 'fa' ? 'روز' : 'days'}`} lang={lang} />
          <InfoBox icon="👥" label={lang === 'fa' ? 'تعداد' : 'Group Size'} value={`${displayGroupSize} ${lang === 'fa' ? 'نفر' : 'people'}`} lang={lang} />
          <InfoBox icon="💰" label={lang === 'fa' ? 'بودجه' : 'Budget'} value={displayBudget} lang={lang} />
          <InfoBox icon="🎯" label={lang === 'fa' ? 'هدف' : 'Purpose'} value={displayPurpose} lang={lang} />
          <InfoBox icon="🚶" label={lang === 'fa' ? 'فعالیت' : 'Activity Level'} value={displayActivityLevel} lang={lang} />
          <InfoBox icon="🏨" label={lang === 'fa' ? 'اقامت' : 'Accommodation'} value={displayAccommodation} lang={lang} />
        </div>

        {/* Additional Details */}
        {(displayDietary !== '—' || displayPace !== '—' || tripData.healthConsiderations || tripData.children.hasChildren) && (
          <div className="border-t border-slate-200 pt-6">
            <h4 className="font-semibold text-slate-900 mb-4">
              {lang === 'fa' ? 'اطلاعات بیشتر' : lang === 'ar' ? 'معلومات إضافية' : 'Additional Information'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayDietary !== '—' && (
                <InfoBox icon="🍽️" label={lang === 'fa' ? 'غذایی' : 'Dietary'} value={displayDietary} lang={lang} />
              )}
              {displayPace !== '—' && (
                <InfoBox icon="⚡" label={lang === 'fa' ? 'سرعت' : 'Pace'} value={displayPace} lang={lang} />
              )}
              {tripData.children.hasChildren && (
                <InfoBox icon="👨‍👩‍👧" label={lang === 'fa' ? 'کودکان' : 'Children'} value={`${tripData.children.count} ${lang === 'fa' ? 'کودک' : 'children'}`} lang={lang} />
              )}
              {tripData.healthConsiderations && (
                <InfoBox icon="⚕️" label={lang === 'fa' ? 'سلامت' : 'Health'} value={lang === 'fa' ? 'نیازهای خاص' : 'Special needs'} lang={lang} />
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
              <BreathingGlow className="h-5 w-5" label="Loading trip" />
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
