import { useMemo, useState } from 'react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, Building2, MapPin, Globe, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { useAgencies, useAvailableProfileLanguages } from '@/hooks/useSupabase';
import { avatarFor } from '@/lib/avatar';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { destinationSelectionAliases, iranianDestinationOptions } from '@/data/iranianCities';
import { toLanguageOptions } from '@/data/languages';
import { matchesAnySelection, newestComparator, recommendedComparator, reviewCountOf } from '@/lib/listingFilters';

// ── Filter options ────────────────────────────────────────────────────────────

const CITY_OPTIONS = [
  { key: 'all', en: 'All Destinations', fa: 'همه مقصدها', ar: 'كل الوجهات' },
  ...iranianDestinationOptions,
];

const TOUR_TYPE_OPTIONS = [
  { key: 'all', en: 'All Tour Types', fa: 'همه انواع تور', ar: 'كل أنواع الرحلات' },
  { key: 'Cultural', en: 'Cultural', fa: 'فرهنگی', ar: 'ثقافي' },
  { key: 'Adventure', en: 'Adventure', fa: 'ماجراجویی', ar: 'مغامرة' },
  { key: 'Luxury', en: 'Luxury', fa: 'لاکچری', ar: 'فاخر' },
  { key: 'Budget-friendly', en: 'Budget-friendly', fa: 'اقتصادی', ar: 'اقتصادي' },
  { key: 'Photography', en: 'Photography', fa: 'عکاسی', ar: 'تصوير' },
  { key: 'Academic', en: 'Academic / Research', fa: 'آکادمیک', ar: 'أكاديمي' },
  { key: 'Religious', en: 'Religious', fa: 'مذهبی', ar: 'ديني' },
  { key: 'Nature', en: 'Nature & Eco', fa: 'طبیعت', ar: 'الطبيعة' },
];

const SORT_OPTIONS = [
  { key: 'recommended', en: 'Recommended', fa: 'پیشنهاد شده', ar: 'موصى به' },
  { key: 'newest', en: 'Newest First', fa: 'جدیدترین اول', ar: 'الأحدث أولاً' },
  { key: 'rating', en: 'Highest Rated', fa: 'بالاترین امتیاز', ar: 'الأعلى تقييماً' },
  { key: 'reviews', en: 'Most Reviewed', fa: 'بیشترین نظر', ar: 'الأكثر تقييماً' },
];

const DEFAULT_FILTERS = { city: [], language: 'all', tourType: 'all' };

function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).toLowerCase());
  return String(val).split(/[,·;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ── Agency Card ────────────────────────────────────────────────────────────────

function AgencyCard({ agency, lang, onNavigate }) {
  const tourTypes = Array.isArray(agency.tour_types)
    ? agency.tour_types
    : Array.isArray(agency.specialties)
    ? agency.specialties
    : agency.specialty
    ? [agency.specialty]
    : [];
  const licensed = agency.is_licensed || agency.is_approved || agency.is_verified;
  const reviewCount = agency.reviews ?? agency.review_count ?? 0;
  const hasAvatar = !!agency.avatar_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      onClick={() => onNavigate(`/agencies/${agency.id}`)}
      className="listing-profile-card bg-card rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-border/40 hover:border-gold/30 group"
    >
      {/* Photo / Logo area */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gold/5">
        {hasAvatar ? (
          <img decoding="async" loading="lazy"
            src={avatarFor(agency)}
            alt={agency.full_name || ''}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/10 to-gold/5">
            <Building2 className="w-16 h-16 text-gold/40" />
          </div>
        )}
        {/* City badge */}
        {agency.city && (
          <span className="absolute top-3 start-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
            <MapPin className="w-3 h-3 text-gold" />
            {agency.city}
          </span>
        )}
        {/* Licensed badge */}
        {licensed && (
          <span className="absolute top-3 end-3 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-medium">
            <ShieldCheck className="w-3 h-3" />
            {lang === 'fa' ? 'مجاز' : lang === 'ar' ? 'معتمد' : 'Licensed'}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-heading text-lg font-semibold text-foreground truncate mb-1">
          {agency.full_name || (lang === 'fa' ? 'آژانس' : 'Agency')}
        </h3>

        {/* Stars */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-3.5 h-3.5 ${
                  n <= Math.round(agency.rating ?? 0)
                    ? 'fill-gold text-gold'
                    : 'fill-border text-border'
                }`}
              />
            ))}
          </div>
          {agency.rating != null && (
            <span className="font-body text-sm font-semibold text-foreground">{Number(agency.rating).toFixed(1)}</span>
          )}
          <span className="font-body text-xs text-muted-foreground">
            · {reviewCount} {lang === 'fa' ? 'نظر' : lang === 'ar' ? 'تقييم' : 'Reviews'}
          </span>
        </div>

        {/* Bio excerpt */}
        {agency.bio && (
          <p className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {agency.bio}
          </p>
        )}

        {/* Tour type tags */}
        {tourTypes.length > 0 && (
          <div className="listing-profile-tags flex flex-wrap gap-1.5">
            {tourTypes.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-[11px] font-body font-medium bg-gold/10 text-gold border border-gold/20"
              >
                {s}
              </span>
            ))}
            {tourTypes.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-body text-muted-foreground bg-muted">
                +{tourTypes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Agencies() {
  const { dir, lang } = useI18n();
  const navigate = useNavigate();
  // useAgencies() already filters is_approved: true from Supabase.
  const { agencies, loading, error } = useAgencies();
  const availableLanguages = useAvailableProfileLanguages();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('recommended');

  const languageOptions = useMemo(() => [
    { key: 'all', en: 'All Languages', fa: 'همه زبان‌ها', ar: 'كل اللغات' },
    ...toLanguageOptions(availableLanguages),
  ], [availableLanguages]);

  const hasActive = filters.city.length > 0 || filters.language !== 'all' || filters.tourType !== 'all';
  const reset = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    const selectedCities = destinationSelectionAliases(filters.city);
    return agencies.filter(a => {
      if (!matchesAnySelection([a.city, a.primary_city, a.other_cities, a.cities], selectedCities)) return false;

      if (filters.language !== 'all') {
        const langs = parseList(a.languages ?? a.support_languages);
        if (!langs.some(l => l === filters.language.toLowerCase())) return false;
      }

      if (filters.tourType !== 'all') {
        const types = parseList(a.tour_types ?? a.specialties);
        if (!types.some(t => t.includes(filters.tourType.toLowerCase()))) return false;
      }

      return true;
    });
  }, [agencies, filters]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return newestComparator(a, b);
    if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (sortBy === 'reviews') return reviewCountOf(b) - reviewCountOf(a);
    return recommendedComparator(a, b);
  }), [filtered, sortBy]);

  const tx = {
    title:    lang === 'fa' ? 'آژانس‌های مسافرتی' : lang === 'ar' ? 'وكالات السفر'         : 'Travel Agencies',
    subtitle: lang === 'fa' ? 'آژانس‌های رسمی و مورد اعتماد ایران برای سفر مرفه و آسوده' : lang === 'ar' ? 'وكالات إيرانية موثوقة ومرخصة لسفر مريح وسلس' : 'Trusted, licensed Iranian agencies for an effortless journey',
    loading:  lang === 'fa' ? 'در حال بارگذاری آژانس‌ها...' : lang === 'ar' ? 'جار تحميل الوكالات...' : 'Loading agencies...',
    error:    lang === 'fa' ? 'بارگذاری آژانس‌ها با خطا مواجه شد' : lang === 'ar' ? 'فشل تحميل الوكالات' : 'Failed to load agencies',
    empty:    lang === 'fa' ? 'آژانسی با این فیلترها یافت نشد' : lang === 'ar' ? 'لا توجد وكالات بهذه الفلاتر' : 'No agencies match these filters',
  };

  return (
    <div dir={dir} className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light text-foreground mb-4">
            {tx.title}
          </h1>
          <p className="font-body text-muted-foreground max-w-xl text-lg">
            {tx.subtitle}
          </p>
        </motion.div>

        {/* Filter bar */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-accent/50 text-sm tracking-widest">✦ ❋ ✦</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent/[0.03] via-card/80 to-gold/[0.03] border border-border/40 backdrop-blur-sm" />
            <div className="relative flex flex-wrap gap-3 p-4">
              <FilterDropdown
                label={lang === 'fa' ? 'شهر' : lang === 'ar' ? 'المدينة' : 'City'}
                value={filters.city}
                options={CITY_OPTIONS}
                onChange={(v) => setFilters(f => ({ ...f, city: v }))}
                lang={lang}
                icon={MapPin}
                searchable
                multiple
              />
              <FilterDropdown
                label={lang === 'fa' ? 'زبان' : lang === 'ar' ? 'اللغة' : 'Language'}
                value={filters.language}
                options={languageOptions}
                onChange={(v) => setFilters(f => ({ ...f, language: v }))}
                lang={lang}
                icon={Globe}
              />
              <FilterDropdown
                label={lang === 'fa' ? 'نوع تور' : lang === 'ar' ? 'نوع الجولة' : 'Tour Type'}
                value={filters.tourType}
                options={TOUR_TYPE_OPTIONS}
                onChange={(v) => setFilters(f => ({ ...f, tourType: v }))}
                lang={lang}
                icon={SlidersHorizontal}
              />
              <div className="w-px self-stretch bg-border/40 mx-1 hidden sm:block" />
              <FilterDropdown
                label={lang === 'fa' ? 'مرتب‌سازی' : lang === 'ar' ? 'ترتيب' : 'Sort by'}
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={setSortBy}
                lang={lang}
                icon={ArrowUpDown}
                inactiveKey="recommended"
              />
              <div className="flex items-center gap-3 ms-auto self-center px-2">
                <span className="font-body text-sm text-muted-foreground whitespace-nowrap">
                  <span className="text-foreground font-semibold">{filtered.length}</span>
                  {lang === 'fa' ? ' آژانس' : lang === 'ar' ? ' وكالة' : ' agencies'}
                </span>
                {hasActive && (
                  <button onClick={reset} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-body border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all">
                    <X className="w-3 h-3" />
                    {lang === 'fa' ? 'پاک کردن' : lang === 'ar' ? 'مسح' : 'Clear'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-accent/30 text-xs">◆</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
        </div>

        {/* Agency Grid */}
        {loading ? (
          <div className="flex min-h-[18rem] items-center justify-center">
            <BreathingGlow label={tx.loading} />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="font-body text-destructive mb-2">{tx.error}</p>
            <p className="font-body text-xs text-muted-foreground">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-border flex items-center justify-center">
              <span className="text-3xl text-accent/40">❋</span>
            </div>
            <p className="font-heading text-2xl text-muted-foreground font-light">{tx.empty}</p>
            <button onClick={reset} className="mt-4 text-sm font-body text-accent hover:underline">
              {lang === 'fa' ? 'پاک کردن فیلترها' : lang === 'ar' ? 'مسح الفلاتر' : 'Clear all filters'}
            </button>
          </div>
        ) : (
          <div className="listing-mobile-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {sorted.map((agency) => (
              <AgencyCard key={agency.id} agency={agency} lang={lang} onNavigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
