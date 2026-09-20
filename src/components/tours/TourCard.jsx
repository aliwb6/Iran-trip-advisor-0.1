import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { transformImage, imgPresets } from '@/lib/imageTransform';

// Persian carpet corner motif as SVG
const CarpetMotif = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2 L12 2 L12 5 L5 5 L5 12 L2 12 Z" fill="currentColor" opacity="0.4" />
    <path d="M2 8 L8 8 L8 2" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
    <circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.3" />
    <path d="M2 2 L5 5 M12 2 L9 5 M2 12 L5 9" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

// Tour rows can arrive in two shapes:
//  - Raw Supabase row: title="…", cities=["Tehran","Isfahan"], price/price_usd
//  - Normalised fixture/wrapped row: title={en,fa,ar}, cities={en:[…], fa:[…], ar:[…]}, priceFrom
// These helpers tolerate both without changing visual output.
const pickText = (val, lang) => {
  if (val == null) return '';
  if (Array.isArray(val)) return val.join(' · ');
  if (typeof val === 'object') {
    const inner = val[lang] ?? val.en;
    if (Array.isArray(inner)) return inner.join(' · ');
    return inner ?? '';
  }
  return String(val);
};

export default function TourCard({ tour, image, index }) {
  const { lang, t } = useI18n();
  const navigate = useNavigate();

  const title = pickText(tour.title, lang);
  const desc = pickText(tour.desc ?? tour.description, lang);
  const cities = pickText(tour.cities, lang) || tour.city || tour.location || '';

  // Price: prefer normalised price_usd, fall back to numeric price, then fixture priceFrom.
  const rawPrice = tour.price_usd ?? tour.price ?? tour.priceFrom ?? null;
  const priceDisplay = rawPrice != null && rawPrice !== ''
    ? `$${Number(rawPrice).toLocaleString()}`
    : null;
  const priceBasis = tour.price_basis === 'per_day'
    ? (lang === 'fa' ? 'در روز' : lang === 'ar' ? 'يومياً' : 'per day')
    : (lang === 'fa' ? 'برای هر نفر' : lang === 'ar' ? 'لكل شخص' : 'per person');

  const handleClick = () => {
    navigate(`/tours/${tour.slug}`);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      onClick={handleClick}
      className="tour-listing-card group relative bg-card rounded-3xl overflow-hidden border border-border/50 hover:border-accent/30 hover:shadow-xl transition-all duration-500 cursor-pointer"
    >
      {/* Persian carpet border top accent */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />

      {/* Carpet corner motifs */}
      <div className="absolute top-3 start-3 w-8 h-8 text-accent/30 z-10 pointer-events-none">
        <CarpetMotif />
      </div>

      {/* Image */}
      <div className="tour-listing-image relative aspect-[16/9] overflow-hidden">
        <img decoding="async" loading="lazy"
          src={transformImage(image, imgPresets.card)}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Overlay gradient with Persian carpet-inspired texture */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Price bottom of image */}
        {priceDisplay && (
          <div className="absolute bottom-4 end-4">
            <span className="font-heading text-white text-xl font-medium">
              {priceDisplay} <span className="text-xs font-body font-normal text-white/80">{priceBasis}</span>
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="tour-listing-content p-6">
        {/* Persian ornament line */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-accent/40 text-xs">❖</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <h2
          className="font-heading text-xl sm:text-2xl font-medium text-foreground mb-1 group-hover:text-accent transition-colors duration-300"
          style={{ WebkitTextStroke: '1px black' }}
        >
          {title}
        </h2>
        <p className="font-body text-xs text-accent mb-3 tracking-wide">{cities}</p>

        <p className="font-body text-sm text-foreground/65 leading-relaxed mb-5 line-clamp-2">{desc}</p>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <div className="flex gap-3 items-center">
            {tour.difficulty && (
              <span className="flex items-center gap-1 text-xs font-body text-muted-foreground">
                <Mountain className="w-3.5 h-3.5 text-accent/60" />
                {t(`difficulty_${tour.difficulty}`)}
              </span>
            )}
          </div>
          <button className="flex items-center gap-1.5 text-sm font-body font-semibold text-accent hover:gap-2.5 transition-all duration-200">
            {t('package_inquiry')}
            <span className="text-lg leading-none">→</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
