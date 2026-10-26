import IconSwap from '@/components/ui/IconSwap';
import {
  useState } from 'react';
import { Link,
  useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { motion,
  AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Phone,
  Globe,
  Eye,
  EyeOff,
  Compass,
  Shield,
  MapPin,
  Building2,
  ArrowRight,
  ArrowLeft,
  Star,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { localize, localizeCountry } from '@/lib/localize';

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belgium', 'Brazil', 'Bulgaria', 'Canada',
  'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt',
  'Estonia', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Hungary', 'India', 'Indonesia', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Lebanon', 'Malaysia',
  'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman',
  'Pakistan', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia',
  'Saudi Arabia', 'Serbia', 'Singapore', 'South Africa', 'South Korea', 'Spain',
  'Sri Lanka', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen',
];
const ROLES = [
  { value: 'traveler', en: 'Traveler', fa: 'مسافر', ar: 'مسافر', icon: Compass },
  { value: 'guide', en: 'Tour Guide', fa: 'راهنمای سفر', ar: 'مرشد سياحي', icon: MapPin },
  { value: 'agency', en: 'Travel Agency', fa: 'آژانس مسافرتی', ar: 'وكالة سفر', icon: Building2 },
];

const BENEFITS = [
  {
    icon: Compass,
    en: { title: 'Explore Iran', desc: "Curated journeys through ancient Persia's living heritage" },
    fa: { title: 'ایران را کشف کنید', desc: 'سفرهای منتخب در دل تمدن باستانی ایران' },
    ar: { title: 'اكتشف إيران', desc: 'رحلات مختارة للتعرّف على التراث الإيراني العريق الحيّ' },
  },
  {
    icon: User,
    en: { title: 'Find Your Guide', desc: 'Connect with verified local experts who bring every story to life' },
    fa: { title: 'راهنمای خود را بیابید', desc: 'با کارشناسان محلی تأیید شده آشنا شوید' },
    ar: { title: 'اعثر على مرشدك', desc: 'تواصل مع خبراء محليين موثوقين يُحيون قصص كل وجهة' },
  },
  {
    icon: Shield,
    en: { title: 'Travel with Confidence', desc: 'Transparent pricing, authentic experiences, total peace of mind' },
    fa: { title: 'با اطمینان سفر کنید', desc: 'قیمت‌های شفاف، تجربه‌های اصیل، خیال آسوده' },
    ar: { title: 'سافر بثقة', desc: 'أسعار واضحة وتجارب أصيلة وراحة بال' },
  },
];

export default function Register() {
  const { lang, dir } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const navigate = useNavigate();
  const isRtl = dir === 'rtl';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const [role, setRole] = useState('traveler');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    country: '',
    gender: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return l('First and last name are required', 'نام و نام خانوادگی را وارد کنید.', 'يرجى إدخال الاسم الأول واسم العائلة.');
    }
    if (!formData.email.trim()) {
      return l('Email is required', 'ایمیل را وارد کنید.', 'يرجى إدخال البريد الإلكتروني.');
    }
    if (!formData.phone.trim()) {
      return l('Phone number is required', 'شمارهٔ تلفن را وارد کنید.', 'يرجى إدخال رقم الهاتف.');
    }
    if (formData.password.length < 8) {
      return l('Password must be at least 8 characters', 'رمز عبور باید دست‌کم ۸ نویسه داشته باشد.', 'يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل.');
    }
    if (!formData.gender) {
      return l('Please select your gender', 'لطفاً جنسیت خود را انتخاب کنید.', 'يرجى اختيار الجنس.');
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);

    try {
      // Profile row is created automatically by the handle_new_user DB trigger
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: `${formData.firstName} ${formData.lastName}`.trim(),
            role,
            gender: formData.gender,
            phone: formData.phone || null,
            country: formData.country || null,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Auto sign-in immediately after signup (no email confirmation wait)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      navigate('/');
      window.location.reload();
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError(l('This email is already registered.', 'این ایمیل قبلاً ثبت شده است.', 'هذا البريد الإلكتروني مسجّل بالفعل.'));
      } else {
        setError(l(`Registration failed: ${msg}`, 'ثبت‌نام ممکن نشد. لطفاً دوباره تلاش کنید.', 'تعذّر إنشاء الحساب. يُرجى المحاولة مجدداً.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen flex">

      {/* ── Left Panel: Dark Benefits ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between relative overflow-hidden bg-[hsl(222,55%,8%)]">
        {/* Subtle geometric overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, hsl(178,85%,32%) 0%, transparent 50%),
                              radial-gradient(circle at 70% 80%, hsl(38,62%,52%) 0%, transparent 45%)`,
          }}
        />
        {/* Persian tile grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, hsl(178,85%,60%) 0px, transparent 1px, transparent 40px, hsl(178,85%,60%) 41px),
                              repeating-linear-gradient(-45deg, hsl(178,85%,60%) 0px, transparent 1px, transparent 40px, hsl(178,85%,60%) 41px)`,
          }}
        />

        <div className="relative z-10 flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[hsl(178,85%,32%)] flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-white text-xl font-bold tracking-wide">
              Iran Trip Advisor
            </span>
          </div>

          {/* Headline */}
          <div className="mb-12">
            <h2 className="font-heading text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              {lang === 'fa' ? (
                <>سفری که<br /><span className="text-[hsl(178,85%,50%)]">فراموش نمی‌کنید</span></>
              ) : lang === 'ar' ? (
                <>رحلةٌ<br /><span className="text-[hsl(178,85%,50%)]">لا تُنسى</span></>
              ) : (
                <>A Journey<br /><span className="text-[hsl(178,85%,50%)]">Unforgettable</span></>
              )}
            </h2>
            <p className="font-body text-[hsl(222,20%,65%)] text-base leading-relaxed max-w-xs">
              {l('Join thousands of travellers who discovered Iran with us', 'به هزاران مسافری بپیوندید که با ما ایران را کشف کرده‌اند.', 'انضمّ إلى آلاف المسافرين الذين اكتشفوا إيران معنا.')}
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-6 flex-1">
            {BENEFITS.map(({ icon: Icon, en, fa, ar }, i) => {
              const content = lang === 'fa' ? fa : lang === 'ar' ? ar : en;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isRtl ? 24 : -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4"
                >
                  <div className="mt-0.5 w-10 h-10 rounded-xl bg-[hsl(178,85%,32%)]/20 border border-[hsl(178,85%,32%)]/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[hsl(178,85%,50%)]" />
                  </div>
                  <div>
                    <p className="font-body text-white font-semibold text-sm mb-0.5">{content.title}</p>
                    <p className="font-body text-[hsl(222,15%,58%)] text-xs leading-relaxed">{content.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom quote */}
          <div className="mt-auto pt-10 border-t border-white/10">
            <p className="font-body text-[hsl(222,15%,50%)] text-xs italic leading-relaxed">
              {l('"Iran is a land that must be seen with fresh eyes each time"', '«ایران سرزمینی است که هر بار باید آن را با نگاهی تازه دید.»', '«إيران بلد يستحق أن تراه كل مرة بعينين جديدتين.»')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-1">
              {l('Create Account', 'ثبت‌نام', 'إنشاء حساب')}
            </h1>
            <p className="font-body text-muted-foreground text-sm">
              {l('Start your Iranian adventure today', 'سفر خود در ایران را از همین‌جا آغاز کنید.', 'ابدأ مغامرتك في إيران اليوم.')}
            </p>
          </div>

          {/* Role Tabs */}
          <div className="mb-6">
            <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40">
              {ROLES.map(({ value, en, fa, ar, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-body text-sm font-medium transition-all duration-200 ${
                    role === value
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {l(en, fa, ar)}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-600 font-body text-sm leading-relaxed"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* First + Last Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-xs text-muted-foreground mb-1.5">
                  {l('First Name', 'نام', 'الاسم الأول')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={e => set('firstName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                  placeholder={l('John', 'علی', 'أحمد')}
                />
              </div>
              <div>
                <label className="block font-body text-xs text-muted-foreground mb-1.5">
                  {l('Last Name', 'نام خانوادگی', 'اسم العائلة')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={e => set('lastName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                  placeholder={l('Doe', 'رضایی', 'الحسن')}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block font-body text-xs text-muted-foreground mb-1.5">
                {l('Email', 'ایمیل', 'البريد الإلكتروني')} *
              </label>
              <div className="relative">
                <Mail className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'end-3.5' : 'start-3.5'}`} />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => set('email', e.target.value)}
                  className={`w-full ${isRtl ? 'pe-10 ps-3.5' : 'ps-10 pe-3.5'} py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block font-body text-xs text-muted-foreground mb-1.5">
                {l('Phone Number', 'شمارهٔ تلفن', 'رقم الهاتف')} *
              </label>
              <div className="relative">
                <Phone className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'end-3.5' : 'start-3.5'}`} />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => set('phone', e.target.value)}
                  className={`w-full ${isRtl ? 'pe-10 ps-3.5' : 'ps-10 pe-3.5'} py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition`}
                  placeholder={l('+1 (555) 000-0000', '+98 XXX XXX XXXX', '+971 XX XXX XXXX')}
                  autoComplete="tel"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block font-body text-xs text-muted-foreground mb-1.5">
                {l('Password', 'رمز عبور', 'كلمة المرور')} *
              </label>
              <div className="relative">
                <Lock className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'end-3.5' : 'start-3.5'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={e => set('password', e.target.value)}
                  className={`w-full ${isRtl ? 'pe-10 ps-10' : 'ps-10 pe-10'} py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition ${isRtl ? 'start-3.5' : 'end-3.5'}`}
                  tabIndex={-1}
                >
                  {<IconSwap active={showPassword} a={<Eye className="w-4 h-4" />} b={<EyeOff className="w-4 h-4" />} />}
                </button>
              </div>
              <p className="mt-1 font-body text-xs text-muted-foreground/70">
                {l('Minimum 8 characters', 'دست‌کم ۸ نویسه', '8 أحرف على الأقل')}
              </p>
            </div>

            {/* Country */}
            <div>
              <label className="block font-body text-xs text-muted-foreground mb-1.5">
                {l('Country', 'کشور', 'البلد')}
              </label>
              <div className="relative">
                <Globe className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'end-3.5' : 'start-3.5'}`} />
                <select
                  value={formData.country}
                  onChange={e => set('country', e.target.value)}
                  className={`w-full ${isRtl ? 'pe-10 ps-3.5' : 'ps-10 pe-3.5'} py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition appearance-none cursor-pointer`}
                >
                  <option value="">
                    {l('-- Select your country --', '-- کشور خود را انتخاب کنید --', '-- اختر بلدك --')}
                  </option>
                  {COUNTRIES.map(c => (
                    <option key={c} value={c}>{localizeCountry(c, lang)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block font-body text-xs text-muted-foreground mb-2">
                {l('Gender', 'جنسیت', 'الجنس')} *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'male', fa: 'مرد', ar: 'ذكر', en: 'Male', img: '/avatars/default-male.png' },
                  { value: 'female', fa: 'زن', ar: 'أنثى', en: 'Female', img: '/avatars/default-female.png' },
                ].map(({ value, fa, ar, en, img }) => {
                  const selected = formData.gender === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('gender', value)}
                      aria-pressed={selected}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                        selected
                          ? 'border-accent bg-accent/10 shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:border-accent/40 hover:bg-accent/5'
                      }`}
                    >
                      <img decoding="async" loading="lazy"
                        src={img}
                        alt={en}
                        className={`w-14 h-14 rounded-full object-cover transition-opacity ${selected ? 'opacity-100' : 'opacity-80'}`}
                      />
                      <span className={`font-body text-sm font-semibold ${selected ? 'text-accent' : 'text-foreground'}`}>
                        {l(en, fa, ar)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-2 py-3 rounded-xl bg-accent text-white font-body font-semibold text-sm hover:bg-accent/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Arrow className="w-4 h-4" />}
              {loading
                ? l('Creating account...', 'در حال ساخت حساب…', 'جارٍ إنشاء الحساب…')
                : l('Create Account', 'ایجاد حساب کاربری', 'إنشاء حساب')}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center font-body text-sm text-muted-foreground">
            {l('Already have an account?', 'قبلاً حساب ساخته‌اید؟', 'هل لديك حساب بالفعل؟')}{' '}
            <Link
              to="/login"
              className="text-accent font-medium hover:underline underline-offset-2 transition"
            >
              {l('Sign in', 'وارد شوید', 'سجّل الدخول')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
