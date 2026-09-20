import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Phone, Mail, Globe, MapPin, Plane, Star,
  ClipboardList, Settings,
  Sparkles, MessageCircle, Map, CheckCircle2, Compass,
  ArrowRight, ArrowLeft, Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { supabase } from '@/supabaseClient';
import UserAvatar from '@/components/profile/UserAvatar';
import VerificationBadge from '@/components/profile/VerificationBadge';
import EditableField from '@/components/profile/EditableField';
import { parseLanguages } from '@/data/languages';

// Cinematic Iranian backdrop used behind the profile hero. Stored on the
// project's existing base44 CDN, blurred + tinted at render time so it never
// fights the content.
const HERO_BG = 'https://media.base44.com/images/public/69fddcfab0730c36bda3631e/cce446b52_generated_d017c773.png';

function StatTile({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border/40">
      <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-heading text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="font-body text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, fetchProfile, isLoadingAuth, isAuthenticated } = useAuth();
  const { lang, dir, t } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const [localProfile, setLocalProfile] = useState(profile);
  const [reviewCount, setReviewCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const profileRole = localProfile?.role || profile?.role || user?.user_metadata?.role;
  const isTourist = profileRole === 'tourist' || profileRole === 'traveler';

  // Bounce signed-out visitors to login.
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate('/login');
  }, [isLoadingAuth, isAuthenticated, navigate]);

  // Keep local in sync with AuthContext.
  useEffect(() => { setLocalProfile(profile); }, [profile]);

  // Total reviews this user has written (best-effort).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_id', user.id);
      if (!cancelled && typeof count === 'number') setReviewCount(count);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Trip-request count (best-effort) — mirrors the lookup order in
  // RequestsPage. If neither table exists yet we silently keep the count at 0
  // so the empty-state copy renders.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        let res = await supabase
          .from('trip_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (res.error) {
          res = await supabase
            .from('tour_requests')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
        }
        if (!cancelled && typeof res.count === 'number') setRequestCount(res.count);
      } catch {
        // table missing — leave count at 0
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const memberSince = (() => {
    const iso = profile?.created_at || user?.created_at;
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' });
  })();

  const saveProfileValue = async (key, storedValue) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ [key]: storedValue })
      .eq('id', user.id);
    if (error) throw error;
    setLocalProfile((p) => ({ ...(p || {}), [key]: storedValue }));
    fetchProfile?.(user.id);
  };

  const saveField = (key) => async (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    await saveProfileValue(key, trimmed || null);
  };

  const saveAge = async (value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      await saveProfileValue('age', null);
      return;
    }
    const age = Number(trimmed);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      throw new Error(lang === 'fa' ? 'سن باید عددی بین ۱ تا ۱۲۰ باشد.' : lang === 'ar' ? 'يجب أن يكون العمر رقماً بين 1 و120.' : 'Age must be a whole number between 1 and 120.');
    }
    await saveProfileValue('age', age);
  };

  const saveLanguages = async (value) => {
    const languages = parseLanguages(value);
    await saveProfileValue('languages', languages.length ? languages.join(', ') : null);
  };

  const tx = {
    memberSince:    lang === 'fa' ? 'عضو از' : lang === 'ar' ? 'عضو منذ' : 'Member since',
    aboutMe:        lang === 'fa' ? 'درباره من' : lang === 'ar' ? 'نبذة عني' : 'About Me',
    aboutPh:        lang === 'fa' ? 'داستان سفر خود را بنویس...' : lang === 'ar' ? 'شارك قصة سفرك...' : 'Share your story — what draws you to travel?',
    city:           lang === 'fa' ? 'شهر' : lang === 'ar' ? 'المدينة' : 'City',
    cityPh:         lang === 'fa' ? 'مثلاً: لندن، بریتانیا' : lang === 'ar' ? 'مثل: لندن، المملكة المتحدة' : 'e.g. London, UK',
    homeCity:       lang === 'fa' ? 'شهر اصلی' : lang === 'ar' ? 'المدينة الأصلية' : 'Home city',
    homeCityPh:     lang === 'fa' ? 'مثلاً: پاریس' : lang === 'ar' ? 'مثال: باريس' : 'e.g. Paris',
    nationality:    lang === 'fa' ? 'ملیت / اصالت' : lang === 'ar' ? 'الجنسية / الأصل' : 'Nationality / origin',
    nationalityPh:  lang === 'fa' ? 'مثلاً: فرانسوی' : lang === 'ar' ? 'مثال: فرنسي' : 'e.g. French',
    age:            lang === 'fa' ? 'سن' : lang === 'ar' ? 'العمر' : 'Age',
    agePh:          lang === 'fa' ? 'مثلاً: ۳۲' : lang === 'ar' ? 'مثال: 32' : 'e.g. 32',
    languages:      lang === 'fa' ? 'زبان‌هایی که صحبت می‌کنم' : lang === 'ar' ? 'اللغات التي أتحدث بها' : 'Languages I speak',
    languagesPh:    lang === 'fa' ? 'مثلاً: انگلیسی، فرانسوی' : lang === 'ar' ? 'مثال: الإنجليزية، الفرنسية' : 'e.g. English, French',
    verification:   lang === 'fa' ? 'وضعیت تأیید' : lang === 'ar' ? 'حالة التحقق' : 'Verification',
    phone:          lang === 'fa' ? 'موبایل' : lang === 'ar' ? 'الهاتف' : 'Phone',
    email:          lang === 'fa' ? 'ایمیل' : lang === 'ar' ? 'البريد' : 'Email',
    social:         lang === 'fa' ? 'شبکه‌های اجتماعی' : lang === 'ar' ? 'وسائل التواصل' : 'Social',
    totalTrips:     lang === 'fa' ? 'سفرها' : lang === 'ar' ? 'الرحلات' : 'Total Trips',
    countries:      lang === 'fa' ? 'کشورها' : lang === 'ar' ? 'الدول' : 'Countries Visited',
    reviews:        lang === 'fa' ? 'نظرات' : lang === 'ar' ? 'المراجعات' : 'Reviews Given',
    editProfile:    lang === 'fa' ? 'ویرایش پروفایل' : lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile',
    myRequests:    lang === 'fa' ? 'درخواست‌های من' : lang === 'ar' ? 'طلباتي' : 'My Requests',
    quickActions:  lang === 'fa' ? 'دسترسی سریع' : lang === 'ar' ? 'إجراءات سريعة' : 'Quick access',
    quickActionsDesc: lang === 'fa' ? 'سفرها و اطلاعات پروفایل‌تان را مدیریت کنید.'
      : lang === 'ar' ? 'أدر رحلاتك ومعلومات ملفك الشخصي.'
      : 'Manage your journeys and profile details.',
    slogan:        lang === 'fa'
      ? 'زیبایی پنهان ایران اصیل را در سفرهای فرهنگی پرمعنا کشف کن.'
      : lang === 'ar'
      ? 'اكتشف الجمال الخفي لإيران الأصيلة عبر رحلات ثقافية ذات معنى.'
      : 'Discover the hidden beauty of authentic Iran through meaningful cultural journeys.',

    // ── How to Plan Your Trip with AI ──
    planTitle: lang === 'fa' ? 'با هوش مصنوعی برای سفرت برنامه‌ریزی کن'
            : lang === 'ar' ? 'خطّط رحلتك الإيرانية مع الذكاء الاصطناعي'
            : 'Plan Your Iran Journey with AI',
    step1Title: lang === 'fa' ? 'گفتگو با هوش مصنوعی'
             : lang === 'ar' ? 'تحدّث مع الذكاء الاصطناعي'
             : 'Chat with AI',
    step1Desc: lang === 'fa' ? 'دستیار هوشمند را باز کن و سفر رؤیایی‌ات را توصیف کن — مقصد، تاریخ‌ها و علاقه‌هایی مثل معماری، طبیعت یا غذا.'
            : lang === 'ar' ? 'افتح مساعد الذكاء الاصطناعي وصِف رحلة أحلامك — الوجهة، التواريخ، واهتماماتك كالعمارة أو الطبيعة أو الطعام.'
            : 'Open the AI Assistant and describe your dream trip — destination, dates, interests like architecture, nature or food.',
    step2Title: lang === 'fa' ? 'برنامه‌ات را دریافت کن'
             : lang === 'ar' ? 'احصل على خطتك'
             : 'Get Your Plan',
    step2Desc: lang === 'fa' ? 'هوش مصنوعی فوراً یک برنامه شخصی با شهرها، تجربه‌ها و راهنماهای محلی متناسب با تو می‌سازد.'
            : lang === 'ar' ? 'يُنشئ الذكاء الاصطناعي فوراً خطة مخصّصة بمدن وتجارب ومرشدين محليين تناسبك.'
            : 'The AI instantly creates a personalized itinerary with recommended cities, experiences, and local guides just for you.',
    step3Title: lang === 'fa' ? 'سفرت را رزرو کن'
             : lang === 'ar' ? 'احجز رحلتك'
             : 'Book Your Journey',
    step3Desc: lang === 'fa' ? 'گزینه ایده‌آلت را انتخاب کن، اطلاعاتت را تکمیل کن و ماجراجویی اصیل ایرانی‌ات شروع می‌شود.'
            : lang === 'ar' ? 'اختر التطابق المثالي، أكمل بياناتك، وتبدأ مغامرتك الإيرانية الأصيلة.'
            : 'Choose your perfect match, complete your details, and your authentic Iran adventure begins.',
    planCta: lang === 'fa' ? 'شروع برنامه‌ریزی با هوش مصنوعی'
          : lang === 'ar' ? 'ابدأ التخطيط مع الذكاء الاصطناعي'
          : 'Start Planning with AI',

    // ── My Travel Requests preview ──
    requestsTitle: lang === 'fa' ? 'درخواست‌های سفر من'
                : lang === 'ar' ? 'طلبات سفري'
                : 'My Travel Requests',
    requestsSubtitle: lang === 'fa' ? 'سفرهایی که درخواست داده‌ای را ببین و مدیریت کن'
                   : lang === 'ar' ? 'تصفّح وأدر الرحلات التي طلبتها'
                   : "View and manage the journeys you've requested",
    requestsEmpty: lang === 'fa' ? 'هنوز سفری شروع نکرده‌ای. با هوش مصنوعی ما گفتگو کن تا تجربه ایده‌آلت در ایران را کشف کنی.'
                : lang === 'ar' ? 'لم تبدأ رحلتك بعد. تحدّث مع مساعدنا الذكي لاكتشاف تجربتك الإيرانية المثالية.'
                : "You haven't started a journey yet. Chat with our AI to discover your perfect Iran experience.",
    requestsHasSome: lang === 'fa' ? 'پیشنهادهای راهنماها به درخواست‌های فعالت اینجا منتظر بررسی هستند.'
                  : lang === 'ar' ? 'تنتظرك عروض المرشدين على طلباتك النشطة هنا.'
                  : "Proposals from local guides on your active requests are waiting for you.",
    goToAi: lang === 'fa' ? 'برو به دستیار هوش مصنوعی'
         : lang === 'ar' ? 'انتقل إلى مساعد الذكاء الاصطناعي'
         : 'Go to AI Assistant',
    viewAll: lang === 'fa' ? 'مشاهده همه درخواست‌ها'
          : lang === 'ar' ? 'عرض جميع الطلبات'
          : 'View All Requests',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <section className="relative h-[420px] sm:h-[460px] overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover scale-110 blur-[3px]" loading="eager" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/60 via-navy/75 to-background" />
          <div className="absolute inset-0 carpet-texture opacity-40" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 pt-28 sm:pt-32 pb-10"
        >
          <p className="font-body text-[11px] tracking-[0.25em] uppercase text-gold/80 mb-3">
            {tx.slogan}
          </p>
          <div className="flex items-end gap-6">
            <UserAvatar profile={localProfile} userId={user?.id} onSave={(p) => setLocalProfile(p)} size={132} />
            <div className="pb-2">
              <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-white leading-tight">
                {localProfile?.full_name || user?.user_metadata?.full_name || (lang === 'fa' ? 'مسافر' : lang === 'ar' ? 'مسافر' : 'Traveller')}
              </h1>
              <p className="font-body text-sm text-white/65 mt-1.5">
                {tx.memberSince} {memberSince}
              </p>
              {localProfile?.city && (
                <p className="flex items-center gap-1.5 font-body text-sm text-white/75 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-gold" />
                  {localProfile.city}
                </p>
              )}
              {isTourist && (localProfile?.nationality || localProfile?.age) && (
                <p className="font-body text-xs text-white/60 mt-1.5">
                  {[localProfile?.nationality, localProfile?.age ? `${localProfile.age} ${lang === 'fa' ? 'سال' : lang === 'ar' ? 'سنة' : 'years old'}` : null].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Tourist mobile quick actions: these need to be visible before the
          editable profile content, rather than appearing after it at the end
          of the mobile layout. */}
      {isTourist && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="lg:hidden max-w-6xl mx-auto px-5 sm:px-8 mt-5"
          aria-label={tx.quickActions}
        >
          <div className="relative overflow-hidden rounded-3xl bg-card border border-accent/25 p-4 shadow-lg shadow-accent/10">
            <div className="absolute -top-12 -end-10 w-32 h-32 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-heading text-base font-semibold text-foreground">{tx.quickActions}</p>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{tx.quickActionsDesc}</p>
                </div>
                {requestCount > 0 && (
                  <span className="shrink-0 min-w-7 h-7 px-2 rounded-full bg-gold text-navy text-xs font-bold flex items-center justify-center">
                    {requestCount}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/profile/requests"
                  className="min-h-24 rounded-2xl bg-accent hover:bg-accent/90 active:scale-[0.98] text-white p-3.5 flex flex-col items-start justify-between transition-all shadow-md shadow-accent/20"
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-body text-sm font-semibold text-start leading-tight">{tx.myRequests}</span>
                </Link>
                <Link
                  to="/profile/settings"
                  className="min-h-24 rounded-2xl border border-border/60 bg-background/50 hover:border-accent/50 hover:bg-accent/5 active:scale-[0.98] p-3.5 flex flex-col items-start justify-between text-foreground transition-all"
                >
                  <Settings className="w-5 h-5 text-accent" />
                  <span className="font-body text-sm font-semibold text-start leading-tight">{tx.editProfile}</span>
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Pending approval / incomplete profile banner (guide / agency only) ── */}
      {(localProfile?.role === 'guide' || localProfile?.role === 'agency') && !localProfile?.is_approved && (
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 mt-6">
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${localProfile.is_rejected ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <Clock className={`w-5 h-5 shrink-0 mt-0.5 ${localProfile.is_rejected ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`font-heading text-sm font-semibold ${localProfile.is_rejected ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {localProfile.is_rejected
                  ? (lang === 'fa' ? 'پروفایل شما رد شد' : lang === 'ar' ? 'تم رفض ملفك الشخصي' : 'Your profile was rejected')
                  : t('profile_pending_title')}
              </p>
              <p className={`font-body text-sm mt-0.5 ${localProfile.is_rejected ? 'text-red-700/80 dark:text-red-400/80' : 'text-amber-700/80 dark:text-amber-400/80'}`}>
                {localProfile.approval_rejection_reason || t('profile_pending_desc')}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* ── Incomplete profile banner ── */}
      {(localProfile?.role === 'guide' || localProfile?.role === 'agency') && !localProfile?.profile_completed && localProfile?.is_approved && (
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 mt-6">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
            <Clock className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-heading text-sm font-semibold text-red-700 dark:text-red-400">
                Profile Incomplete
              </p>
              <p className="font-body text-sm text-red-700/80 dark:text-red-400/80 mt-0.5">
                Your profile is not publicly visible because required fields are missing. Please complete your profile from the dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-10 grid lg:grid-cols-3 gap-6">
        {/* Left column: editable details */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl p-6"
          >
            <EditableField
              label={isTourist ? tx.homeCity : tx.city}
              value={localProfile?.city || ''}
              placeholder={isTourist ? tx.homeCityPh : tx.cityPh}
              onSave={saveField('city')}
            />
            {isTourist && (
              <>
                <EditableField
                  label={tx.nationality}
                  value={localProfile?.nationality || ''}
                  placeholder={tx.nationalityPh}
                  onSave={saveField('nationality')}
                />
                <EditableField
                  label={tx.age}
                  value={localProfile?.age ?? ''}
                  placeholder={tx.agePh}
                  type="number"
                  min={1}
                  max={120}
                  onSave={saveAge}
                />
                <EditableField
                  label={tx.languages}
                  value={parseLanguages(localProfile?.languages).join(', ')}
                  placeholder={tx.languagesPh}
                  helperText={lang === 'fa' ? 'زبان‌ها را با ویرگول از هم جدا کنید.' : lang === 'ar' ? 'افصل بين اللغات بفاصلة.' : 'Separate multiple languages with commas.'}
                  onSave={saveLanguages}
                />
              </>
            )}
            {!isTourist && (
              <EditableField
                label={tx.aboutMe}
                value={localProfile?.bio || ''}
                placeholder={tx.aboutPh}
                type="textarea"
                onSave={saveField('bio')}
              />
            )}
          </motion.div>

          {/* Verification badges */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl p-6"
          >
            <h3 className="font-heading text-sm font-semibold text-foreground mb-4">{tx.verification}</h3>
            <div className="flex flex-wrap gap-2.5">
              <VerificationBadge icon={Phone} label={tx.phone} verified={Boolean(localProfile?.phone_verified)} />
              <VerificationBadge icon={Mail}  label={tx.email} verified={Boolean(user?.email_confirmed_at)} />
              <VerificationBadge icon={Globe} label={tx.social} verified={false} />
            </div>
          </motion.div>

          {/* ── How to Plan Your Trip with AI ── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative bg-card/60 backdrop-blur-xl border border-gold/30 rounded-3xl p-6 sm:p-8 overflow-hidden"
          >
            {/* Subtle gold glow in the corner so the AI card sits a notch above
                the surrounding glass cards visually. */}
            <div className="absolute -top-16 -end-16 w-48 h-48 rounded-full bg-gold/15 blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-gold" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">{tx.planTitle}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { icon: MessageCircle, title: tx.step1Title, desc: tx.step1Desc },
                  { icon: Map,           title: tx.step2Title, desc: tx.step2Desc },
                  { icon: CheckCircle2,  title: tx.step3Title, desc: tx.step3Desc },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="relative p-4 rounded-2xl bg-background/40 border border-border/30 hover:border-gold/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-gold/10 text-gold flex items-center justify-center">
                        <s.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gold/70">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="font-heading text-sm font-semibold text-foreground mb-1">{s.title}</p>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-center sm:justify-start">
                <Link
                  to="/ai-assistant"
                  className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-gold-light text-navy font-body font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-gold/30 w-full sm:w-auto justify-center"
                >
                  <Sparkles className="w-4 h-4" />
                  {tx.planCta}
                  <Arrow className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </motion.section>

          {/* ── My Travel Requests preview ── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Compass className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">{tx.requestsTitle}</h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{tx.requestsSubtitle}</p>
                </div>
              </div>
              {requestCount > 0 && (
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold">
                  {requestCount}
                </span>
              )}
            </div>

            {requestCount === 0 ? (
              <p className="font-body text-sm text-muted-foreground leading-relaxed mt-4 mb-6">
                {tx.requestsEmpty}
              </p>
            ) : (
              <p className="font-body text-sm text-muted-foreground leading-relaxed mt-4 mb-6">
                {tx.requestsHasSome}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                to="/ai-assistant"
                className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-white text-sm font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4" />
                {tx.goToAi}
              </Link>
              <Link
                to="/profile/requests"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-gold hover:text-gold-light transition group/link sm:ms-2"
              >
                {tx.viewAll}
                <Arrow className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.section>
        </div>

        {/* Right column: stats + quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-3"
        >
          <StatTile icon={Plane} value={localProfile?.total_trips ?? 0} label={tx.totalTrips} />
          <StatTile icon={Globe} value={localProfile?.countries_visited ?? 0} label={tx.countries} />
          <StatTile icon={Star}  value={reviewCount} label={tx.reviews} />

          <div className="hidden lg:block bg-card/60 backdrop-blur-xl border border-border/40 rounded-2xl p-4 mt-4 space-y-2">
            <Link
              to="/profile/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-accent/10 hover:text-accent transition"
            >
              <Settings className="w-4 h-4" />
              {tx.editProfile}
            </Link>
            <Link
              to="/profile/requests"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-accent/10 hover:text-accent transition"
            >
              <ClipboardList className="w-4 h-4" />
              {tx.myRequests}
            </Link>

          </div>
        </motion.div>
      </section>
    </div>
  );
}
