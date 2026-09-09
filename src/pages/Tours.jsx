import { useState } from 'react';
import { useI18n } from '@/lib/i18n.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import TourFilters from '@/components/tours/TourFilters';
import TourCard from '@/components/tours/TourCard';
import { useTours, FALLBACK_IMAGE } from '@/hooks/useSupabase';
import { matchesAnySelection, recommendedComparator } from '@/lib/listingFilters';
import { destinationSelectionAliases } from '@/data/iranianCities';

const DEFAULT_FILTERS = {
  purpose: 'all',
  theme: 'all',
  duration: 'all',
  city: [],
  price: 'all',
  tourType: 'all',
};

const toMultilangText = (val) => {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  const v = val ?? '';
  return { en: v, fa: v, ar: v };
};

const toMultilangArray = (val) => {
  if (val && typeof val === 'object' && !Array.isArray(val) && (val.en || val.fa || val.ar)) return val;
  const arr = Array.isArray(val) ? val : [];
  return { en: arr, fa: arr, ar: arr };
};

const normalizeTour = (tour) => ({
  ...tour,
  title: toMultilangText(tour.title),
  desc: toMultilangText(tour.desc ?? tour.description),
  cities: toMultilangText(tour.cities),
  highlights: toMultilangArray(tour.highlights),
  cityCount: tour.cityCount ?? tour.city_count ?? 0,
  priceFrom: tour.priceFrom ?? tour.price_from ?? null,
});

const pickImage = (tour) => {
  if (tour.cover_image) return tour.cover_image;
  if (tour.image_url) return tour.image_url;
  if (tour.image) return tour.image;
  if (Array.isArray(tour.gallery) && tour.gallery[0]) return tour.gallery[0];
  return FALLBACK_IMAGE;
};

const DIFFICULTY_RANK = { easy: 1, moderate: 2, challenging: 3 };
const priceOf = (tour) => Number(tour.priceFrom ?? tour.price_from ?? tour.price) || 0;
const durationOf = (tour) => Number(tour.duration) || 0;
const difficultyRankOf = (tour) => DIFFICULTY_RANK[tour.difficulty] ?? Object.keys(DIFFICULTY_RANK).length + 1;
const createdOf = (tour) => {
  const value = tour.created_at ?? tour.id;
  return value == null ? 0 : value;
};

const normalizedTourTypeOf = (tour) => String(tour.tour_type ?? tour.tourType ?? '')
  .trim()
  .toLocaleLowerCase()
  .replaceAll('-', ' ')
  .replaceAll('_', ' ');

const matchesTourType = (tour, selectedType) => {
  if (!selectedType || selectedType === 'all') return true;
  const actual = normalizedTourTypeOf(tour);
  if (!actual) return false;
  if (selectedType === 'private') return actual === 'private' || actual.includes('private tour');
  if (selectedType === 'group') return actual === 'group' || actual.includes('group tour');
  return actual === selectedType;
};

const SORTERS = {
  recommended: recommendedComparator,
  price_asc: (a, b) => priceOf(a) - priceOf(b),
  price_desc: (a, b) => priceOf(b) - priceOf(a),
  duration_asc: (a, b) => durationOf(a) - durationOf(b),
  duration_desc: (a, b) => durationOf(b) - durationOf(a),
  difficulty_asc: (a, b) => difficultyRankOf(a) - difficultyRankOf(b),
  difficulty_desc: (a, b) => difficultyRankOf(b) - difficultyRankOf(a),
  newest: (a, b) => {
    const av = createdOf(a);
    const bv = createdOf(b);
    if (av === bv) return 0;
    return av < bv ? 1 : -1;
  },
};

export default function Tours() {
  const { dir, lang } = useI18n();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('recommended');
  const { tours: rawTours, loading, error } = useTours(filters);
  const selectedCities = destinationSelectionAliases(filters.city);

  const tours = rawTours.filter((tour) => {
    if (!matchesAnySelection([tour.cities, tour.city, tour.location, tour.destinations], selectedCities)) return false;
    if (!matchesTourType(tour, filters.tourType)) return false;

    if (filters.price && filters.price !== 'all') {
      const price = tour.priceFrom || tour.price_from || tour.price || 0;
      if (filters.price === 'budget' && price >= 1200) return false;
      if (filters.price === 'mid' && (price < 1200 || price >= 2500)) return false;
      if (filters.price === 'luxury' && price < 2500) return false;
    }
    return true;
  });

  const sortedTours = SORTERS[sortBy] ? [...tours].sort(SORTERS[sortBy]) : tours;
  const loadingText = lang === 'fa' ? 'در حال بارگذاری تورها...' : lang === 'ar' ? 'جار تحميل الرحلات...' : 'Loading tours...';
  const errorTitle = lang === 'fa' ? 'بارگذاری تورها با خطا مواجه شد' : lang === 'ar' ? 'فشل تحميل الرحلات' : 'Failed to load tours';

  return (
    <div dir={dir} className="pt-24 pb-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TourFilters
          filters={filters}
          onChange={setFilters}
          resultCount={tours.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {loading ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-border flex items-center justify-center animate-pulse">
              <span className="text-3xl text-accent/40">❋</span>
            </div>
            <p className="font-heading text-xl text-muted-foreground font-light">{loadingText}</p>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-destructive/40 flex items-center justify-center">
              <span className="text-3xl text-destructive/60">!</span>
            </div>
            <p className="font-heading text-2xl text-muted-foreground font-light">{errorTitle}</p>
            <p className="font-body text-sm text-destructive mt-2">{error}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {sortedTours.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-24">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-border flex items-center justify-center">
                  <span className="text-3xl text-accent/40">❋</span>
                </div>
                <p className="font-heading text-2xl text-muted-foreground font-light">
                  {lang === 'fa' ? 'توری با این فیلترها یافت نشد' : lang === 'ar' ? 'لا توجد رحلات بهذه المعايير' : 'No tours match these filters'}
                </p>
                <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="mt-4 text-sm font-body text-accent hover:underline">
                  {lang === 'fa' ? 'پاک کردن فیلترها' : lang === 'ar' ? 'مسح الفلاتر' : 'Clear all filters'}
                </button>
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {sortedTours.map((tour, index) => (
                  <TourCard key={tour.id} tour={normalizeTour(tour)} image={pickImage(tour)} index={index} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!loading && !error && tours.length > 0 && (
          <div className="mt-16 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-accent/40 text-2xl">✦ ❋ ✦</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
