import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { MapPin, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { selectPublicTours } from '@/lib/publicTours';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1564960723835-2898c9df9297?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1574952561422-b4f6d806e5e9?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1519810755548-39cd217da494?w=600&h=400&fit=crop',
];

export default function PopularPackages() {
  const { t, dir, lang } = useI18n();
  const { data: tours = [], isLoading: loading } = useQuery({
    queryKey: ['homepage-popular-tours'],
    queryFn: async () => {
        const { data, error } = await selectPublicTours(supabase, 'id, slug, image_url, gallery, title, cities, location, city, duration, price')
          .eq('is_platform_tour', true)
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw error;
        return data || [];
    },
  });

  const cityList = (tour) => {
    if (Array.isArray(tour.cities) && tour.cities.length) return tour.cities.join(' · ');
    return tour.location || tour.city || '';
  };

  return (
    <section dir={dir} className="section-gap bg-sand/30">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Section header — matches the eyebrow + title + subtitle style on /tours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 lg:mb-14"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-accent text-xl">❖</span>
            <span className="font-body text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {lang === 'fa' ? 'پکیج‌های سفر' : lang === 'ar' ? 'باقات السفر' : 'Tour Packages'}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>
          <h2 className="font-heading text-display-sm text-foreground mb-3">{t('packages_title')}</h2>
          <p className="font-body text-muted-foreground max-w-xl text-base leading-relaxed">{t('packages_subtitle')}</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-accent animate-spin" />
          </div>
        ) : tours.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-body text-muted-foreground text-sm">
              {t('popular_empty')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {tours.map((tour, i) => {
              const img = tour.image_url || (Array.isArray(tour.gallery) && tour.gallery[0]) || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length];
              const href = tour.slug ? `/tours/${tour.slug}` : `/tours`;
              return (
                <motion.div
                  key={tour.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    to={href}
                    className="group relative block bg-card rounded-3xl overflow-hidden border border-border/50 hover:border-accent/30 hover:shadow-xl transition-all duration-500"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img decoding="async" loading="lazy"
                        src={img}
                        alt={tour.title || ''}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        <span>{cityList(tour)}</span>
                      </div>
                      <h3 className="font-heading text-xl sm:text-2xl font-medium text-foreground mb-3 group-hover:text-accent transition-colors">
                        {tour.title || ''}
                      </h3>
                      <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {tour.duration ? `${tour.duration} ${t('package_duration')}` : '—'}
                        </div>
                        {tour.price != null && (
                          <span className="font-body text-sm text-accent font-semibold">
                            {t('price_from')}
                            ${Number(tour.price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
