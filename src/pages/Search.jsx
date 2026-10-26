import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useSearchTours } from '@/hooks/useSupabase';
import { TourCardSkeleton } from '@/components/ui/Skeletons';
import { useEffect, useState } from 'react';

export default function SearchPage() {
  const { t, dir, lang } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const initialQuery = searchParams.get('q') || '';
  const initialCity = searchParams.get('city') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);

  const searchTerm = query || city;
  const { results, loading, error } = useSearchTours(searchTerm);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
    if (initialCity) setCity(initialCity);
  }, [initialQuery, initialCity]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleCityClick = (cityName) => {
    navigate(`/search?city=${encodeURIComponent(cityName)}`);
  };

  return (
    <div dir={dir} className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light text-foreground mb-6">
            {lang === 'fa' ? 'جستجو' : lang === 'ar' ? 'البحث' : 'Search'}
          </h1>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="relative max-w-2xl">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${dir === 'rtl' ? 'end-4' : 'start-4'}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('hero_search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pe-14 ps-4' : 'ps-14 pe-4'} py-4 bg-card rounded-2xl border border-border/50 focus:border-accent/50 outline-none transition-colors font-body text-lg`}
            />
          </form>

          {/* Active Filters */}
          {(query || city) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {query && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-body">
                  {query}
                  <button onClick={() => { setQuery(''); navigate('/search'); }} className="hover:text-white">×</button>
                </span>
              )}
              {city && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-body">
                  <MapPin className="w-3.5 h-3.5" />
                  {city}
                  <button onClick={() => { setCity(''); navigate('/search'); }} className="hover:text-white">×</button>
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Results */}
        <div className="mb-8">
          <p className="font-body text-sm text-muted-foreground">
            {loading 
              ? (lang === 'fa' ? 'در حال جستجو...' : lang === 'ar' ? 'جار البحث...' : 'Searching...')
              : lang === 'ar' ? `عدد النتائج: ${results.length}` : `${results.length} ${lang === 'fa' ? 'نتیجه یافت شد' : 'results found'}`
            }
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <TourCardSkeleton />
            <TourCardSkeleton />
            <TourCardSkeleton />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="font-body text-destructive">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-border flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-2xl text-foreground mb-2">
              {lang === 'fa' ? 'نتیجه‌ای یافت نشد' : lang === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found'}
            </h2>
            <p className="font-body text-muted-foreground">
              {lang === 'fa' ? 'لطفاً عبارت دیگری را امتحان کنید' : lang === 'ar' ? 'يرجى تجربة مصطلح مختلف' : 'Try a different search term'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {results.map((tour, i) => (
              <motion.div
                key={tour.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/tours/${tour.slug}`)}
                className="group flex gap-6 p-4 rounded-2xl border border-border/50 bg-card hover:border-accent/30 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="w-40 h-32 sm:w-48 sm:h-36 rounded-xl overflow-hidden shrink-0">
                  <img decoding="async" loading="lazy"
                    src={tour.image_url || tour.cover_image || "https://images.unsplash.com/photo-1564960723835-2898c9df9297?w=400&h=300&fit=crop"}
                    alt={tour.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <h3 className="font-heading text-lg font-medium text-foreground group-hover:text-accent transition-colors truncate">
                    {tour.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {tour.location || tour.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {tour.duration} {t('package_duration')}
                    </span>
                  </div>
                  <p className="font-body text-sm text-foreground/70 mt-2 line-clamp-2">
                    {tour.description?.substring(0, 100)}...
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-heading text-lg font-semibold text-accent">
                      ${tour.price}
                    </span>
                    <Arrow className={`w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Quick Filters */}
        <section className="mt-16 pt-8 border-t border-border/50">
          <h2 className="font-heading text-xl font-semibold text-foreground mb-6">
            {lang === 'fa' ? 'جستجوی سریع' : lang === 'ar' ? 'بحث سريع' : 'Quick Search'}
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Isfahan', labelFa: 'اصفهان', labelAr: 'أصفهان' },
              { label: 'Shiraz', labelFa: 'شیراز', labelAr: 'شيراز' },
              { label: 'Yazd', labelFa: 'یزد', labelAr: 'يزد' },
              { label: 'Tehran', labelFa: 'تهران', labelAr: 'طهران' },
              { label: 'Desert', labelFa: 'کویر', labelAr: 'الصحراء' },
              { label: 'Historical', labelFa: 'تاریخی', labelAr: 'تاريخي' },
            ].map((filter) => (
              <button
                key={filter.label}
                onClick={() => handleCityClick(filter.label)}
                className="px-4 py-2 rounded-full border border-border/50 bg-card text-sm font-body hover:border-accent/50 hover:text-accent transition-colors"
              >
                {lang === 'fa' ? filter.labelFa : lang === 'ar' ? filter.labelAr : filter.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
