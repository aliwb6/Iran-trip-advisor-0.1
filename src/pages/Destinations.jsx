import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDestinations } from '@/hooks/useSupabase';
import { DestinationsSkeleton } from '@/components/ui/Skeletons';

const DESTINATION_IMAGES = {
  isfahan: "https://images.unsplash.com/photo-1564960723835-2898c9df9297?w=600&h=600&fit=crop",
  shiraz: "https://images.unsplash.com/photo-1574952561422-b4f6d806e5e9?w=600&h=600&fit=crop",
  tehran: "https://images.unsplash.com/photo-1519810755548-39cd217da494?w=600&h=600&fit=crop",
  yazd: "https://images.unsplash.com/photo-1555532538-dcdbd01d3738?w=600&h=600&fit=crop",
  tabriz: "https://images.unsplash.com/photo-1569388438009-1c2c5a1b4e5f?w=600&h=600&fit=crop",
  kerman: "https://images.unsplash.com/photo-1502082553048-f009c37129b8?w=600&h=600&fit=crop",
  rashrasht: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop",
  kashan: "https://images.unsplash.com/photo-1597927667696-1da4e77a6e5e?w=600&h=600&fit=crop",
};

const CITY_IMAGE_MAP = {
  isfahan: DESTINATION_IMAGES.isfahan,
  shiraz: DESTINATION_IMAGES.tehran,
  tehran: DESTINATION_IMAGES.tehran,
  yazd: DESTINATION_IMAGES.yazd,
  tabriz: DESTINATION_IMAGES.tabriz,
  kerman: DESTINATION_IMAGES.kerman,
  rashrasht: DESTINATION_IMAGES.rashrasht,
  kashan: DESTINATION_IMAGES.kashan,
};

export default function Destinations() {
  const { dir, lang } = useI18n();
  const navigate = useNavigate();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const { destinations, loading, error } = useDestinations();

  const cities = destinations?.cities || [];
  const locations = destinations?.locations || [];

  const allDestinations = [...new Set([...cities, ...locations])].filter(Boolean);

  return (
    <div dir={dir} className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light text-foreground mb-4">
            {lang === 'fa' ? 'مقاصد' : lang === 'ar' ? 'الوجهات' : 'Destinations'}
          </h1>
          <p className="font-body text-muted-foreground max-w-xl text-lg">
            {lang === 'fa' ? 'شهرها و مناطق زیبای ایران را کشف کنید' : lang === 'ar' ? 'اكتشف مدن ومناطق إيران الجميلة' : 'Discover Iran\'s beautiful cities and regions'}
          </p>
        </motion.div>

        {loading ? (
          <DestinationsSkeleton count={8} />
        ) : error ? (
          <div className="text-center py-16">
            <p className="font-body text-destructive">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 text-sm font-body text-accent hover:underline">
              {lang === 'fa' ? 'تلاش دوباره' : lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}
            </button>
          </div>
        ) : (
          <>
            {/* Cities Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
              {allDestinations.map((city, i) => {
                const cityKey = (city || '').toLowerCase();
                const image = CITY_IMAGE_MAP[cityKey] || DESTINATION_IMAGES.isfahan;
                
                return (
                  <motion.div
                    key={city}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/search?city=${encodeURIComponent(city)}`)}
                    className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer"
                  >
                    <img decoding="async" loading="lazy"
                      src={image}
                      alt={city}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 p-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-white" />
                        <span className="font-heading text-lg text-white">{city}</span>
                        <Arrow className={`w-4 h-4 text-white/60 ms-auto opacity-0 group-hover:opacity-100 transition-all ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Popular Destinations Section */}
            {cities.length > 4 && (
              <section className="mt-16">
                <h2 className="font-heading text-2xl font-semibold text-foreground mb-8">
                  {lang === 'fa' ? 'مقاصد محبوب' : lang === 'ar' ? 'الوجهات الشائعة' : 'Popular Destinations'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cities.slice(0, 6).map((city, i) => (
                    <motion.div
                      key={city}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/search?city=${encodeURIComponent(city)}`)}
                      className="group p-6 rounded-2xl border border-border/50 bg-card hover:border-accent/30 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-accent" />
                        <h3 className="font-heading text-xl font-medium text-foreground group-hover:text-accent transition-colors">
                          {city}
                        </h3>
                      </div>
                      <p className="font-body text-sm text-muted-foreground mt-2">
                        {lang === 'fa' ? 'مشاهده تورها' : lang === 'ar' ? 'عرض الجولات' : 'View tours'}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
