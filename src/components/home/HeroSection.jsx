import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { ArrowRight, ArrowLeft, Sparkles, Star, MapPin, Search } from 'lucide-react';
import { iranianCities as IRAN_CITIES } from '@/data/iranianCities';
import { preloadRoute } from '@/lib/route-loaders';

const HERO_IMAGES = [
  "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/7a7bd2ab5_generated_847e20ff.png",
  "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/67ecc93d7_generated_d105795a.png",
  "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/edfc38152_generated_aa7676e0.png",
];

const STATS = [
  { en: "500+", fa: "۵۰۰+", ar: "500+" , label: { en: "Happy Travelers", fa: "مسافر راضی", ar: "مسافر سعيد" }},
  { en: "40+", fa: "۴۰+", ar: "40+", label: { en: "Curated Tours", fa: "تور انتخابی", ar: "جولة منتقاة" }},
  { en: "15+", fa: "۱۵+", ar: "15+", label: { en: "Expert Guides", fa: "راهنمای متخصص", ar: "مرشد خبير" }},
];

function shouldRunHeroCarousel() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = connection?.effectiveType || '';
  const constrainedNetwork = connection?.saveData || effectiveType === 'slow-2g' || effectiveType === '2g';
  const mobileViewport = window.matchMedia('(max-width: 767px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !constrainedNetwork && !mobileViewport && !reducedMotion;
}

export default function HeroSection() {
  const { t, dir, lang } = useI18n();
  const navigate = useNavigate();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const [activeImg, setActiveImg] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [carouselEnabled] = useState(shouldRunHeroCarousel);
  const searchRef = useRef(null);
  const prefetchedImages = useRef(new Set([HERO_IMAGES[0]]));

  const filteredCities = searchValue.length >= 1
    ? IRAN_CITIES.filter(c => c.toLowerCase().includes(searchValue.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    if (!carouselEnabled) return undefined;
    const interval = setInterval(() => {
      setActiveImg(i => (i + 1) % HERO_IMAGES.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [carouselEnabled]);

  useEffect(() => {
    if (!carouselEnabled) return undefined;

    const preloadNext = () => {
      const nextImage = HERO_IMAGES[(activeImg + 1) % HERO_IMAGES.length];
      if (prefetchedImages.current.has(nextImage)) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = nextImage;
      prefetchedImages.current.add(nextImage);
    };

    const timeoutId = window.setTimeout(preloadNext, activeImg === 0 ? 1800 : 300);
    return () => window.clearTimeout(timeoutId);
  }, [activeImg, carouselEnabled]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <section dir={dir} className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background image. Auto-rotation/preload is disabled on phones, reduced-motion and constrained networks. */}
      <div
        key={HERO_IMAGES[activeImg]}
        className={`absolute inset-0 ${carouselEnabled ? 'animate-in fade-in duration-700' : ''}`}
      >
        <img
          src={HERO_IMAGES[activeImg]}
          alt=""
          className="w-full h-full object-cover"
          loading={activeImg === 0 ? 'eager' : 'lazy'}
          fetchPriority={activeImg === 0 ? 'high' : 'auto'}
          decoding="async"
        />
      </div>

      {/* Cinematic layered overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy/30 via-navy/20 to-navy/80 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/40 via-transparent to-transparent z-[1]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end flex-1 max-w-7xl mx-auto w-full px-5 sm:px-8 lg:px-10 pb-16 lg:pb-20 pt-28">

        {/* Trust badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3.5 py-1.5">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-2.5 h-2.5 fill-gold text-gold" />
              ))}
            </div>
            <span className="font-body text-[11px] text-white/90 font-medium">
              {t('hero_trust_badge')}
            </span>
          </div>
        </div>

        {/* Main headline */}
        <h1
          className="font-heading text-white mb-6 max-w-4xl text-balance"
          style={{ fontSize: 'clamp(2.6rem, 6.5vw, 6rem)', lineHeight: '1.06', letterSpacing: '-0.02em', wordSpacing: '0.15em' }}
        >
          {t('hero_title')}
        </h1>

        <p className="font-body text-white/70 text-base lg:text-lg leading-relaxed mb-10 max-w-xl">
          {t('hero_subtitle')}
        </p>

        {/* Search bar with autocomplete */}
        <div className="mb-5 relative" ref={searchRef}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchValue.trim()) {
                navigate(`/tours?city=${encodeURIComponent(searchValue.trim())}`);
              }
              setShowSuggestions(false);
            }}
            className="flex items-center gap-3 bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 max-w-lg focus-within:border-gold/50 transition-colors duration-300"
          >
            <MapPin className="w-4 h-4 text-gold flex-shrink-0" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onPointerEnter={() => preloadRoute('/tours')}
              placeholder={
                lang === 'fa' ? 'کدام شهر را رویا می‌بینید؟'
                : lang === 'ar' ? 'أي مدينة تحلم بها؟'
                : 'Which city are you dreaming of?'
              }
              className="flex-1 bg-transparent text-white placeholder-white/45 font-body text-sm outline-none min-w-0"
            />
            <button
              type="submit"
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 hover:bg-accent/80 flex items-center justify-center transition-colors duration-200"
            >
              <Search className="w-3.5 h-3.5 text-white" />
            </button>
          </form>

          {/* Suggestions dropdown */}
          {showSuggestions && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-full max-w-lg bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden z-50 shadow-2xl">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    setSearchValue(city);
                    setShowSuggestions(false);
                    navigate(`/tours?city=${encodeURIComponent(city)}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm font-body text-left"
                >
                  <MapPin className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-4 mb-14 lg:mb-16">
          <Link
            to="/trip-requests"
            onMouseEnter={() => preloadRoute('/trip-requests')}
            onFocus={() => preloadRoute('/trip-requests')}
            className="inline-flex items-center gap-2.5 bg-accent hover:bg-accent/90 text-white px-7 py-3.5 rounded-full font-body font-semibold text-sm uppercase tracking-wide transition-all duration-300 hover:shadow-lg hover:shadow-accent/25 hover:-translate-y-0.5"
          >
            {t('hero_cta_request')}
            <Arrow className="w-4 h-4" />
          </Link>
          <Link
            to="/ai-assistant"
            onMouseEnter={() => preloadRoute('/ai-assistant')}
            onFocus={() => preloadRoute('/ai-assistant')}
            className="relative inline-flex items-center gap-2.5 overflow-hidden bg-gold/20 hover:bg-gold/30 text-gold border border-gold/50 hover:border-gold/80 px-7 py-3.5 rounded-full font-body font-semibold text-sm uppercase tracking-wide transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-gold/25 hover:-translate-y-0.5"
            style={{ isolation: 'isolate' }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)',
                backgroundSize: '250% 100%',
                animation: carouselEnabled ? 'shimmer-sweep 3s ease-in-out infinite' : 'none',
              }}
            />
            <Sparkles className="w-4 h-4 text-gold relative z-10" />
            <span className="relative z-10">
              {lang === 'fa' ? 'با هوش مصنوعی برنامه‌ریزی کن' : lang === 'ar' ? 'خطط مع الذكاء الاصطناعي' : t('hero_cta_ai')}
            </span>
          </Link>
        </div>

        {/* Bottom row: stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-end gap-6">
          <div className="flex items-center gap-6 sm:gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="font-heading text-2xl text-white font-semibold">{stat[lang] || stat.en}</p>
                <p className="font-body text-[11px] text-white/55 uppercase tracking-wider mt-0.5">
                  {stat.label[lang] || stat.label.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Image dots remain available for explicit user-selected loading. */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {HERO_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveImg(i)}
            aria-label={`Show hero image ${i + 1}`}
            className={`rounded-full transition-all duration-500 ${
              i === activeImg ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
