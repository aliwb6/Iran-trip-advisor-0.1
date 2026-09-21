import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n.jsx';
import { supabase } from '@/supabaseClient';

// Single source of truth for the homepage spotlight carousel.
// Slugs match the keys in CityPage.jsx so every active card routes correctly.
export const SPOTLIGHT_CITIES = [
  {
    slug: 'tehran',
    image: '/images/tehran.jpg',
    name: { en: 'Tehran', fa: 'تهران', ar: 'طهران' },
    category: { en: 'Culture', fa: 'فرهنگ', ar: 'الثقافة' },
  },
  {
    slug: 'shiraz',
    image: '/images/shiraz.jpg',
    name: { en: 'Shiraz', fa: 'شیراز', ar: 'شيراز' },
    category: { en: 'History', fa: 'تاریخ', ar: 'التاريخ' },
  },
  {
    slug: 'isfahan',
    image: '/images/isfahan.jpg',
    name: { en: 'Isfahan', fa: 'اصفهان', ar: 'أصفهان' },
    category: { en: 'Architecture', fa: 'معماری', ar: 'العمارة' },
  },
  {
    slug: 'yazd',
    image: '/images/yazd.jpg',
    name: { en: 'Yazd', fa: 'یزد', ar: 'يزد' },
    category: { en: 'Culture', fa: 'فرهنگ', ar: 'الثقافة' },
  },
  {
    slug: 'mashhad',
    image: '/images/mashhad.jpg',
    name: { en: 'Mashhad', fa: 'مشهد', ar: 'مشهد' },
    category: { en: 'Spiritual', fa: 'معنوی', ar: 'روحاني' },
  },
  {
    slug: 'rasht',
    image: '/images/rasht.jpg',
    name: { en: 'Rasht', fa: 'رشت', ar: 'رشت' },
    category: { en: 'Nature', fa: 'طبیعت', ar: 'الطبيعة' },
  },
  {
    slug: 'kerman',
    image: '/images/kerman.jpg',
    name: { en: 'Kerman', fa: 'کرمان', ar: 'كرمان' },
    category: { en: 'History', fa: 'تاریخ', ar: 'التاريخ' },
  },
  {
    slug: 'kashan',
    image: '/images/kashan.jpg',
    name: { en: 'Kashan', fa: 'کاشان', ar: 'كاشان' },
    category: { en: 'Architecture', fa: 'معماری', ar: 'العمارة' },
  },
  {
    slug: 'qom',
    image: '/images/qom.jpg',
    name: { en: 'Qom', fa: 'قم', ar: 'قم' },
    category: { en: 'Spiritual', fa: 'معنوی', ar: 'روحاني' },
  },
  {
    slug: 'tabriz',
    image: '/images/tabriz.jpg',
    name: { en: 'Tabriz', fa: 'تبریز', ar: 'تبريز' },
    category: { en: 'Culture', fa: 'فرهنگ', ar: 'الثقافة' },
  },
  {
    slug: 'kish-island',
    image: '/images/kish island.jpg',
    name: { en: 'Kish Island', fa: 'جزیره کیش', ar: 'جزيرة كيش' },
    category: { en: 'Nature', fa: 'طبیعت', ar: 'الطبيعة' },
  },
  {
    slug: 'qeshm-island',
    image: '/images/qeshm island.jpg',
    name: { en: 'Qeshm Island', fa: 'جزیره قشم', ar: 'جزيرة قشم' },
    category: { en: 'Nature', fa: 'طبیعت', ar: 'الطبيعة' },
  },
  {
    slug: 'hormuz-island',
    image: '/images/Hormuz Island.jpg',
    name: { en: 'Hormuz Island', fa: 'جزیره هرمز', ar: 'جزيرة هرمز' },
    category: { en: 'Nature', fa: 'طبیعت', ar: 'الطبيعة' },
  },
];

const localImageSlug = (image) => image
  .split('/').pop()
  .replace(/\.[^.]+$/, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-');

const responsiveLocalImage = (image, width) =>
  `/images/optimized/${localImageSlug(image)}-${width}.webp`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const cardSpring = {
  type: 'spring',
  stiffness: 150,
  damping: 21,
  mass: 0.85,
};

export default function SpotlightDestinations() {
  const { lang, dir } = useI18n();
  const reduceMotion = useReducedMotion();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const [activeIndex, setActiveIndex] = useState(2);
  const [isInteracting, setIsInteracting] = useState(false);
  const [layout, setLayout] = useState({ slideWidth: 320, cardWidth: 292, cardHeight: 380 });

  const { data: destinations = SPOTLIGHT_CITIES } = useQuery({
    queryKey: ['homepage-destinations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_destinations')
        .select('id, slug, image_url, name_en, name_fa, name_ar, category_en, category_fa, category_ar, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error || !data?.length) return SPOTLIGHT_CITIES;
      return data.map((item) => ({
        id: item.id,
        slug: item.slug,
        image: item.image_url,
        name: { en: item.name_en, fa: item.name_fa || item.name_en, ar: item.name_ar || item.name_en },
        category: {
          en: item.category_en || '',
          fa: item.category_fa || item.category_en || '',
          ar: item.category_ar || item.category_en || '',
        },
      }));
    },
    placeholderData: SPOTLIGHT_CITIES,
  });

  useEffect(() => {
    const updateLayout = () => {
      if (window.innerWidth < 480) {
        setLayout({ slideWidth: 258, cardWidth: 238, cardHeight: 330 });
      } else if (window.innerWidth < 768) {
        setLayout({ slideWidth: 286, cardWidth: 262, cardHeight: 350 });
      } else if (window.innerWidth < 1024) {
        setLayout({ slideWidth: 300, cardWidth: 274, cardHeight: 365 });
      } else {
        setLayout({ slideWidth: 320, cardWidth: 292, cardHeight: 380 });
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => clamp(current, 0, Math.max(0, destinations.length - 1)));
  }, [destinations.length]);

  const lastIndex = Math.max(0, destinations.length - 1);
  const canGoPrevious = activeIndex > 0;
  const canGoNext = activeIndex < lastIndex;
  const goPrevious = () => setActiveIndex((current) => Math.max(0, current - 1));
  const goNext = () => setActiveIndex((current) => Math.min(lastIndex, current + 1));

  useEffect(() => {
    if (isInteracting || reduceMotion || destinations.length < 2) return undefined;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => current >= lastIndex ? 0 : current + 1);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [destinations.length, isInteracting, lastIndex, reduceMotion]);

  const heading = {
    eyebrow: lang === 'fa' ? 'مقصدها' : lang === 'ar' ? 'الوجهات' : 'Destinations',
    title: lang === 'fa' ? 'شگفتی‌های پنهان ایران را کشف کن' : lang === 'ar' ? 'اكتشف عجائب إيران الخفية' : "Explore Iran's Hidden Wonders",
    sub: lang === 'fa'
      ? 'از معماری کهن تا طبیعت بکر — ایران را شهر به شهر کشف کن.'
      : lang === 'ar'
        ? 'من العمارة العريقة إلى الطبيعة البكر — اكتشف إيران مدينةً بمدينة.'
        : 'From ancient architecture to untouched nature — discover Iran city by city',
    explore: lang === 'fa' ? 'کاوش' : lang === 'ar' ? 'استكشف' : 'Explore',
    previous: lang === 'fa' ? 'مقصد قبلی' : lang === 'ar' ? 'الوجهة السابقة' : 'Previous destination',
    next: lang === 'fa' ? 'مقصد بعدی' : lang === 'ar' ? 'الوجهة التالية' : 'Next destination',
  };

  const handleCardClick = (event, index) => {
    if (index === activeIndex) return;
    event.preventDefault();
    setActiveIndex(index);
  };

  const handleDragEnd = (_, info) => {
    const swipe = info.offset.x + info.velocity.x * 0.12;
    if (swipe < -45) goNext();
    if (swipe > 45) goPrevious();
  };

  const handleCarouselKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      dir === 'rtl' ? goNext() : goPrevious();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      dir === 'rtl' ? goPrevious() : goNext();
    }
  };

  const releaseFocusPause = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
  };

  return (
    <section dir={dir} className="section-gap overflow-hidden bg-background">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 text-center sm:mb-10 lg:mb-12"
        >
          <p className="mb-3 flex items-center justify-center gap-3 font-body text-xs uppercase tracking-[0.25em] text-gold">
            <span className="block h-px w-8 bg-gold/60" />
            {heading.eyebrow}
            <span className="block h-px w-8 bg-gold/60" />
          </p>
          <h2 className="mb-3 font-heading text-display-sm text-foreground">{heading.title}</h2>
          <p className="mx-auto max-w-xl font-body leading-relaxed text-muted-foreground">{heading.sub}</p>
        </motion.div>

        <div
          className="relative flex min-h-[28rem] select-none flex-col items-center justify-center sm:min-h-[31rem]"
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setIsInteracting(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setIsInteracting(false);
          }}
          onFocusCapture={() => setIsInteracting(true)}
          onBlurCapture={releaseFocusPause}
          onKeyDown={handleCarouselKeyDown}
          aria-roledescription="carousel"
          aria-label={heading.title}
        >
          <div
            className="relative flex touch-pan-y items-center justify-start overflow-visible"
            style={{ width: layout.slideWidth, height: layout.cardHeight + 52 }}
          >
            <motion.div
              className="flex w-fit items-center"
              animate={{ x: -activeIndex * layout.slideWidth }}
              transition={reduceMotion ? { duration: 0 } : cardSpring}
              drag={destinations.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              dragMomentum={false}
              onDragStart={() => setIsInteracting(true)}
              onDragEnd={handleDragEnd}
            >
              {destinations.map((city, index) => {
                const isActive = activeIndex === index;
                const distance = index - activeIndex;
                const visibleDistance = clamp(distance, -3, 3);
                const cityName = city.name[lang] || city.name.en;
                const cityCategory = city.category[lang] || city.category.en;
                const countryLabel = lang === 'fa' ? 'ایران' : lang === 'ar' ? 'إيران' : 'Iran';
                const localImage = city.image.startsWith('/images/');
                const expanded = isInteracting && !reduceMotion;

                return (
                  <motion.div
                    key={city.id || city.slug}
                    className="flex shrink-0 items-center justify-center will-change-transform"
                    style={{ width: layout.slideWidth, zIndex: 20 - Math.abs(distance) }}
                    animate={{
                      rotate: expanded ? visibleDistance * 16 : visibleDistance * 4,
                      scale: isActive ? 1.045 : expanded ? 0.7 : 0.84,
                      y: expanded ? visibleDistance * 20 : 0,
                      opacity: Math.abs(distance) > 3 ? 0 : isActive ? 1 : 0.88,
                    }}
                    transition={reduceMotion ? { duration: 0 } : cardSpring}
                    aria-hidden={Math.abs(distance) > 2}
                  >
                    <Link
                      to={`/destinations/${city.slug}`}
                      onClick={(event) => handleCardClick(event, index)}
                      tabIndex={Math.abs(distance) <= 2 ? 0 : -1}
                      aria-current={isActive ? 'true' : undefined}
                      aria-label={`${cityName} — ${isActive ? heading.explore : `${index + 1} / ${destinations.length}`}`}
                      className="group relative block overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl outline-none transition-[border-color,box-shadow] duration-300 hover:border-gold/50 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                      style={{ width: layout.cardWidth, height: layout.cardHeight }}
                    >
                      <img
                        decoding="async"
                        src={localImage ? responsiveLocalImage(city.image, 640) : city.image}
                        srcSet={localImage ? `${responsiveLocalImage(city.image, 640)} 640w, ${responsiveLocalImage(city.image, 1600)} 1600w` : undefined}
                        sizes="(max-width: 767px) 75vw, 292px"
                        alt={cityName}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />

                      <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                        <span className="h-1 w-1 rounded-full bg-gold" />
                        {cityCategory}
                      </span>

                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/70">
                          <MapPin className="h-3 w-3 text-gold" />
                          {countryLabel}
                        </div>
                        <h3 className="mb-3 font-heading text-2xl font-semibold leading-tight text-white transition-colors group-hover:text-gold sm:text-3xl">
                          {cityName}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-all duration-300 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'}`}>
                          {heading.explore}
                          <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <div className="z-30 mt-2 flex items-center justify-center gap-2 rounded-full border border-border/60 bg-card/85 px-2 py-1.5 text-muted-foreground shadow-lg backdrop-blur-md sm:mt-4">
            <button
              type="button"
              onClick={goPrevious}
              disabled={!canGoPrevious}
              className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-gold/10 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={heading.previous}
            >
              {dir === 'rtl' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <div className="flex items-center justify-center gap-1" aria-label={`${activeIndex + 1} / ${destinations.length}`}>
              {destinations.map((city, index) => (
                <button
                  key={city.id || city.slug}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === index ? 'w-5 bg-gold' : 'w-1.5 bg-muted-foreground/30 hover:bg-gold/50'}`}
                  aria-label={`${city.name[lang] || city.name.en}: ${index + 1}`}
                  aria-current={activeIndex === index ? 'true' : undefined}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-gold/10 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={heading.next}
            >
              {dir === 'rtl' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
