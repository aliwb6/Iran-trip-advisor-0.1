import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Calendar, Users, ChevronLeft, ChevronRight,
  Check, Wallet, FileText, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/AuthContext';
import { createTripRequest } from '../../api/tripRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { useI18n } from '@/lib/i18n.jsx';
import { localize, localizeTripOption } from '@/lib/localize';
const INTERESTS = [
  'Architecture', 'History', 'Nature', 'Food', 'Photography',
  'Desert', 'Luxury', 'Culture', 'Research', 'Art',
];

const BUDGET_OPTIONS = [
  { value: 'Budget', label: 'Budget', desc: 'Economical options', icon: '💰' },
  { value: 'Mid-range', label: 'Mid-range', desc: 'Comfort & value', icon: '✈️' },
  { value: 'Luxury', label: 'Luxury', desc: 'Premium experience', icon: '⭐' },
];

const INTEREST_COLORS = {
  Architecture: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  History:      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  Nature:       'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  Food:         'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  Photography:  'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  Desert:       'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  Luxury:       'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700',
  Culture:      'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
  Research:     'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
  Art:          'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700',
};

function StepIndicator({ step, totalSteps }) {
  const { lang } = useI18n();
  const labels = [
    localize(lang, 'Destination', 'مقصد', 'الوجهة'),
    localize(lang, 'Interests', 'علایق', 'الاهتمامات'),
    localize(lang, 'Details', 'جزئیات', 'التفاصيل'),
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {labels.map((label, i) => {
        const s = i + 1;
        const done = step > s;
        const active = step === s;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                done    ? 'bg-accent text-white'
                : active ? 'bg-accent text-white ring-4 ring-accent/20'
                :          'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-[10px] font-medium font-body whitespace-nowrap transition-colors ${
                active ? 'text-accent' : done ? 'text-accent/70' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-4 rounded-full transition-all duration-300 ${
                step > s ? 'bg-accent' : 'bg-border/50'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step1({ form, setField, errors }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  return (
    <div className="space-y-5">
      <div>
        <label className="block font-body text-sm font-medium text-foreground mb-1.5">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gold" />
            {l('Destination in Iran', 'مقصد در ایران', 'الوجهة في إيران')}
          </span>
        </label>
        <Input
          value={form.destination}
          onChange={e => setField('destination', e.target.value)}
          placeholder={l('e.g. Isfahan, Shiraz, Yazd…', 'مثلاً اصفهان، شیراز، یزد…', 'مثلاً أصفهان، شيراز، يزد…')}
          className="font-body rounded-xl border-border/60 focus:border-accent/50 focus:ring-accent/20"
        />
        {errors.destination && (
          <p className="font-body text-xs text-destructive mt-1">{errors.destination}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-body text-xs font-medium text-muted-foreground mb-1.5">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            {l('Start Date', 'تاریخ شروع', 'تاريخ البداية')}
          </label>
          <Input
            type="date"
            value={form.startDate}
            onChange={e => setField('startDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="font-body rounded-xl border-border/60 focus:border-accent/50 text-sm"
          />
          {errors.startDate && (
            <p className="font-body text-xs text-destructive mt-1">{errors.startDate}</p>
          )}
        </div>
        <div>
          <label className="block font-body text-xs font-medium text-muted-foreground mb-1.5">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            {l('End Date', 'تاریخ پایان', 'تاريخ النهاية')}
          </label>
          <Input
            type="date"
            value={form.endDate}
            onChange={e => setField('endDate', e.target.value)}
            min={form.startDate || new Date().toISOString().split('T')[0]}
            className="font-body rounded-xl border-border/60 focus:border-accent/50 text-sm"
          />
          {errors.endDate && (
            <p className="font-body text-xs text-destructive mt-1">{errors.endDate}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block font-body text-sm font-medium text-foreground mb-1.5">
          <Users className="w-3.5 h-3.5 inline mr-1 text-gold" />
          {l('Group Size', 'تعداد همسفران', 'عدد المسافرين')}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setField('groupSize', Math.max(1, form.groupSize - 1))}
            disabled={form.groupSize <= 1}
            className="w-9 h-9 rounded-full border-2 border-border/50 flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 transition-colors font-body text-base"
          >
            −
          </button>
          <span className="w-10 text-center font-body font-semibold text-foreground tabular-nums">
            {form.groupSize}
          </span>
          <button
            type="button"
            onClick={() => setField('groupSize', Math.min(20, form.groupSize + 1))}
            disabled={form.groupSize >= 20}
            className="w-9 h-9 rounded-full border-2 border-border/50 flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 transition-colors font-body text-base"
          >
            +
          </button>
          <span className="font-body text-sm text-muted-foreground">
            {l(form.groupSize === 1 ? 'person' : 'people', 'نفر', 'شخص')}
          </span>
        </div>
      </div>
    </div>
  );
}

function Step2({ form, setField }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const toggleInterest = (interest) => {
    setField(
      'interests',
      form.interests.includes(interest)
        ? form.interests.filter(i => i !== interest)
        : [...form.interests, interest]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block font-body text-sm font-medium text-foreground mb-3">
          {l('What are you interested in?', 'به چه چیزهایی علاقه دارید؟', 'ما الذي يثير اهتمامك؟')} <span className="text-muted-foreground font-normal">{l('(select all that apply)', '(هر تعداد که می‌خواهید انتخاب کنید)', '(اختر كل ما يناسبك)')}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(interest => {
            const selected = form.interests.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`relative px-3 py-1.5 rounded-full text-xs font-medium font-body border-2 transition-all ${
                  selected
                    ? `${INTEREST_COLORS[interest]} border-current shadow-sm`
                    : 'border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground bg-background'
                }`}
              >
                {selected && (
                  <Check className="w-3 h-3 inline mr-1 -mt-0.5" />
                )}
                {localizeTripOption(interest, lang)}
              </button>
            );
          })}
        </div>
        {form.interests.length === 0 && (
          <p className="font-body text-xs text-muted-foreground mt-2">{l('Select at least one interest to help guides find you.', 'برای کمک به راهنماها در یافتن شما، دست‌کم یک علاقه انتخاب کنید.', 'اختر اهتماماً واحداً على الأقل ليسهل على المرشدين العثور على طلبك.')}</p>
        )}
      </div>

      <div>
        <label className="block font-body text-sm font-medium text-foreground mb-3">
          <Wallet className="w-3.5 h-3.5 inline mr-1 text-gold" />
          {l('Budget Range', 'محدوده بودجه', 'نطاق الميزانية')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {BUDGET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('budget', opt.value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                form.budget === opt.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground bg-card'
              }`}
            >
              <span className="text-xl">{opt.icon}</span>
              <span className="font-body text-xs font-semibold">{localizeTripOption(opt.label, lang)}</span>
              <span className="font-body text-[10px] text-center opacity-70">{({ Budget: l('Economical options', 'گزینه‌های کم‌هزینه', 'خيارات اقتصادية'), 'Mid-range': l('Comfort & value', 'آسایش با قیمت مناسب', 'راحة بسعر مناسب'), Luxury: l('Premium experience', 'تجربه ممتاز', 'تجربة فاخرة') })[opt.value]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3({ form, setField, errors }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const suggestTitle = () => {
    if (!form.destination) return;
    const top = form.interests.slice(0, 2).map(interest => localizeTripOption(interest, lang)).join(lang === 'fa' ? ' و ' : lang === 'ar' ? ' و' : ' & ');
    const suggestion = top
      ? (lang === 'fa' ? `سفر ${top} در ${form.destination}` : lang === 'ar' ? `رحلة ${top} في ${form.destination}` : `${top} trip in ${form.destination}`)
      : (lang === 'fa' ? `سفر اختصاصی به ${form.destination}` : lang === 'ar' ? `رحلة مخصصة إلى ${form.destination}` : `Custom trip to ${form.destination}`);
    setField('title', suggestion);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block font-body text-sm font-medium text-foreground mb-1.5">
          <FileText className="w-3.5 h-3.5 inline mr-1 text-gold" />
          {l('Trip Title', 'عنوان سفر', 'عنوان الرحلة')}
        </label>
        <div className="flex gap-2">
          <Input
            value={form.title}
            onChange={e => setField('title', e.target.value)}
            placeholder={l('Give your trip a name…', 'برای سفرتان نامی بگذارید…', 'امنح رحلتك اسماً…')}
            className="font-body rounded-xl border-border/60 focus:border-accent/50 flex-1"
          />
          <button
            type="button"
            onClick={suggestTitle}
            title={l('Auto-suggest title', 'پیشنهاد خودکار عنوان', 'اقتراح عنوان تلقائياً')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-accent/50 transition font-body text-xs whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {l('Suggest', 'پیشنهاد عنوان', 'اقتراح')}
          </button>
        </div>
        {errors.title && (
          <p className="font-body text-xs text-destructive mt-1">{errors.title}</p>
        )}
      </div>

      <div>
        <label className="block font-body text-sm font-medium text-foreground mb-1.5">
          {l('Special Requirements', 'نیازهای ویژه', 'احتياجات خاصة')} <span className="text-muted-foreground font-normal">{l('(optional)', '(اختیاری)', '(اختياري)')}</span>
        </label>
        <Textarea
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          placeholder={l('Dietary needs, accessibility requirements, specific sites to visit, pace preferences…', 'نیازهای غذایی، دسترس‌پذیری، مکان‌های دلخواه یا سرعت سفر…', 'الاحتياجات الغذائية أو متطلبات سهولة الوصول أو الأماكن التي ترغب بزيارتها أو وتيرة الرحلة…')}
          rows={4}
          className="font-body rounded-xl border-border/60 focus:border-accent/50 resize-none"
        />
      </div>

      {/* Summary preview */}
      <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-2.5">
        <p className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {l('Trip Summary', 'خلاصه سفر', 'ملخص الرحلة')}
        </p>
        <div className="flex items-start gap-2 font-body text-sm">
          <MapPin className="w-4 h-4 text-gold mt-0.5 shrink-0" />
          <span className="text-foreground">{form.destination || <span className="text-muted-foreground/50">{l('No destination', 'مقصد مشخص نشده', 'لم تُحدَّد الوجهة')}</span>}</span>
        </div>
        {(form.startDate || form.endDate) && (
          <div className="flex items-center gap-2 font-body text-sm">
            <Calendar className="w-4 h-4 text-gold shrink-0" />
            <span className="text-foreground">
              {form.startDate && new Date(form.startDate).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {form.startDate && form.endDate && ' → '}
              {form.endDate && new Date(form.endDate).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 font-body text-sm">
          <Users className="w-4 h-4 text-gold shrink-0" />
          <span className="text-foreground">{form.groupSize} {l(form.groupSize === 1 ? 'person' : 'people', 'نفر', 'شخص')}</span>
        </div>
        {form.budget && (
          <div className="flex items-center gap-2 font-body text-sm">
            <Wallet className="w-4 h-4 text-gold shrink-0" />
            <span className="text-foreground">{localizeTripOption(form.budget, lang)}</span>
          </div>
        )}
        {form.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {form.interests.map(i => (
              <span
                key={i}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-body ${
                  INTEREST_COLORS[i] || 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {localizeTripOption(i, lang)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const INITIAL_FORM = {
  destination: '',
  startDate: '',
  endDate: '',
  groupSize: 1,
  interests: [],
  budget: '',
  title: '',
  notes: '',
};

export default function TripRequestForm({ onClose }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const validateStep1 = () => {
    const errs = {};
    if (!form.destination.trim()) errs.destination = l('Please enter a destination.', 'لطفاً مقصدی وارد کنید.', 'يُرجى إدخال وجهة.');
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errs.endDate = l('End date must be after start date.', 'تاریخ پایان باید پس از تاریخ شروع باشد.', 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية.');
    }
    return errs;
  };

  const validateStep3 = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = l('Please enter a trip title.', 'لطفاً برای سفر عنوانی وارد کنید.', 'يُرجى إدخال عنوان للرحلة.');
    return errs;
  };

  const goNext = () => {
    const errs = step === 1 ? validateStep1() : {};
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setDirection(1);
    setStep(s => s + 1);
  };

  const goBack = () => {
    setErrors({});
    setDirection(-1);
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error(l('Please sign in to submit a trip request.', 'برای ثبت درخواست سفر، ابتدا وارد حساب خود شوید.', 'يُرجى تسجيل الدخول لإرسال طلب الرحلة.'));
      return;
    }
    const errs = validateStep3();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      await createTripRequest(user.id, {
        title: form.title.trim(),
        destination: form.destination.trim(),
        dates: form.startDate || form.endDate
          ? { start: form.startDate || null, end: form.endDate || null }
          : null,
        interests: form.interests,
        groupSize: form.groupSize,
        budget: form.budget || null,
        notes: form.notes.trim() || null,
      });

      toast.success(l('Your trip request has been sent to available guides!', 'درخواست سفرتان برای راهنماهای در دسترس ارسال شد!', 'أُرسل طلب رحلتك إلى المرشدين المتاحين!'));
      if (onClose) onClose();
      navigate('/my-trips');
    } catch (err) {
      toast.error(l('Failed to submit trip request. Please try again.', 'ثبت درخواست سفر انجام نشد. لطفاً دوباره تلاش کنید.', 'تعذر إرسال طلب الرحلة. يُرجى المحاولة مجدداً.'));
    } finally {
      setSubmitting(false);
    }
  };

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <StepIndicator step={step} totalSteps={3} />

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && <Step1 form={form} setField={setField} errors={errors} />}
            {step === 2 && <Step2 form={form} setField={setField} />}
            {step === 3 && <Step3 form={form} setField={setField} errors={errors} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-border/40">
        {step > 1 ? (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            <ChevronLeft className="w-4 h-4" />
            {l('Back', 'بازگشت', 'رجوع')}
          </button>
        ) : (
          <button
            onClick={onClose}
            className="font-body text-sm text-muted-foreground hover:text-foreground transition"
          >
            {l('Cancel', 'انصراف', 'إلغاء')}
          </button>
        )}

        {step < 3 ? (
          <Button
            onClick={goNext}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-body font-semibold rounded-xl px-5"
          >
            {l('Next', 'بعدی', 'التالي')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-black font-body font-bold rounded-xl px-5 disabled:opacity-60"
          >
            {submitting ? (
              <BreathingGlow className="w-4 h-4" label={l('Submitting request', 'در حال ارسال درخواست', 'جارٍ إرسال الطلب')} />
            ) : null}
            {submitting ? l('Submitting…', 'در حال ارسال…', 'جارٍ الإرسال…') : l('Send to Guides', 'ارسال برای راهنماها', 'إرسال إلى المرشدين')}
          </Button>
        )}
      </div>
    </div>
  );
}
