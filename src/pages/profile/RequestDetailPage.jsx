import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Calendar, Users, Baby, Car, Hotel,
  Sparkles, FileText, Globe, Clock,
  Tag, Layers, PackageOpen,
} from 'lucide-react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { localize, localizeBookingStatus, localizeTripOption } from '@/lib/localize';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:         { label: 'Pending',           classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  active:          { label: 'Active',             classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  waiting:         { label: 'Waiting',            classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  matched:         { label: 'Matched',            classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  proposals_ready: { label: 'Choose a Guide',     classes: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  confirmed:       { label: 'Confirmed',          classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  completed:       { label: 'Completed',          classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  received:        { label: 'Proposals Received', classes: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  expired:         { label: 'Expired',            classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-700' },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(', ') : String(value);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground leading-relaxed">{display}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-3xl p-5 sm:p-6">
      <h2 className="font-heading text-base font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </div>
  );
}

function formatDate(dateStr, lang) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { t, lang, dir } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);

  const [request, setRequest] = useState(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate('/login');
  }, [isLoadingAuth, isAuthenticated, navigate]);

  // Fetch trip request
  useEffect(() => {
    if (!id || !user?.id) return;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('trip_requests')
        .select('*, source_tour:tours!source_tour_id(id, slug, title, status)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (err || !data) {
        setError(err?.message || 'Request not found.');
      } else {
        setRequest(data);
      }
      setLoading(false);
    })();
  }, [id, user?.id]);

  if (isLoadingAuth || loading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <BreathingGlow className="w-8 h-8" />
      </div>
    );
  }

  const r = request;
  const statusCfg = STATUS_CONFIG[r?.status] || STATUS_CONFIG.active;
  const hasTransportation = r?.assistance?.includes('Transportation');
  const hasAccommodation  = r?.assistance?.includes('Accommodation');
  const cities = Array.isArray(r?.destination) ? r.destination : r?.destination ? [r.destination] : [];
  const title = r?.title
    || (cities.length ? `${l('Trip to', 'سفر به', 'رحلة إلى')} ${cities.join(', ')}` : l('Trip Request', 'درخواست سفر', 'طلب رحلة'));

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 lg:px-10">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 mb-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all text-gray-700 dark:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {l('Back', 'بازگشت', 'رجوع')}
        </button>

        {error ? (
          <div className="bg-card/60 border border-border/40 rounded-3xl p-16 text-center">
            <p className="font-body text-sm text-destructive">{l('Request not found.', 'درخواست پیدا نشد.', 'لم يُعثر على الطلب.')}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Hero card */}
            <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-3xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
                    {title}
                  </h1>
                  {cities.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-gold shrink-0" />
                      {cities.map(city => (
                        <span
                          key={city}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${statusCfg.classes}`}>
                  {localizeBookingStatus(r?.status, lang) || statusCfg.label}
                </span>
              </div>

              {r?.created_at && (
                <p className="font-body text-xs text-muted-foreground/60 mt-2">
                  {l('Submitted', 'ثبت‌شده در', 'قُدّم في')} {formatDate(r.created_at, lang)}
                </p>
              )}
            </div>

            {r?.source_tour && (
              <Link
                to={`/tours/${r.source_tour.slug}`}
                className="flex items-center gap-3 rounded-3xl border border-accent/20 bg-accent/5 p-5 transition-colors hover:bg-accent/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <PackageOpen className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-accent">
                    {l('Based on a Tour Package', 'بر اساس این بسته سفر', 'استناداً إلى باقة السفر هذه')}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                    {r.source_tour.title || l('View tour package', 'مشاهده بسته سفر', 'عرض باقة السفر')}
                  </span>
                </span>
              </Link>
            )}

            {/* Travel dates & times */}
            <Section title={l('Travel Dates', 'تاریخ‌های سفر', 'مواعيد السفر')}>
              <DetailRow icon={Calendar} label={l('Start Date', 'تاریخ شروع', 'تاريخ البداية')} value={formatDate(r?.start_date, lang)} />
              <DetailRow icon={Calendar} label={l('End Date', 'تاریخ پایان', 'تاريخ النهاية')} value={formatDate(r?.end_date, lang)} />
              <DetailRow icon={Clock} label={l('Arrival Time', 'زمان ورود', 'وقت الوصول')} value={r?.arrival_time} />
              <DetailRow icon={Clock} label={l('Departure Time', 'زمان خروج', 'وقت المغادرة')} value={r?.departure_time} />
              {r?.timings_flexible && (
                <p className="text-xs text-muted-foreground mt-2 italic">{l('Timings are flexible', 'زمان‌ها قابل تغییر هستند', 'المواعيد مرنة')}</p>
              )}
            </Section>

            {/* Travellers */}
            <Section title={l('Travellers', 'مسافران', 'المسافرون')}>
              <DetailRow icon={Users} label={l('Adults', 'بزرگسالان', 'البالغون')} value={r?.adults} />
              <DetailRow icon={Users} label={l('Men', 'مردان', 'الرجال')} value={r?.male_adults ?? null} />
              <DetailRow icon={Users} label={l('Women', 'زنان', 'النساء')} value={r?.female_adults ?? null} />
              <DetailRow icon={Baby} label={l('Children', 'کودکان', 'الأطفال')} value={r?.children > 0 ? r.children : null} />
            </Section>

            {/* Services & preferences */}
            <Section title={l('Services & Preferences', 'خدمات و ترجیحات', 'الخدمات والتفضيلات')}>
              <DetailRow
                icon={Car}
                label={l('Transportation', 'حمل‌ونقل', 'النقل')}
                value={hasTransportation ? l('Required', 'درخواست شده', 'مطلوب') : null}
              />
              <DetailRow
                icon={Hotel}
                label={l('Accommodation', 'اقامت', 'الإقامة')}
                value={hasAccommodation
                  ? (r?.accommodation_stars ? `${l('hotel', 'هتل', 'فندق')} ${r.accommodation_stars}★` : l('Required', 'درخواست شده', 'مطلوب'))
                  : null}
              />
              <DetailRow icon={Sparkles} label={l('Tour Type', 'نوع تور', 'نوع الجولة')} value={localizeTripOption(r?.tour_type, lang)} />
              <DetailRow icon={Globe} label={l('Guide Languages', 'زبان‌های راهنما', 'لغات المرشد')} value={r?.guide_languages} />
              <DetailRow icon={Tag} label={l('Holiday Types', 'سبک سفر', 'أنماط الرحلة')} value={localizeTripOption(r?.holiday_types, lang)} />
              <DetailRow icon={Layers} label={l('Additional Services', 'خدمات اضافی', 'خدمات إضافية')} value={localizeTripOption(r?.additional_services, lang)} />
            </Section>

            {/* Requirements / notes */}
            {r?.requirements && (
              <Section title={l('Requirements & Notes', 'نیازها و توضیحات', 'الاحتياجات والملاحظات')}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{r.requirements}</p>
                </div>
              </Section>
            )}

          </motion.div>
        )}
      </div>
    </div>
  );
}
