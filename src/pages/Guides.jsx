import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, MapPin, Globe, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { useAvailableProfileLanguages, useGuides } from '@/hooks/useSupabase';
import { avatarFor } from '@/lib/avatar';
import { guides as localGuides } from '@/data/guides';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { destinationSelectionAliases, iranianDestinationOptions } from '@/data/iranianCities';
import { toLanguageOptions } from '@/data/languages';
import { matchesAnySelection, newestComparator, recommendedComparator, reviewCountOf } from '@/lib/listingFilters';

// ── Filter options ────────────────────────────────────────────────────────────

const CITY_OPTIONS = [
  { key: 'all', en: 'All Destinations', fa: 'همه مقصدها', ar: 'كل الوجهات' },
  ...iranianDestinationOptions,
];

const SPECIALTY_OPTIONS = [
  { key: 'all', en: 'All Specialties', fa: 'همه تخصص‌ها', ar: 'كل التخصصات' },
  { key: 'history', en: 'History & Heritage', fa: 'تاریخ و میراث', ar: 'التاريخ والتراث' },
  { key: 'architecture', en: 'Architecture', fa: 'معماری', ar: 'العمارة' },
  { key: 'nature', en: 'Nature & Eco', fa: 'طبیعت', ar: 'الطبيعة' },
  { key: 'food', en: 'Food & Culinary', fa: 'غذا', ar: 'الطهي' },
  { key: 'photography', en: 'Photography', fa: 'عکاسی', ar: 'التصوير' },
  { key: 'desert', en: 'Desert & Adventure', fa: 'کویر', ar: 'الصحراء' },
  { key: 'spiritual', en: 'Spiritual & Religious', fa: 'معنوی', ar: 'ديني' },
  { key: 'business', en: 'Business Travel', fa: 'سفر تجاری', ar: 'أعمال' },
];

const SORT_OPTIONS = [
  { key: 'recommended', en: 'Recommended', fa: 'پیشنهاد شده', ar: 'موصى به' },
  { key: 'newest', en: 'Newest First', fa: 'جدیدترین اول', ar: 'الأحدث أولاً' },
  { key: 'rating', en: 'Highest Rated', fa: 'بالاترین امتیاز', ar: 'الأعلى تقييماً' },
  { key: 'reviews', en: 'Most Reviewed', fa: 'بیشترین نظر', ar: 'الأكثر تقييماً' },
];

const DEFAULT_FILTERS = { city: [], language: 'all', specialty: 'all' };

function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).toLowerCase());
  return String(val).split(/[,·;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ── Guide Card ────────────────────────────────────────────────────────────────

function GuideCard({ guide, lang, onNavigate }) {
  const specialties = Array.isArray(guide.specialties)
    ? guide.specialties
    : guide.specialty
    ? [guide.specialty]
    : [];
  const verified = guide.is_approved || guide.is_verified;
  const reviewCount = guide.reviews ?? guide.review_count ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      onClick={() => onNavigate(`/guides/${guide.id}`)}
      className="listing-profile-card bg-card rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-border/40 hover:border-gold/30 group"
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img decoding="async" loading="lazy"
          src={avatarFor(guide)}
          alt={guide.full_name || ''}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* City badge top-left */}
        {guide.city && (
          <span className="absolute top-3 start-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
            <MapPin className="w-3 h-3 text-gold" />
            {guide.city}
          </span>
        )}
        {/* Verified badge top-right */}
        {verified && (
          <span className="absolute top-3 end-3 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-medium">
            <ShieldCheck className="w-3 h-3" />
            {lang === 'fa' ? 'تأیید شده' : lang === 'ar' ? 'موثق' : 'Verified'}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Name */}
        <h3 className="font-heading text-lg font-semibold text-foreground truncate mb-1">
          {guide.full_name || (lang === 'fa' ? 'راهنما' : 'Guide')}
        </h3>

        {/* Stars + rating + reviews */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-3.5 h-3.5 ${
                  n <= Math.round(guide.rating ?? 0)
                    ? 'fill-gold text-gold'
                    : 'fill-border text-border'
                }`}
              />
            ))}
          </div>
          {guide.rating != null && (
            <span className="font-body text-sm font-semibold text-foreground">{Number(guide.rating).toFixed(1)}</span>
          )}
          <span className="font-body text-xs text-muted-foreground">
            · {reviewCount} {lang === 'fa' ? 'نظر' : lang === 'ar' ? 'تقييم' : 'Reviews'}
          </span>
        </div>

        {/* Bio excerpt */}
        {guide.bio && (
          <p className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {guide.bio}
          </p>
        )}

        {/* Specialty tags */}
        {specialties.length > 0 && (
          <div className="listing-profile-tags flex flex-wrap gap-1.5">
            {specialties.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-[11px] font-body font-medium bg-gold/10 text-gold border border-gold/20"
              >
                {s}
              </span>
            ))}
            {specialties.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-body text-muted-foreground bg-muted">
                +{specialties.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Guides() {
  const { t, dir, lang } = useI18n();
  const navigate = useNavigate();
  const { guides: supabaseGuides, loading, error } = useGuides();
  const availableLanguages = useAvailableProfileLanguages();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('recommended');

  // useGuides() already filters is_approved: true from Supabase.
  // Fall back to local verified-only data if Supabase returns nothing.
  const allGuides = supabaseGuides.length > 0
    ? supabaseGuides
    : localGuides.filter(g => g.is_verified === true);

  const languageOptions = useMemo(() => [
    { key: 'all', en: 'All Languages', fa: 'همه زبان‌ها', ar: 'كل اللغات' },
    ...toLanguageOptions(availableLanguages),
  ], [availableLanguages]);

  const hasActive = filters.city.length > 0 || filters.language !== 'all' || filters.specialty !== 'all';
  const reset = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    const selectedCities = destinationSelectionAliases(filters.city);
    return allGuides.filter(g => {
      if (!matchesAnySelection([g.city, g.primary_city, g.other_cities, g.cities], selectedCities)) return false;

      if (filters.language !== 'all') {
        const langs = parseList(g.languages);
        if (!langs.some(l => l === filters.language.toLowerCase())) return false;
      }

      if (filters.specialty !== 'all') {
        const specs = [...parseList(g.specialties), ...(g.specialty ? [String(g.specialty).toLowerCase()] : [])];
        if (!specs.some(s => s.includes(filters.specialty.toLowerCase()))) return false;
      }

      return true;
    });
  }, [allGuides, filters]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return newestComparator(a, b);
    if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (sortBy === 'reviews') return reviewCountOf(b) - reviewCountOf(a);
    return recommendedComparator(a, b);
  }), [filtered, sortBy]);

  const loadingText = lang === 'fa' ? 'در حال بارگذاری راهنماها...' : lang === 'ar' ? 'جار تحميل المرشدين...' : 'Loading guides...';
  const errorText   = lang === 'fa' ? 'بارگذاری راهنماها با خطا مواجه شد' : lang === 'ar' ? 'فشل تحميل المرشدين' : 'Failed to load guides';
  const emptyText   = lang === 'fa' ? 'راهنمایی با این فیلترها یافت نشد' : lang === 'ar' ? 'لا توجد نتائج بهذه الفلاتر' : 'No guides match these filters';

  return (
    <div dir={dir} className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light text-foreground mb-4">
            {t('guides_title')}
          </h1>
          <p className="font-body text-muted-foreground max-w-xl text-lg">
            {t('guides_subtitle')}
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
                label={lang === 'fa' ? 'تخصص' : lang === 'ar' ? 'التخصص' : 'Specialty'}
                value={filters.specialty}
                options={SPECIALTY_OPTIONS}
                onChange={(v) => setFilters(f => ({ ...f, specialty: v }))}
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
                  {lang === 'fa' ? ' راهنما' : lang === 'ar' ? ' مرشد' : ' guides'}
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

        {/* Guide Grid */}
        {loading ? (
          <div className="listing-mobile-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="font-body text-destructive mb-2">{errorText}</p>
            <p className="font-body text-xs text-muted-foreground">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-border flex items-center justify-center">
              <span className="text-3xl text-accent/40">❋</span>
            </div>
            <p className="font-heading text-2xl text-muted-foreground font-light">{emptyText}</p>
            <button onClick={reset} className="mt-4 text-sm font-body text-accent hover:underline">
              {lang === 'fa' ? 'پاک کردن فیلترها' : lang === 'ar' ? 'مسح الفلاتر' : 'Clear all filters'}
            </button>
          </div>
        ) : (
          <div className="listing-mobile-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {sorted.map((guide) => (
              <GuideCard key={guide.id} guide={guide} lang={lang} onNavigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
