import { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Car, Home, Check, User, MapPin,
  Calendar, Users, ChevronDown, Globe, Phone, Mail,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { avatarFor } from '@/lib/avatar';
import { allLanguages } from '@/data/languages';
import { useSubmitTripRequest } from '@/hooks/useSupabase';
import { useAuth } from '@/lib/AuthContext';

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'China',
  'Egypt', 'France', 'Germany', 'Greece', 'India', 'Indonesia', 'Iraq', 'Ireland',
  'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Lebanon', 'Malaysia',
  'Morocco', 'Netherlands', 'Norway', 'Oman', 'Pakistan', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
  'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Syria', 'Turkey',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uzbekistan', 'Yemen',
];

const LANGUAGES_ALL = ['English', 'Persian (Farsi)', 'Arabic', 'French', 'German', 'Spanish', 'Italian', 'Chinese', 'Russian', ...allLanguages];

const ACCOMMODATION_TYPES = [
  { value: 'guesthouse',        emoji: '🏠', en: 'Guesthouse',           fa: 'مهمان‌پذیر',    ar: 'بيت ضيافة'    },
  { value: 'hotel_1star',       emoji: '⭐', en: '1 Star Hotel',          fa: 'هتل ۱ ستاره',  ar: 'فندق نجمة'    },
  { value: 'hotel_2star',       emoji: '⭐⭐', en: '2 Star Hotel',        fa: 'هتل ۲ ستاره',  ar: 'فندق نجمتان'  },
  { value: 'hotel_3star',       emoji: '⭐⭐⭐', en: '3 Star Hotel',      fa: 'هتل ۳ ستاره',  ar: 'فندق 3 نجوم'  },
  { value: 'hotel_4star',       emoji: '⭐⭐⭐⭐', en: '4 Star Hotel',    fa: 'هتل ۴ ستاره',  ar: 'فندق 4 نجوم'  },
  { value: 'hotel_5star',       emoji: '⭐⭐⭐⭐⭐', en: '5 Star Hotel',  fa: 'هتل ۵ ستاره',  ar: 'فندق 5 نجوم'  },
  { value: 'traditional_house', emoji: '🏡', en: 'Traditional House',    fa: 'خانه سنتی',    ar: 'بيت تقليدي'   },
];

const STEP_LABELS = ['Customization', 'Traveler Details', 'Done'];

// ── Sidebar Card ───────────────────────────────────────────────────────────────

function TripSidebarCard({ guide, destination, date, adults, children, lang }) {
  const name = guide?.full_name || 'Guide';
  const city = destination || guide?.city || '—';
  const month = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : (lang === 'fa' ? 'تاریخ نامشخص' : 'Date TBD');
  const total = (adults || 1) + (children || 0);

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-md p-6 sticky top-24">
      <p className="font-body text-xs uppercase tracking-widest text-gold mb-3">
        {lang === 'fa' ? 'جزئیات سفر' : lang === 'ar' ? 'تفاصيل الرحلة' : 'Your Trip'}
      </p>

      <h3 className="font-heading text-lg font-semibold text-foreground leading-snug mb-4">
        {lang === 'fa'
          ? `سفر من با ${name} در ${month}`
          : lang === 'ar'
          ? `رحلتي مع ${name} في ${month}`
          : `My Trip With ${name} In ${month}`}
      </h3>

      <div className="space-y-3 mb-5 text-sm font-body">
        <div className="flex items-center gap-2 text-foreground/70">
          <MapPin className="w-4 h-4 text-gold flex-shrink-0" />
          <span>{city}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground/70">
          <Users className="w-4 h-4 text-gold flex-shrink-0" />
          <span>
            {total} {lang === 'fa' ? 'نفر' : lang === 'ar' ? 'أشخاص' : `traveller${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        {date && (
          <div className="flex items-center gap-2 text-foreground/70">
            <Calendar className="w-4 h-4 text-gold flex-shrink-0" />
            <span>{new Date(date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Guide mini-card */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/40">
        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-gold/30">
          <img decoding="async" loading="lazy"
            src={avatarFor(guide)}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <p className="font-body text-sm font-semibold text-foreground">{name}</p>
          <p className="font-body text-xs text-muted-foreground">
            {lang === 'fa' ? 'راهنمای گردشگری' : lang === 'ar' ? 'مرشد سياحي' : 'Tour Guide'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total, labels, loggedIn }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const autoSkipped = loggedIn && i === 1;
        const done = autoSkipped ? (current >= 2) : (i < current);
        const active = !autoSkipped && i === current;

        let circleClass;
        if (autoSkipped) {
          circleClass = current >= 2
            ? 'bg-emerald-500/20 text-emerald-600 border-2 border-emerald-400/50'
            : 'border-2 border-dashed border-emerald-400/50 text-emerald-500/60 bg-transparent';
        } else if (done) {
          circleClass = 'bg-gold text-black';
        } else if (active) {
          circleClass = 'bg-gold text-black ring-4 ring-gold/20';
        } else {
          circleClass = 'bg-muted text-muted-foreground';
        }

        const showCheck = (!autoSkipped && done) || (autoSkipped && current >= 2);

        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${circleClass}`}>
                {showCheck ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`font-body text-xs font-medium hidden sm:block ${
                autoSkipped ? 'text-emerald-600 dark:text-emerald-400' : active ? 'text-foreground' : done ? 'text-gold' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`h-0.5 w-8 sm:w-16 rounded-full ${done ? 'bg-gold' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({ data, onChange, onNext, isLoggedIn, isSubmitting, lang }) {
  const [requirements, setRequirements] = useState(data.requirements || '');
  const [language, setLanguage] = useState(data.language || '');
  const [transport, setTransport] = useState(data.transport || false);
  const [accommodation, setAccommodation] = useState(data.accommodation || false);
  const [accommodationType, setAccommodationType] = useState(data.accommodationType || '');

  const handleNext = () => {
    onNext({ requirements, language, transport, accommodation, accommodationType });
  };

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
        {lang === 'fa' ? 'جزئیات سفارشی‌سازی' : lang === 'ar' ? 'تفاصيل التخصيص' : 'Customization Details'}
      </h2>

      <div className="space-y-6">
        {/* Requirements textarea */}
        <div>
          <label className="block font-body text-sm font-medium text-foreground mb-2">
            {lang === 'fa' ? 'نیازمندی‌های شما' : lang === 'ar' ? 'متطلباتك' : 'Requirements'}
          </label>
          <textarea
            rows={5}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder={lang === 'fa' ? 'نیازمندی‌های خود را بنویسید...' : lang === 'ar' ? 'أخبرنا عن متطلباتك...' : 'Tell us your requirements, interests, and any special needs...'}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 resize-none transition"
          />
        </div>

        {/* Language dropdown */}
        <div>
          <label className="block font-body text-sm font-medium text-foreground mb-2">
            {lang === 'fa' ? 'زبان ترجیحی' : lang === 'ar' ? 'اختر اللغة' : 'Choose Language'}
          </label>
          <div className="relative">
            <Globe className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 appearance-none cursor-pointer"
            >
              <option value="">{lang === 'fa' ? '-- زبان را انتخاب کنید --' : '-- Select language --'}</option>
              {LANGUAGES_ALL.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Assistance toggles */}
        <div>
          <label className="block font-body text-sm font-medium text-foreground mb-3">
            {lang === 'fa' ? 'به کمک نیاز دارم با:' : lang === 'ar' ? 'أحتاج مساعدة في:' : 'I need assistance with'}
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Transportation */}
            <button
              type="button"
              onClick={() => setTransport(!transport)}
              className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
                transport
                  ? 'border-gold bg-gold/5 shadow-md'
                  : 'border-border bg-background hover:border-gold/40'
              }`}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                transport ? 'border-gold bg-gold' : 'border-border'
              }`}>
                {transport && <Check className="w-4 h-4 text-black" />}
              </div>
              <Car className={`w-8 h-8 ${transport ? 'text-gold' : 'text-muted-foreground'}`} />
              <span className={`font-body text-sm font-semibold ${transport ? 'text-gold' : 'text-foreground'}`}>
                {lang === 'fa' ? 'حمل‌ونقل' : lang === 'ar' ? 'النقل' : 'Transportation'}
              </span>
            </button>

            {/* Accommodation */}
            <button
              type="button"
              onClick={() => {
                const next = !accommodation;
                setAccommodation(next);
                if (!next) setAccommodationType('');
              }}
              className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
                accommodation
                  ? 'border-gold bg-gold/5 shadow-md'
                  : 'border-border bg-background hover:border-gold/40'
              }`}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                accommodation ? 'border-gold bg-gold' : 'border-border'
              }`}>
                {accommodation && <Check className="w-4 h-4 text-black" />}
              </div>
              <Home className={`w-8 h-8 ${accommodation ? 'text-gold' : 'text-muted-foreground'}`} />
              <span className={`font-body text-sm font-semibold ${accommodation ? 'text-gold' : 'text-foreground'}`}>
                {lang === 'fa' ? 'اقامتگاه' : lang === 'ar' ? 'الإقامة' : 'Accommodation'}
              </span>
            </button>
          </div>

          {/* Accommodation type sub-panel */}
          <AnimatePresence>
            {accommodation && (
              <motion.div
                key="acc-type"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pt-4">
                  <p className="font-body text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    {lang === 'fa' ? 'نوع اقامتگاه' : lang === 'ar' ? 'نوع الإقامة' : 'Accommodation Type'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ACCOMMODATION_TYPES.map((type) => {
                      const label = lang === 'fa' ? type.fa : lang === 'ar' ? type.ar : type.en;
                      const selected = accommodationType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setAccommodationType(selected ? '' : type.value)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-body border transition-all duration-150 ${
                            selected
                              ? 'bg-gold text-black border-gold shadow-sm'
                              : 'bg-background text-foreground border-border hover:border-gold/50 hover:bg-gold/5'
                          }`}
                        >
                          <span>{type.emoji}</span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logged-in auto-submit notice */}
        {isLoggedIn && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="font-body text-sm text-emerald-700 dark:text-emerald-400">
              {lang === 'fa'
                ? 'شما وارد شده‌اید. اطلاعات شما به‌صورت خودکار ارسال خواهد شد.'
                : lang === 'ar'
                ? 'أنت مسجل الدخول. سيتم إرسال بياناتك تلقائياً.'
                : "You're signed in — your details will be submitted automatically."}
            </p>
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-black font-body font-bold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all shadow-md disabled:opacity-70"
        >
          {isSubmitting
            ? <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            : null}
          {isLoggedIn
            ? (lang === 'fa' ? 'ارسال درخواست' : lang === 'ar' ? 'إرسال الطلب' : 'Submit Request')
            : (lang === 'fa' ? 'مرحله بعد' : lang === 'ar' ? 'الخطوة التالية' : 'Next Step')}
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </motion.div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({ data, onBack, onSubmit, isSubmitting, lang }) {
  const [tab, setTab] = useState('guest'); // 'login' | 'guest'
  const [form, setForm] = useState({
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    country: data.country || '',
    phone: data.phone || '',
    email: data.email || '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    await onSubmit(form);
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition';
  const labelClass = 'block font-body text-xs font-medium text-muted-foreground mb-1.5';

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
        {lang === 'fa' ? 'اطلاعات مسافر' : lang === 'ar' ? 'تفاصيل المسافر' : 'Traveler Details'}
      </h2>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden mb-6 bg-muted/30">
        {[
          { id: 'login', label: lang === 'fa' ? 'ورود' : lang === 'ar' ? 'تسجيل الدخول' : 'Login' },
          { id: 'guest', label: lang === 'fa' ? 'ادامه به عنوان مهمان' : lang === 'ar' ? 'متابعة كضيف' : 'Fill as Guest' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-2.5 font-body text-sm font-medium transition-all duration-150 ${
              tab === id ? 'bg-gold text-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'login' ? (
        <div className="text-center py-10">
          <User className="w-12 h-12 text-gold/40 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground mb-4">
            {lang === 'fa' ? 'برای ادامه وارد شوید' : 'Sign in to continue with your account details'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gold text-black font-body font-bold text-sm hover:bg-gold/90 transition"
          >
            {lang === 'fa' ? 'ورود به حساب' : 'Sign In'}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{lang === 'fa' ? 'نام' : 'First Name'}</label>
              <input type="text" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder={lang === 'fa' ? 'علی' : 'John'} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{lang === 'fa' ? 'نام‌خانوادگی' : 'Last Name'}</label>
              <input type="text" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder={lang === 'fa' ? 'رضایی' : 'Doe'} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>{lang === 'fa' ? 'کشور' : 'Country'}</label>
            <div className="relative">
              <Globe className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                className={`${inputClass} ps-10`}
              >
                <option value="">{lang === 'fa' ? '-- کشور خود را انتخاب کنید --' : '-- Select country --'}</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>{lang === 'fa' ? 'شماره تلفن' : 'Phone Number'}</label>
            <div className="relative">
              <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+1 555 000 0000"
                dir="ltr"
                className={`${inputClass} ps-10`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{lang === 'fa' ? 'ایمیل' : 'Email'}</label>
            <div className="relative">
              <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@example.com"
                className={`${inputClass} ps-10`}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'guest' && (
        <div className="flex gap-3 mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border text-foreground font-body font-semibold text-sm hover:border-gold/40 hover:text-gold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'fa' ? 'بازگشت' : 'Back'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black font-body font-bold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            ) : null}
            {lang === 'fa' ? 'ارسال درخواست سفارشی' : lang === 'ar' ? 'إرسال طلب التخصيص' : 'Send Customization Request'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Step 3: Success ────────────────────────────────────────────────────────────

function Step3({ lang }) {
  const navigate = useNavigate();

  const bullets = [
    lang === 'fa' ? 'به زودی پیشنهادات سفر شخصی دریافت خواهید کرد' : 'You will receive personalized travel proposals shortly',
    lang === 'fa' ? 'ممکن است یک نماینده ایران تور ادوایزر با شما تماس بگیرد' : 'An Iran Trip Advisor representative may contact you',
    lang === 'fa' ? 'برای کمک فوری از دستیار هوش مصنوعی ما استفاده کنید' : 'For immediate assistance, use our AI Assistant',
    lang === 'fa' ? '#آیا می‌دانستید با رزرو راهنمای محلی از جوامع ایرانی حمایت می‌کنید' : '#didyouknow By booking a local guide you support Iranian communities',
  ];

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="text-center py-6"
    >
      {/* Checkmark */}
      <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
      </div>

      <h2 className="font-heading text-3xl font-bold text-foreground mb-2">
        {lang === 'fa' ? 'همه چیز آماده است!' : lang === 'ar' ? 'تم بنجاح!' : 'All done!'}
      </h2>
      <p className="font-body text-muted-foreground mb-8">
        {lang === 'fa' ? 'درخواست سفر شما دریافت شد' : lang === 'ar' ? 'لقد تلقينا طلب سفرك' : 'We have received your travel request'}
      </p>

      {/* Info box */}
      <div className="text-start p-5 rounded-2xl bg-gold/10 border border-gold/20 mb-8">
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 font-body text-sm text-foreground/80">
              <span className="w-5 h-5 rounded-full bg-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-black" />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl border-2 border-gold/30 text-gold font-body font-semibold text-sm hover:bg-gold/5 transition"
        >
          {lang === 'fa' ? 'بازگشت به صفحه اصلی' : 'Back to Home'}
        </button>
        <button
          onClick={() => navigate('/profile/requests')}
          className="px-6 py-3 rounded-xl bg-gold text-black font-body font-bold text-sm hover:bg-gold/90 transition"
        >
          {lang === 'fa' ? 'مشاهده درخواست‌های من' : 'View My Requests'}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TripRequest() {
  const { guideId } = useParams();
  const location = useLocation();
  const { state } = location;
  const { lang, dir } = useI18n();
  const { user, profile } = useAuth();
  const { submit, loading: isSubmitting } = useSubmitTripRequest();

  const isAgencyRoute = location.pathname.includes('/request-trip/agency/');

  const guide = state?.guide || null;
  const initialDestination = state?.destination || '';
  const initialDate = state?.date || '';
  const initialAdults = state?.adults || 1;
  const initialChildren = state?.children || 0;

  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState({});
  const [step2Data, setStep2Data] = useState({});

  const buildPayload = (s1, traveler) => ({
    guideId: isAgencyRoute ? null : guideId,
    agencyId: isAgencyRoute ? guideId : null,
    ...traveler,
    destinationCity: initialDestination || null,
    startDate: initialDate || null,
    adults: initialAdults,
    children: initialChildren,
    language: s1.language || null,
    needsTransport: s1.transport || false,
    needsAccommodation: s1.accommodation || false,
    accommodationType: s1.accommodationType || null,
    requirements: s1.requirements || null,
  });

  const handleStep1Done = async (data) => {
    setStep1Data(data);
    if (user) {
      await submit(buildPayload(data, {
        travelerId: user.id,
        travelerName: profile?.full_name || null,
        travelerEmail: user.email || null,
        travelerPhone: profile?.phone_number || null,
        country: profile?.country || null,
      }));
      setStep(2);
    } else {
      setStep(1);
    }
  };

  const handleStep2Done = async (formData) => {
    setStep2Data(formData);
    await submit(buildPayload(step1Data, {
      travelerId: null,
      travelerName: `${formData.firstName} ${formData.lastName}`.trim() || null,
      travelerEmail: formData.email || null,
      travelerPhone: formData.phone || null,
      country: formData.country || null,
    }));
    setStep(2);
  };

  return (
    <div dir={dir} className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">

          {/* Main content */}
          <div>
            {/* Header */}
            <div className="mb-8">
              <p className="font-body text-xs uppercase tracking-widest text-gold mb-2">
                {lang === 'fa' ? 'رزرو سفر' : lang === 'ar' ? 'حجز رحلة' : 'Book A Trip'}
              </p>
              <h1 className="font-heading text-3xl font-bold text-foreground">
                {lang === 'fa' ? 'درخواست سفر سفارشی' : lang === 'ar' ? 'طلب رحلة مخصصة' : 'Customized Trip Request'}
              </h1>
            </div>

            {step < 2 && (
              <StepIndicator current={step} total={STEP_LABELS.length} labels={STEP_LABELS} loggedIn={!!user} />
            )}

            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <Step1
                    key="s1"
                    data={step1Data}
                    onNext={handleStep1Done}
                    isLoggedIn={!!user}
                    isSubmitting={isSubmitting}
                    lang={lang}
                  />
                )}
                {step === 1 && (
                  <Step2
                    key="s2"
                    data={step2Data}
                    onBack={() => setStep(0)}
                    onSubmit={handleStep2Done}
                    isSubmitting={isSubmitting}
                    lang={lang}
                  />
                )}
                {step === 2 && (
                  <Step3 key="s3" lang={lang} />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar */}
          {step < 2 && (
            <div>
              <TripSidebarCard
                guide={guide}
                destination={initialDestination}
                date={initialDate}
                adults={initialAdults}
                children={initialChildren}
                lang={lang}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
