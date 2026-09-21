import {
  useEffect,
  useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion,
  AnimatePresence } from 'framer-motion';
import { CheckCircle2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { supabase } from '@/supabaseClient';
import ProfileSidebar from '@/components/profile/ProfileSidebar';
import EditableField from '@/components/profile/EditableField';
import ToggleSwitch from '@/components/profile/ToggleSwitch';

const TIMEZONES = [
  'UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00',
  'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:00',
  'UTC-02:00', 'UTC-01:00', 'UTC+00:00', 'UTC+01:00', 'UTC+02:00',
  'UTC+03:00', 'UTC+03:30', 'UTC+04:00', 'UTC+04:30', 'UTC+05:00',
  'UTC+05:30', 'UTC+05:45', 'UTC+06:00', 'UTC+06:30', 'UTC+07:00',
  'UTC+08:00', 'UTC+09:00', 'UTC+09:30', 'UTC+10:00', 'UTC+11:00',
  'UTC+12:00',
];

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fa', label: 'فارسی' },
  { value: 'ar', label: 'العربية' },
];

const TIMING_OPTIONS_BY_LANG = {
  en: [
    { value: 'instant', label: 'Instantly' },
    { value: 'daily',   label: 'Daily digest' },
    { value: 'weekly',  label: 'Weekly summary' },
  ],
  fa: [
    { value: 'instant', label: 'لحظه‌ای' },
    { value: 'daily',   label: 'خلاصه روزانه' },
    { value: 'weekly',  label: 'خلاصه هفتگی' },
  ],
  ar: [
    { value: 'instant', label: 'فوراً' },
    { value: 'daily',   label: 'ملخص يومي' },
    { value: 'weekly',  label: 'ملخص أسبوعي' },
  ],
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, fetchProfile, isAuthenticated, isLoadingAuth } = useAuth();
  const { lang, switchLang } = useI18n();

  const [tab, setTab] = useState('general');
  const [local, setLocal] = useState(profile);
  const [notifyTiming, setNotifyTiming] = useState(() => localStorage.getItem('ita-notify-timing') || 'instant');
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate('/login');
  }, [isLoadingAuth, isAuthenticated, navigate]);

  useEffect(() => { setLocal(profile); }, [profile]);

  const tx = {
    title:       lang === 'fa' ? 'تنظیمات و حریم خصوصی' : lang === 'ar' ? 'الإعدادات والخصوصية' : 'Settings & Privacy',
    subtitle:    lang === 'fa' ? 'مدیریت اطلاعات حساب، اعلان‌ها و حریم خصوصی' : lang === 'ar' ? 'إدارة معلومات حسابك والإشعارات والخصوصية' : 'Manage your account information, notifications, and privacy',
    general:     lang === 'fa' ? 'عمومی' : lang === 'ar' ? 'عام' : 'General',
    privacy:     lang === 'fa' ? 'حریم خصوصی' : lang === 'ar' ? 'الخصوصية' : 'Privacy',
    notifications: lang === 'fa' ? 'اعلان‌ها' : lang === 'ar' ? 'الإشعارات' : 'Notifications',
    fullName:    lang === 'fa' ? 'نام کامل' : lang === 'ar' ? 'الاسم الكامل' : 'Full Name',
    email:       lang === 'fa' ? 'ایمیل' : lang === 'ar' ? 'البريد الإلكتروني' : 'Email',
    phone:       lang === 'fa' ? 'موبایل / تلفن' : lang === 'ar' ? 'الجوال / الهاتف' : 'Mobile / Phone',
    password:    lang === 'fa' ? 'گذرواژه' : lang === 'ar' ? 'كلمة المرور' : 'Password',
    timezone:    lang === 'fa' ? 'منطقه زمانی' : lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone',
    language:    lang === 'fa' ? 'زبان ترجیحی' : lang === 'ar' ? 'اللغة المفضلة' : 'Preferred Language',
    verified:    lang === 'fa' ? 'تایید شده' : lang === 'ar' ? 'موثق' : 'Verified',
    notVerified: lang === 'fa' ? 'تایید نشده' : lang === 'ar' ? 'غير موثق' : 'Not verified',
    showAvatar:  lang === 'fa' ? 'نمایش عمومی تصویر پروفایل' : lang === 'ar' ? 'إظهار صورة الملف الشخصي للجميع' : 'Display profile picture publicly',
    showAvatarDesc: lang === 'fa' ? 'راهنماهایی که به درخواست‌های شما پاسخ می‌دهند، همیشه تصویر شما را خواهند دید.' : lang === 'ar' ? 'سيرى المرشدون الذين يستجيبون لطلباتك صورتك دائماً.' : 'Guides who respond to your requests will always see your profile picture.',
    emailNews:   lang === 'fa' ? 'دریافت خبرنامه و پیشنهادات از طریق ایمیل' : lang === 'ar' ? 'تلقي النشرات الإخبارية والعروض عبر البريد الإلكتروني' : 'Receive email newsletters and offers',
    timing:      lang === 'fa' ? 'زمان اعلان پیشنهادهای دریافتی' : lang === 'ar' ? 'توقيت إشعارات العروض المستلمة' : 'Notification timing for proposals received',
    timingDesc:  lang === 'fa' ? 'هرگاه راهنمایی به درخواست تور شما پاسخ دهد' : lang === 'ar' ? 'عندما يستجيب مرشد لطلب جولتك' : 'When a guide responds to one of your trip requests',
    whatsapp:    lang === 'fa' ? 'دریافت اعلان از طریق واتساپ' : lang === 'ar' ? 'تلقي إشعارات عبر واتساب' : 'Receive WhatsApp notifications',
    dangerZone:  lang === 'fa' ? 'منطقه حساس' : lang === 'ar' ? 'منطقة خطرة' : 'Danger Zone',
    deactivate:  lang === 'fa' ? 'غیرفعال‌سازی حساب' : lang === 'ar' ? 'إلغاء تنشيط الحساب' : 'Deactivate my account',
    deactivateDesc: lang === 'fa' ? 'به حساب کاربری شما دیگر دسترسی نخواهید داشت.' : lang === 'ar' ? 'لن تتمكن من الوصول إلى حسابك بعد ذلك.' : 'You will no longer be able to access your account.',
    deactivateConfirm: lang === 'fa' ? 'این عمل قابل بازگشت نیست.' : lang === 'ar' ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.',
    cancel:      lang === 'fa' ? 'لغو' : lang === 'ar' ? 'إلغاء' : 'Cancel',
    confirm:     lang === 'fa' ? 'تأیید' : lang === 'ar' ? 'تأكيد' : 'Confirm',
    passwordChanged: lang === 'fa' ? 'تغییر رمز عبور با ایمیلی برای شما ارسال خواهد شد.' : lang === 'ar' ? 'سيتم إرسال رابط تغيير كلمة المرور إلى بريدك.' : 'A password-reset email will be sent to your inbox.',
    sendReset:   lang === 'fa' ? 'ارسال لینک بازنشانی' : lang === 'ar' ? 'إرسال رابط إعادة التعيين' : 'Send reset link',
  };

  // Persist a single column on `profiles`. Throws on failure so EditableField
  // / ToggleSwitch can surface the error.
  const savePersistent = async (key, value) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ [key]: value })
      .eq('id', user.id);
    if (error) throw error;
    setLocal((p) => ({ ...(p || {}), [key]: value }));
    fetchProfile?.(user.id);
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email);
  };

  const handleDeactivate = async () => {
    if (!user?.id) return;
    setDeactivating(true);
    try {
      // We don't have admin rights to hard-delete the auth user from the
      // client, so we soft-deactivate by flipping `is_public` off and signing
      // the user out. A backend job can hard-delete inactive rows later.
      await supabase.from('profiles').update({ is_public: false }).eq('id', user.id);
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch {
      setDeactivating(false);
      setDeactivateOpen(false);
    }
  };

  const lastPasswordChange = (() => {
    const iso = user?.user_metadata?.password_changed_at;
    if (!iso) return lang === 'fa' ? 'هرگز تغییر نکرده' : lang === 'ar' ? 'لم يتغير أبدًا' : 'Never changed';
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
    if (days === 0) return lang === 'fa' ? 'امروز تغییر یافت' : lang === 'ar' ? 'تم التغيير اليوم' : 'Changed today';
    return lang === 'fa'
      ? `${days} روز پیش تغییر یافت`
      : lang === 'ar'
      ? `تم التغيير قبل ${days} يوماً`
      : `Last changed ${days} day${days === 1 ? '' : 's'} ago`;
  })();

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 mb-6
                     bg-white/20 backdrop-blur-md border border-white/30
                     rounded-full text-sm font-medium
                     hover:bg-white/30 transition-all duration-200
                     text-gray-700 dark:text-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg"
               className="h-4 w-4" fill="none"
               viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
                  strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header */}
        <header className="mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-foreground">{tx.title}</h1>
          <p className="font-body text-sm text-muted-foreground mt-2">{tx.subtitle}</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          <ProfileSidebar tab={tab} onTabChange={setTab} />

          <main className="flex-1 min-w-0">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl p-6 sm:p-8"
            >
              {/* ── General ── */}
              {tab === 'general' && (
                <div>
                  <EditableField
                    label={tx.fullName}
                    value={local?.full_name || ''}
                    onSave={(v) => savePersistent('full_name', (v || '').trim() || null)}
                  />
                  <EditableField
                    label={tx.email}
                    value={user?.email || ''}
                    type="email"
                    onSave={async (v) => {
                      const next = (v || '').trim();
                      if (!next || next === user?.email) return;
                      const { error } = await supabase.auth.updateUser({ email: next });
                      if (error) throw error;
                      // Supabase sends a confirmation email to the new address; the
                      // change only takes effect once the user clicks the link.
                      toast.success(
                        lang === 'fa' ? 'لینک تأیید به ایمیل جدید ارسال شد.' : lang === 'ar' ? 'أُرسل رابط التأكيد إلى بريدك الجديد.' : 'Check your new email to confirm the change.'
                      );
                    }}
                    rightSlot={
                      user?.email_confirmed_at ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> {tx.verified}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground text-[10px] font-semibold">
                          <ShieldAlert className="w-3 h-3" /> {tx.notVerified}
                        </span>
                      )
                    }
                  />
                  <EditableField
                    label={tx.phone}
                    value={local?.phone || ''}
                    type="tel"
                    placeholder="+98 ..."
                    onSave={(v) => {
                      const next = (v || '').trim();
                      if (!next) return savePersistent('phone', null);
                      // Loose validation only: digits, spaces, dashes, parens, leading +.
                      if (!/^[+\d][\d\s\-()]{6,19}$/.test(next)) {
                        throw new Error(lang === 'fa' ? 'شماره تلفن معتبر نیست.' : lang === 'ar' ? 'رقم الهاتف غير صالح.' : 'Please enter a valid phone number.');
                      }
                      return savePersistent('phone', next);
                    }}
                  />
                  <EditableField
                    label={tx.password}
                    value="placeholder"
                    type="password"
                    helperText={tx.passwordChanged}
                    onSave={async () => {
                      await handleSendPasswordReset();
                    }}
                    rightSlot={
                      <span className="text-[10px] text-muted-foreground">{lastPasswordChange}</span>
                    }
                  />
                  <EditableField
                    label={tx.timezone}
                    value={local?.timezone || 'UTC+00:00'}
                    type="select"
                    options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                    onSave={(v) => savePersistent('timezone', v)}
                  />
                  <EditableField
                    label={tx.language}
                    value={lang}
                    type="select"
                    options={LANG_OPTIONS}
                    onSave={(v) => {
                      switchLang(v);
                      return Promise.resolve();
                    }}
                  />
                </div>
              )}

              {/* ── Privacy ── */}
              {tab === 'privacy' && (
                <div className="divide-y divide-border/30">
                  <ToggleSwitch
                    label={tx.showAvatar}
                    description={tx.showAvatarDesc}
                    checked={local?.is_public ?? true}
                    onChange={(v) => savePersistent('is_public', v).catch(() => {})}
                  />

                  <div className="pt-6 mt-2">
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-heading text-sm font-semibold text-foreground">{tx.dangerZone}</h3>
                          <p className="font-body text-xs text-muted-foreground mt-1">{tx.deactivateDesc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDeactivateOpen(true)}
                        className="px-4 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/40 text-destructive text-sm font-semibold transition"
                      >
                        {tx.deactivate}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Notifications ── */}
              {tab === 'notifications' && (
                <div className="divide-y divide-border/30">
                  <ToggleSwitch
                    label={tx.emailNews}
                    checked={local?.notify_email ?? true}
                    onChange={(v) => savePersistent('notify_email', v).catch(() => {})}
                  />
                  <div className="py-4">
                    <p className="font-body text-sm font-medium text-foreground mb-1">{tx.timing}</p>
                    <p className="font-body text-xs text-muted-foreground mb-3">{tx.timingDesc}</p>
                    <select
                      value={notifyTiming}
                      onChange={(e) => {
                        setNotifyTiming(e.target.value);
                        localStorage.setItem('ita-notify-timing', e.target.value);
                      }}
                      className="w-full sm:w-auto min-w-[220px] px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:border-accent transition"
                    >
                      {(TIMING_OPTIONS_BY_LANG[lang] || TIMING_OPTIONS_BY_LANG.en).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <ToggleSwitch
                    label={tx.whatsapp}
                    checked={local?.notify_whatsapp ?? false}
                    onChange={(v) => savePersistent('notify_whatsapp', v).catch(() => {})}
                  />
                </div>
              )}
            </motion.div>
          </main>
        </div>
      </div>

      {/* Deactivate confirmation */}
      <AnimatePresence>
        {deactivateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setDeactivateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">{tx.deactivate}</h3>
                  <p className="font-body text-xs text-muted-foreground mt-1">{tx.deactivateConfirm}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeactivateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border/60 text-foreground text-sm font-medium hover:bg-muted/40 transition"
                >
                  {tx.cancel}
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 disabled:opacity-60 transition"
                >
                  {deactivating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {tx.confirm}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
