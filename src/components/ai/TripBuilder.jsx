import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCustomTrip } from '@/hooks/useCustomTrip';
import TripQuestionnaire from './TripQuestionnaire';
import TripPreviewCard from '@/components/cards/TripPreviewCard';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function TripBuilder({
  isOpen,
  onClose,
  lang,
  dir
}) {
  const { user } = useAuth();
  const {
    tripData,
    updateTripData,
    currentQuestion,
    questions,
    nextQuestion,
    prevQuestion,
    resetTrip,
    showPreview,
    setShowPreview,
    generateTripObject
  } = useCustomTrip();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveTrip = async () => {
    if (!user) {
      alert(lang === 'fa' ? 'لطفاً ابتدا وارد شوید' : 'Please login first');
      return;
    }

    setSaving(true);
    try {
      const tripObject = generateTripObject();

      const { error } = await supabase
        .from('custom_trips')
        .insert([
          {
            user_id: user.id,
            trip_data: tripObject,
            status: 'draft',
            created_at: new Date()
          }
        ]);

      if (error) throw error;

      setSaved(true);
      setTimeout(() => {
        resetTrip();
        onClose();
        setSaved(false);
      }, 2000);
    } catch (error) {
      console.error('Error saving trip:', error);
      alert(lang === 'fa' ? 'خرابی در ذخیره سفر' : 'Error saving trip');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          dir={dir}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {lang === 'fa' ? '✈️ ساختن سفر سفارشی' : lang === 'ar' ? '✈️ إنشاء رحلة مخصصة' : '✈️ Create Custom Trip'}
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                {lang === 'fa' ? 'راهنمای ما را طی کنید تا سفر ایده‌آل خود را برنامه‌ریزی کنید' : lang === 'ar' ? 'اتبع موجهنا لتخطيط رحلتك المثالية' : 'Follow our guide to plan your perfect trip'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-6 h-6 text-slate-900" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {saved ? (
                <motion.div
                  key="saved"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center py-12"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6 }}
                    className="text-6xl mb-4"
                  >
                    ✅
                  </motion.div>
                  <h3 className="text-3xl font-bold text-slate-900 mb-2">
                    {lang === 'fa' ? 'سفر شما ذخیره شد!' : lang === 'ar' ? 'تم حفظ رحلتك!' : 'Trip Saved!'}
                  </h3>
                  <p className="text-slate-600 max-w-md mx-auto">
                    {lang === 'fa' ? 'سفر سفارشی شما در پروفایل شما ذخیره شد. می‌توانید آن را بعداً مشاهده یا ویرایش کنید.' : lang === 'ar' ? 'تم حفظ رحلتك المخصصة في ملفك الشخصي. يمكنك عرضها أو تحريرها لاحقاً.' : 'Your custom trip has been saved to your profile. You can view or edit it later.'}
                  </p>
                </motion.div>
              ) : showPreview ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <TripPreviewCard
                    tripData={tripData}
                    onEdit={() => setShowPreview(false)}
                    onSave={handleSaveTrip}
                    loading={saving}
                    lang={lang}
                    dir={dir}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="questionnaire"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <TripQuestionnaire
                    currentQuestion={currentQuestion}
                    questions={questions}
                    tripData={tripData}
                    onAnswerChange={updateTripData}
                    onNext={nextQuestion}
                    onPrev={prevQuestion}
                    lang={lang}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
