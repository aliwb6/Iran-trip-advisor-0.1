import {
  useState } from 'react';
import { Link,
  useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { motion,
  AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Star,
  Bookmark,
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';

const BENEFITS = [
  { icon: Compass, titleKey: 'login_benefit1_title', descKey: 'login_benefit1_desc' },
  { icon: Bookmark, titleKey: 'login_benefit2_title', descKey: 'login_benefit2_desc' },
  { icon: Star, titleKey: 'login_benefit3_title', descKey: 'login_benefit3_desc' },
];

export default function Login() {
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const isRtl = dir === 'rtl';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      navigate('/');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError(t('auth_err_invalid'));
      } else if (msg.includes('Email not confirmed')) {
        setError(t('auth_err_unconfirmed'));
      } else {
        setError(t('auth_err_generic', { msg }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setResetSent(true);
    } catch (err) {
      setResetError(t('auth_err_generic', { msg: err.message }));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen flex">

      {/* ── Left Panel: Dark Benefits ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between relative overflow-hidden bg-[hsl(222,55%,8%)]">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 70% 25%, hsl(38,62%,52%) 0%, transparent 50%),
                              radial-gradient(circle at 25% 75%, hsl(178,85%,32%) 0%, transparent 45%)`,
          }}
        />
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
              {t('login_welcome_1')}<br /><span className="text-[hsl(38,62%,60%)]">{t('login_welcome_2')}</span>
            </h2>
            <p className="font-body text-[hsl(222,20%,65%)] text-base leading-relaxed max-w-xs">
              {t('login_welcome_sub')}
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-6 flex-1">
            {BENEFITS.map(({ icon: Icon, titleKey, descKey }, i) => {
              return (
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
              );
            })}
          </div>

          {/* Bottom quote */}
          <div className="mt-auto pt-10 border-t border-white/10">
            <p className="font-body text-[hsl(222,15%,50%)] text-xs italic leading-relaxed">
              {t('login_quote')}
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
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-1">
              {t('login_heading')}
            </h1>
            <p className="font-body text-muted-foreground text-sm">
              {t('login_subtitle')}
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
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block font-body text-xs text-muted-foreground mb-1.5">
                {t('field_email')} *
              </label>
              <div className="relative">
                <Mail className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'end-3.5' : 'start-3.5'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full ${isRtl ? 'pe-10 ps-3.5' : 'ps-10 pe-3.5'} py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-body text-xs text-muted-foreground">
                  {t('field_password')} *
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(v => !v); setResetSent(false); setResetError(''); }}
                  className="font-body text-xs text-accent hover:underline underline-offset-2 transition"
                >
                  {t('login_forgot')}
                </button>
              </div>
              <div className="relative">
                <Lock className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'end-3.5' : 'start-3.5'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full ${isRtl ? 'pe-10 ps-10' : 'ps-10 pe-10'} py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition`}
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            {/* Forgot password inline panel */}
            <AnimatePresence>
              {forgotOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
                    {resetSent ? (
                      <div className="flex items-center gap-2 text-green-600 font-body text-sm">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {t('login_reset_sent')}
                        </span>
                      </div>
                    ) : (
                      <form onSubmit={handleResetPassword} className="space-y-2.5">
                        <p className="font-body text-xs text-muted-foreground">
                          {t('login_reset_prompt')}
                        </p>
                        {resetError && (
                          <p className="font-body text-xs text-red-500">{resetError}</p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="email"
                            required
                            value={resetEmail}
                            onChange={e => setResetEmail(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                            placeholder="you@example.com"
                          />
                          <button
                            type="submit"
                            disabled={resetLoading}
                            className="px-3 py-2 rounded-lg bg-accent text-white font-body text-xs font-medium hover:bg-accent/90 transition disabled:opacity-60"
                          >
                            {resetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('common_send')}
                          </button>
                        </div>
                      </form>
                    )}
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
              {loading ? t('login_signing_in') : t('login_heading')}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center font-body text-sm text-muted-foreground">
            {t('login_no_account')}{' '}
            <Link
              to="/register"
              className="text-accent font-medium hover:underline underline-offset-2 transition"
            >
              {t('login_join_free')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}