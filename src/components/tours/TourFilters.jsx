import { MapPin, Users, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { iranianDestinationOptions } from '@/data/iranianCities';

const themeOptions = [
  { key: 'all',         en: 'All Themes',        fa: 'همه تم‌ها',       ar: 'كل الأنواع' },
  { key: 'cultural',    en: 'Art & Culture',     fa: 'هنر و فرهنگ',     ar: 'الفن والثقافة' },
  { key: 'nature',      en: 'Nature',            fa: 'طبیعت',           ar: 'الطبيعة' },
  { key: 'coastal',     en: 'Coastal',           fa: 'ساحلی',           ar: 'ساحلي' },
  { key: 'urban',       en: 'Urban',             fa: 'شهری',            ar: 'حضري' },
  { key: 'rural',       en: 'Rural',             fa: 'روستایی',         ar: 'ريفي' },
  { key: 'luxury',      en: 'Luxury',            fa: 'لوکس',            ar: 'فاخر' },
  { key: 'budget',      en: 'Budget',            fa: 'اقتصادی',         ar: 'اقتصادي' },
];

const durationOptions = [
  { key: 'all',    en: 'Any Duration', fa: 'هر مدت',       ar: 'أي مدة' },
  { key: 'short',  en: 'Up to 7 days', fa: 'تا ۷ روز',     ar: 'حتى 7 أيام' },
  { key: 'medium', en: '8–11 days',    fa: '۸ تا ۱۱ روز',  ar: '8-11 أيام' },
  { key: 'long',   en: '12+ days',     fa: '۱۲+ روز',      ar: '12+ أيام' },
];

const cityOptions = [
  { key: 'all', en: 'All Destinations', fa: 'همه مقصدها', ar: 'كل الوجهات' },
  ...iranianDestinationOptions,
];

const priceOptions = [
  { key: 'all',    en: 'All Prices', fa: 'همه قیمت‌ها', ar: 'كل الأسعار' },
  { key: 'budget', en: 'Budget',     fa: 'اقتصادی',     ar: 'اقتصادي',     max: 1200 },
  { key: 'mid',    en: 'Mid-range',  fa: 'متوسط',       ar: 'متوسط',       min: 1200, max: 2500 },
  { key: 'luxury', en: 'Luxury',     fa: 'لوکس',        ar: 'فاخر',        min: 2500 },
];

const tourTypeOptions = [
  { key: 'all',     en: 'All Tour Types', fa: 'همه نوع تورها', ar: 'كل أنواع الرحلات' },
  { key: 'private', en: 'Private',        fa: 'خصوصی',         ar: 'خاصة' },
  { key: 'group',   en: 'Group',          fa: 'گروهی',         ar: 'جماعية' },
];

const sortOptions = [
  { key: 'recommended',     en: 'Highest Review',                 fa: 'بالاترین امتیاز نظرات',       ar: 'أعلى التقييمات' },
  { key: 'newest',          en: 'Newest First',                   fa: 'جدیدترین اول',                 ar: 'الأحدث أولاً' },
  { key: 'price_asc',       en: 'Price: Low to High',             fa: 'قیمت: کم به زیاد',             ar: 'السعر: من الأقل للأعلى' },
  { key: 'price_desc',      en: 'Price: High to Low',             fa: 'قیمت: زیاد به کم',             ar: 'السعر: من الأعلى للأقل' },
  { key: 'duration_asc',    en: 'Duration: Shortest First',       fa: 'مدت: کوتاه‌ترین اول',          ar: 'المدة: الأقصر أولاً' },
  { key: 'duration_desc',   en: 'Duration: Longest First',        fa: 'مدت: طولانی‌ترین اول',         ar: 'المدة: الأطول أولاً' },
  { key: 'difficulty_asc',  en: 'Difficulty: Easiest First',      fa: 'سختی: آسان‌ترین اول',          ar: 'الصعوبة: الأسهل أولاً' },
  { key: 'difficulty_desc', en: 'Difficulty: Hardest First',      fa: 'سختی: سخت‌ترین اول',           ar: 'الصعوبة: الأصعب أولاً' },
];

export default function TourFilters({ filters, onChange, resultCount, sortBy, onSortChange }) {
  const { lang, dir } = useI18n();

  const hasActive = filters.theme !== 'all'
    || filters.duration !== 'all'
    || (Array.isArray(filters.city) && filters.city.length > 0)
    || (filters.price && filters.price !== 'all')
    || (filters.tourType && filters.tourType !== 'all');

  const reset = () => onChange({
    ...filters,
    theme: 'all',
    duration: 'all',
    city: [],
    price: 'all',
    tourType: 'all',
  });

  return (
    <div dir={dir} className="mb-12">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="text-accent/50 text-sm tracking-widest">✦ ❋ ✦</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent/[0.03] via-card/80 to-gold/[0.03] border border-border/40 backdrop-blur-sm" />

        <div className="relative flex flex-wrap gap-3 p-4">
          <FilterDropdown
            label={lang === 'fa' ? 'شهر' : lang === 'ar' ? 'المدينة' : 'City'}
            value={filters.city || []}
            options={cityOptions}
            onChange={(value) => onChange({ ...filters, city: value })}
            lang={lang}
            icon={MapPin}
            searchable
            multiple
          />

          <FilterDropdown
            label={lang === 'fa' ? 'تم' : lang === 'ar' ? 'النوع' : 'Theme'}
            value={filters.theme || 'all'}
            options={themeOptions}
            onChange={(value) => onChange({ ...filters, theme: value })}
            lang={lang}
          />

          <FilterDropdown
            label={lang === 'fa' ? 'مدت' : lang === 'ar' ? 'المدة' : 'Duration'}
            value={filters.duration || 'all'}
            options={durationOptions}
            onChange={(value) => onChange({ ...filters, duration: value })}
            lang={lang}
          />

          <FilterDropdown
            label={lang === 'fa' ? 'قیمت' : lang === 'ar' ? 'السعر' : 'Price'}
            value={filters.price || 'all'}
            options={priceOptions}
            onChange={(value) => onChange({ ...filters, price: value })}
            lang={lang}
          />

          <FilterDropdown
            label={lang === 'fa' ? 'نوع تور' : lang === 'ar' ? 'نوع الرحلة' : 'Tour Type'}
            value={filters.tourType || 'all'}
            options={tourTypeOptions}
            onChange={(value) => onChange({ ...filters, tourType: value })}
            lang={lang}
            icon={Users}
          />

          <div className="w-px self-stretch bg-border/40 mx-1 hidden sm:block" />

          <FilterDropdown
            label={lang === 'fa' ? 'مرتب‌سازی' : lang === 'ar' ? 'ترتيب' : 'Sort by'}
            value={sortBy || 'recommended'}
            options={sortOptions}
            onChange={(value) => onSortChange?.(value)}
            lang={lang}
            inactiveKey="recommended"
          />

          <div className="flex items-center gap-3 ms-auto self-center px-2">
            <span className="font-body text-sm text-muted-foreground whitespace-nowrap inline-flex items-center gap-1">
              <span className="text-accent font-bold text-2xl">{resultCount}</span>
              {lang === 'fa' ? ' تور' : lang === 'ar' ? ' رحلة' : ' Tours'}
            </span>

            {hasActive && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-body border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
              >
                <X className="w-3 h-3" />
                {lang === 'fa' ? 'پاک کردن همه' : lang === 'ar' ? 'مسح الكل' : 'Clear all'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="text-accent/30 text-xs">◆</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </div>
  );
}
