// @ts-nocheck
import {
  useState,
  useRef,
  useEffect } from 'react';
import { Link,
  useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { motion,
  AnimatePresence } from 'framer-motion';
import { InputOTP,
  InputOTPGroup,
  InputOTPSlot } from '@/components/ui/input-otp';
import {
  User,
  Mail,
  Lock,
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Star,
  Bookmark,
  Compass,
  CircleCheck,
  CircleX,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { iranianDestinations as IRAN_CITIES, popularIranianDestinations as POPULAR_CITIES } from '@/data/iranianCities';

const BENEFITS = [
  { icon: Compass, titleKey: 'login_benefit1_title', descKey: 'login_benefit1_desc' },
  { icon: Bookmark, titleKey: 'login_benefit2_title', descKey: 'login_benefit2_desc' },
  { icon: Star,    titleKey: 'login_benefit3_title', descKey: 'login_benefit3_desc' },
];

export default function Signup() {
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const isRtl = dir === 'rtl';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  // ── Form state ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'tourist',
    gender: '',
    cities: [],
    bio: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── OTP flow state ────────────────────────────────────────────────────────
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [otpValue, setOtpValue] = useState('');
  const [otpStatus, setOtpStatus] = useState('idle'); // 'idle' | 'error' | 'success'
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [customCity, setCustomCity] = useState('');

  const cityLabel = (c) => (lang === 'fa' ? c.fa : lang === 'ar' ? c.ar : c.en);

  const toggleCity = (v) =>
    setFormData(prev => ({
      ...prev,
      cities: prev.cities.includes(v) ? prev.cities.filter(x => x !== v) : [...prev.cities, v],
    }));

  const addCustomCity = () => {
    const v = customCity.trim();
    if (v && !formData.cities.includes(v)) {
      setFormData(prev => ({ ...prev, cities: [...prev.cities, v] }));
    }
    setCustomCity('');
  };

  // ── City search-with-suggestions ──────────────────────────────────────────
  const [showSuggestions, setShowSuggestions] = useState(false);
  const citySearchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (citySearchRef.current && !citySearchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const citySuggestions = customCity.trim()
    ? IRAN_CITIES.filter(c =>
        !formData.cities.includes(c.en) &&
        cityLabel(c).toLowerCase().startsWith(customCity.trim().toLowerCase())
      ).slice(0, 6)
    : [];

  const selectSuggestion = (c) => {
    toggleCity(c.en);
    setCustomCity('');
    setShowSuggestions(false);
  };

  const handleCityInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exact = IRAN_CITIES.find(
        c => cityLabel(c).toLowerCase() === customCity.trim().toLowerCase()
      );
      if (exact) {
        toggleCity(exact.en);
        setCustomCity('');
        setShowSuggestions(false);
      } else {
        addCustomCity();
      }
    }
  };

  // ── Submit: sign up and move to OTP screen ────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('signup_err_pw_match'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('signup_err_pw_len'));
      return;
    }

    if ((formData.role === 'guide' || formData.role === 'agency') && formData.cities.length === 0) {
      setError(lang === 'fa' ? 'لطفاً حداقل یک شهر انتخاب کنید' : lang === 'ar' ? 'يرجى اختيار مدينة واحدة على الأقل' : 'Please select at least one city');
      return;
    }

    if (!formData.gender) {
      setError(t('signup_err_gender'));
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name },
          emailRedirectTo: undefined,
        },
      });

      if (authError) throw authError;

      setStep('verify');
    } catch (err) {
      setError(err.message || t('signup_err_failed'));
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP and create profile ─────────────────────────────────────────
  const handleVerifyOtp = async (code = otpValue) => {
    if (code.length !== 6 || otpStatus === 'success') return;
    setLoading(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: code,
        type: 'signup',
      });
      if (verifyError) throw verifyError;

      if (data?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          city: formData.cities[0] || null,
          primary_city: formData.cities[0] || null,
          other_cities: formData.cities.length ? formData.cities : null,
          bio: formData.bio || null,
        });
      if (profileError) throw profileError;
      }

      setOtpStatus('success');
      window.setTimeout(() => {
        navigate('/');
        window.location.reload();
      }, 900);
    } catch (err) {
      setOtpStatus('error');
      setError(
        lang === 'fa'
          ? 'کد وارد شده اشتباه یا منقضی شده است'
          : 'Invalid or expired code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResendLoading(true);
    setError('');
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
      });
      setOtpValue('');
      setOtpStatus('idle');
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(lang === 'fa' ? 'خطا در ارسال مجدد کد' : 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  // ── Shared input class (mirrors Login exactly) ────────────────────────────
  const inputCls = (withIcon, extraEnd = false) =>
    `w-full ${
      withIcon
        ? isRtl
          ? `pe-10 ${extraEnd ? 'ps-10' : 'ps-3.5'}`
          : `ps-10 ${extraEnd ? 'pe-10' : 'pe-3.5'}`
        : 'px-3.5'
    } py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition`;

  const iconCls = isRtl ? 'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none end-3.5'
                        : 'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none start-3.5';

  const labelCls = 'block font-body text-xs text-muted-foreground mb-1.5';

  return (
    <div dir={dir} className="min-h-screen flex">

      {/* ── Left Panel: Dark branding (matches Login) ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between relative overflow-hidden bg-[hsl(222,55%,8%)]">
        {/* Ambient glows */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 70% 25%, hsl(38,62%,52%) 0%, transparent 50%),
                              radial-gradient(circle at 25% 75%, hsl(178,85%,32%) 0%, transparent 45%)`,
          }}
        />
        {/* Diamond lattice */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, hsl(38,62%,60%) 0px, transparent 1px, transparent 40px, hsl(38,62%,60%) 41px),
                              repeating-linear-gradient(-45deg, hsl(38,62%,60%) 0px, transparent 1px, transparent 40px, hsl(38,62%,60%) 41px)`,
          }}
        />

        <div className="relative z-10 flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[hsl(38,62%,52%)] flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-white text-xl font-bold tracking-wide">
              Iran Trip Advisor
            </span>
          </div>

          {/* Headline */}
          <div className="mb-12">
            <h2 className="font-heading text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              {t('login_welcome_1')}<br />
              <span className="text-[hsl(38,62%,60%)]">{t('signup_heading')}</span>
            </h2>
            <p className="font-body text-[hsl(222,20%,65%)] text-base leading-relaxed max-w-xs">
              {t('signup_subtitle')}
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-6 flex-1">
            {BENEFITS.map(({ icon: Icon, titleKey, descKey }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: isRtl ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-4"
              >
                <div className="mt-0.5 w-10 h-10 rounded-xl bg-[hsl(38,62%,52%)]/20 border border-[hsl(38,62%,52%)]/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[hsl(38,62%,65%)]" />
                </div>
                <div>
                  <p className="font-body text-white font-semibold text-sm mb-0.5">{t(titleKey)}</p>
                  <p className="font-body text-[hsl(222,15%,58%)] text-xs leading-relaxed">{t(descKey)}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom quote */}
          <div className="mt-auto pt-10 border-t border-white/10">
            <p className="font-body text-[hsl(222,15%,50%)] text-xs italic leading-relaxed">
              {t('login_quote')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Form / OTP ── */}
      <div className="flex-1 flex items-start justify-center px-6 py-12 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {step === 'verify' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={otpStatus === 'error' ? { opacity: 1, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, scale: 1 }}
              transition={otpStatus === 'error' ? { duration: 0.4 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="bg-card rounded-3xl border border-border/50 p-8 shadow-warm text-center"
            >
              {/* Icon */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={otpStatus}
                  initial={{ opacity: 0, scale: 0.75, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.75, rotate: 10 }}
                  transition={{ type: 'spring', stiffness: 330, damping: 22 }}
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${
                    otpStatus === 'success' ? 'bg-emerald-500/10' : otpStatus === 'error' ? 'bg-red-500/10' : 'bg-accent/10'
                  }`}
                >
                  {otpStatus === 'success' ? <CircleCheck className="w-8 h-8 text-emerald-500" />
                    : otpStatus === 'error' ? <CircleX className="w-8 h-8 text-red-500" />
                      : <Mail className="w-8 h-8 text-accent" />}
                </motion.div>
              </AnimatePresence>

              <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
                {lang === 'fa' ? 'کد تأیید ایمیل' : 'Verify Your Email'}
              </h2>
              <p className="font-body text-muted-foreground text-sm mb-2">
                {lang === 'fa'
                  ? 'یک کد ۶ رقمی به ایمیل زیر ارسال شد:'
                  : 'A 6-digit code was sent to:'}
              </p>
              <p className="font-body text-accent font-semibold mb-6 text-sm">{formData.email}</p>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    className="mb-4 overflow-hidden rounded-xl bg-red-500/10 text-red-600"
                  >
                    <div className="p-3 font-body text-sm">{error}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* OTP Input — supports typing, pasting, and keyboard navigation. */}
              <div className="mb-6 flex justify-center" dir="ltr">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={(value) => {
                    setOtpValue(value);
                    setError('');
                    if (otpStatus !== 'idle') setOtpStatus('idle');
                  }}
                  onComplete={handleVerifyOtp}
                  disabled={loading || otpStatus === 'success'}
                  aria-label={lang === 'fa' ? 'کد تأیید شش رقمی' : 'Six digit verification code'}
                  containerClassName="gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <motion.div
                        key={index}
                        animate={otpStatus === 'success' ? { y: [0, -8, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
                        transition={{ duration: 0.38, delay: otpStatus === 'success' ? index * 0.055 : 0 }}
                      >
                        <InputOTPSlot
                          index={index}
                          className={`h-13 w-11 rounded-xl border-2 text-xl font-bold shadow-none transition-all first:rounded-xl first:border-2 last:rounded-xl ${
                            otpStatus === 'error'
                              ? 'border-red-500/70 bg-red-500/5 text-red-600'
                              : otpStatus === 'success'
                                ? 'border-emerald-500/70 bg-emerald-500/5 text-emerald-600'
                                : 'border-border bg-background text-foreground'
                          }`}
                          style={{ height: '52px' }}
                        />
                      </motion.div>
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpStatus === 'success' || otpValue.length !== 6}
                className="w-full py-3 rounded-xl bg-accent text-white font-heading font-semibold text-base hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
              >
                {otpStatus === 'success' ? (
                  <><CircleCheck className="w-4 h-4" />{lang === 'fa' ? 'تأیید شد' : 'Verified'}</>
                ) : loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  lang === 'fa' ? 'تأیید و ورود' : 'Verify & Sign In'
                )}
              </button>

              {/* Resend */}
              <p className="font-body text-sm text-muted-foreground">
                {lang === 'fa' ? 'کد دریافت نکردید؟' : "Didn't receive the code?"}{' '}
                {resendCooldown > 0 ? (
                  <span className="text-muted-foreground">
                    {lang === 'fa' ? `ارسال مجدد در ${resendCooldown} ثانیه` : `Resend in ${resendCooldown}s`}
                  </span>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-accent hover:underline font-semibold disabled:opacity-50"
                  >
                    {resendLoading
                      ? (lang === 'fa' ? 'در حال ارسال...' : 'Sending...')
                      : (lang === 'fa' ? 'ارسال مجدد' : 'Resend')}
                  </button>
                )}
              </p>

              {/* Back button */}
              <button
                onClick={() => { setStep('form'); setOtpValue(''); setError(''); setOtpStatus('idle'); }}
                className="mt-4 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {lang === 'fa' ? '← بازگشت به فرم' : '← Back to form'}
              </button>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="font-heading text-3xl font-bold text-foreground mb-1">
                  {t('signup_heading')}
                </h1>
                <p className="font-body text-muted-foreground text-sm">
                  {t('signup_subtitle')}
                </p>
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
              <form onSubmit={handleRegister} className="space-y-4">

                {/* Full Name */}
                <div>
                  <label className={labelCls}>{t('field_full_name')} *</label>
                  <div className="relative">
                    <User className={iconCls} />
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={e => handleChange('full_name', e.target.value)}
                      className={inputCls(true)}
                      placeholder={t('signup_full_name_ph')}
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className={labelCls}>{t('field_email')} *</label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => handleChange('email', e.target.value)}
                      className={inputCls(true)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className={labelCls}>{t('field_password')} *</label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={e => handleChange('password', e.target.value)}
                      className={inputCls(true, true)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition ${isRtl ? 'start-3.5' : 'end-3.5'}`}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className={labelCls}>{t('field_confirm_password')} *</label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={e => handleChange('confirmPassword', e.target.value)}
                      className={inputCls(true)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <label className={labelCls}>{t('signup_account_type')} *</label>
                  <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden">
                    {[
                      { value: 'tourist', icon: User },
                      { value: 'guide',   icon: MapPin },
                      { value: 'agency',  icon: Building2 },
                    ].map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleChange('role', value)}
                        className={`flex flex-col items-center gap-1 py-3 px-2 font-body text-xs font-medium transition-all duration-150 ${
                          formData.role === value
                            ? 'bg-accent text-white'
                            : 'bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{t('role_' + value)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className={labelCls}>{t('signup_gender')} *</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { value: 'male',   img: '/avatars/default-male.png' },
                      { value: 'female', img: '/avatars/default-female.png' },
                    ].map(({ value, img }) => {
                      const selected = formData.gender === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleChange('gender', value)}
                          aria-pressed={selected}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-150 ${
                            selected
                              ? 'border-accent bg-accent/5 text-accent'
                              : 'border-border bg-background text-muted-foreground hover:border-accent/40 hover:text-foreground'
                          }`}
                        >
                          <img decoding="async" loading="lazy"
                            src={img}
                            alt={t('gender_' + value)}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <span className="font-body text-sm font-medium">{t('gender_' + value)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Guide / Agency extra fields */}
                <AnimatePresence>
                  {(formData.role === 'guide' || formData.role === 'agency') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      <div>
                        <label className="block font-body text-sm text-muted-foreground mb-2">
                          {lang === 'fa' ? 'شهرهای فعالیت' : lang === 'ar' ? 'مدن النشاط' : 'Cities of Activity'} *
                        </label>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {POPULAR_CITIES.map(c => {
                            const active = formData.cities.includes(c.en);
                            return (
                              <button
                                key={c.en}
                                type="button"
                                onClick={() => toggleCity(c.en)}
                                className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all duration-200 ${
                                  active
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-accent/50'
                                }`}
                              >
                                {active ? '✓ ' : ''}{cityLabel(c)}
                              </button>
                            );
                          })}

                          {formData.cities
                            .filter(v => !POPULAR_CITIES.some(c => c.en === v))
                            .map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => toggleCity(v)}
                                className="px-3 py-1.5 rounded-full text-xs font-body font-medium border bg-accent text-white border-accent"
                              >
                                {v} ✕
                              </button>
                            ))}
                        </div>

                        <div className="flex gap-2" ref={citySearchRef}>
                          <div className="relative flex-1">
                            <MapPin className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${dir === 'rtl' ? 'end-4' : 'start-4'}`} />
                            <input
                              type="text"
                              value={customCity}
                              onChange={e => { setCustomCity(e.target.value); setShowSuggestions(true); }}
                              onKeyDown={handleCityInputKeyDown}
                              onFocus={() => setShowSuggestions(true)}
                              className={`w-full ${dir === 'rtl' ? 'pe-11 ps-4' : 'ps-11 pe-4'} py-3 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50`}
                              placeholder={lang === 'fa' ? 'شهر دیگری اضافه کنید...' : lang === 'ar' ? 'أضف مدينة أخرى...' : 'Add another city...'}
                              autoComplete="off"
                            />

                            {/* Dropdown suggestions */}
                            <AnimatePresence>
                              {showSuggestions && customCity.trim() && citySuggestions.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, translateY: -8 }}
                                  animate={{ opacity: 1, translateY: 0 }}
                                  exit={{ opacity: 0, translateY: -8 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute z-10 mt-2 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden"
                                >
                                  {citySuggestions.map(c => (
                                    <button
                                      key={c.en}
                                      type="button"
                                      onClick={() => selectSuggestion(c)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent/10 transition-colors border-b border-border/60 last:border-b-0"
                                    >
                                      <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                                      <span className="text-foreground font-medium">{cityLabel(c)}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <button
                            type="button"
                            onClick={addCustomCity}
                            className="px-4 py-3 rounded-xl border border-border text-muted-foreground font-body text-sm hover:text-foreground hover:border-accent/50 transition whitespace-nowrap"
                          >
                            {lang === 'fa' ? 'افزودن' : lang === 'ar' ? 'إضافة' : 'Add'}
                          </button>
                        </div>

                        {formData.cities.length > 0 && (
                          <p className="mt-2 font-body text-xs text-muted-foreground">
                            {lang === 'fa'
                              ? `${formData.cities.length} شهر انتخاب شد`
                              : lang === 'ar'
                              ? `تم اختيار ${formData.cities.length} مدينة`
                              : `${formData.cities.length} ${formData.cities.length === 1 ? 'city' : 'cities'} selected`}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelCls}>{t('signup_bio_label')}</label>
                        <textarea
                          value={formData.bio}
                          onChange={e => handleChange('bio', e.target.value)}
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition resize-none"
                          placeholder={t('signup_bio_ph')}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl bg-accent text-white font-body font-semibold text-sm hover:bg-accent/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Arrow className="w-4 h-4" />}
                  {loading ? t('signup_signing_up') : t('signup_submit')}
                </button>
              </form>

              {/* Link to login */}
              <p className="mt-6 text-center font-body text-sm text-muted-foreground">
                {lang === 'fa' ? 'حساب دارید؟' : lang === 'ar' ? 'لديك حساب؟' : 'Already have an account?'}{' '}
                <Link
                  to="/login"
                  className="text-accent font-medium hover:underline underline-offset-2 transition"
                >
                  {t('auth_signin')}
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
