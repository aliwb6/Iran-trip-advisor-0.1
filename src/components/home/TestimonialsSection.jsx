import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { useIsMobile } from '@/hooks/use-mobile.jsx';

const testimonials = [
  {
    name: "Sarah Mitchell",
    origin: { en: "London, UK", fa: "لندن، انگلستان", ar: "لندن، المملكة المتحدة" },
    rating: 5,
    text: {
      en: "Iran absolutely blew me away. The level of hospitality, the architecture, the food — nothing could have prepared me for how extraordinary this country is. Iran Soul Tours made every moment seamless.",
      fa: "ایران مرا کاملاً شگفت‌زده کرد. سطح مهمان‌نوازی، معماری، غذا — هیچ چیز نمی‌توانست مرا برای این عظمت آماده کند.",
      ar: "أذهلتني إيران تمامًا. مستوى الضيافة والمعمار والطعام — لم أكن أتخيل أن تكون هذه الدولة بهذه الروعة."
    },
    tour: { en: "Persian Jewels — 10 days", fa: "جواهرات ایران — ۱۰ روز", ar: "جواهر فارس — 10 أيام" },
  },
  {
    name: "Khaled Al-Rashid",
    origin: { en: "Dubai, UAE", fa: "دبی، امارات", ar: "دبي، الإمارات" },
    rating: 5,
    text: {
      en: "As an Arab traveler, I felt completely at home. The guides spoke Arabic, the cultural depth was incredible. Seeing Persepolis at sunrise is something I'll carry forever.",
      fa: "به عنوان یک مسافر عرب، کاملاً احساس خانه کردم. راهنماها عربی صحبت می‌کردند، عمق فرهنگی شگفت‌انگیز بود.",
      ar: "كمسافر عربي شعرت بأنني في وطني. المرشدون يتحدثون العربية والعمق الثقافي كان رائعاً."
    },
    tour: { en: "Ancient Persia — 9 days", fa: "ایران باستان — ۹ روز", ar: "بلاد فارس القديمة — 9 أيام" },
  },
  {
    name: "Yuki Tanaka",
    origin: { en: "Tokyo, Japan", fa: "توکیو، ژاپن", ar: "طوكيو، اليابان" },
    rating: 5,
    text: {
      en: "The photography tour was a dream. Every morning had golden light, every guide knew the perfect angle. The Lut Desert under the stars was the most beautiful thing I've ever photographed.",
      fa: "تور عکاسی یک رویا بود. هر صبح نور طلایی داشت، هر راهنما زاویه کامل را می‌دانست.",
      ar: "كان جولة التصوير حلمًا. كل صباح كان يحمل ضوءاً ذهبياً ومرشدون يعرفون الزاوية المثالية."
    },
    tour: { en: "Photographer's Dream — 11 days", fa: "رویای عکاس — ۱۱ روز", ar: "حلم المصور — 11 أيام" },
  },
];

const springTransition = {
  type: 'spring',
  stiffness: 180,
  damping: 20,
  mass: 0.8,
};

function ReviewCard({ review, lang, index, isExpanded, isMobile, reduceMotion }) {
  const distance = index - (testimonials.length - 1) / 2;
  const spread = isMobile ? 34 : 240;
  const arc = isMobile ? 7 : 14;
  const isCenter = distance === 0;

  const expandedTransform = {
    rotate: distance * arc,
    x: distance * spread,
    y: isCenter ? -18 : Math.abs(distance) * (isMobile ? 18 : 36),
    scale: isCenter ? 1.035 : 1,
  };
  const stackedTransform = {
    rotate: distance * (isMobile ? 1.5 : 2.25),
    x: 0,
    y: Math.abs(distance) * 7,
    scale: 1,
  };

  return (
    <motion.article
      initial={false}
      animate={isExpanded ? expandedTransform : stackedTransform}
      transition={reduceMotion ? { duration: 0 } : springTransition}
      style={{
        zIndex: isCenter ? 3 : 2,
        originX: 0.5,
        originY: 1,
      }}
      tabIndex={0}
      className="absolute inset-0 flex min-h-[21rem] w-[min(19rem,calc(100vw-3rem))] cursor-pointer flex-col rounded-3xl border border-border/70 bg-card p-6 shadow-warm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:p-7"
      aria-label={`${review.name} testimonial`}
    >
      <Quote className="absolute end-5 top-5 h-8 w-8 text-accent/10" aria-hidden="true" />

      <div className="mb-5 flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
        {[...Array(review.rating)].map((_, starIndex) => (
          <Star key={starIndex} className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
        ))}
      </div>

      <blockquote className="mb-6 flex-1 font-body text-sm leading-relaxed text-foreground/75 italic sm:text-base">
        “{review.text[lang] || review.text.en}”
      </blockquote>

      <footer className="space-y-3">
        <div>
          <p className="font-heading text-base font-semibold text-foreground">{review.name}</p>
          <p className="font-body text-xs text-muted-foreground">{review.origin[lang] || review.origin.en}</p>
        </div>
        <span className="block w-fit max-w-full rounded-full border border-accent/15 bg-accent/8 px-3 py-1 font-body text-xs text-accent/70">
          {review.tour[lang] || review.tour.en}
        </span>
      </footer>
    </motion.article>
  );
}

function TestimonialStampArc({ lang }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();

  const closeWhenFocusLeaves = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsExpanded(false);
  };

  return (
    <div
      className="relative mx-auto flex h-[23rem] w-full max-w-5xl items-start justify-center pt-4 sm:h-[28rem] sm:pt-8"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setIsExpanded(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setIsExpanded(false);
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') setIsExpanded((current) => !current);
      }}
      onFocusCapture={() => setIsExpanded(true)}
      onBlurCapture={closeWhenFocusLeaves}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsExpanded(false);
      }}
      aria-label="Tourist review cards"
      data-expanded={isExpanded}
    >
      <span className="sr-only">
        Focus, hover, or tap the review stack to fan out all traveler stories.
      </span>
      <div className="relative h-[21rem] w-[min(19rem,calc(100vw-3rem))]">
        {testimonials.map((review, index) => (
          <ReviewCard
            key={review.name}
            review={review}
            lang={lang}
            index={index}
            isExpanded={isExpanded}
            isMobile={isMobile}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const { t, dir, lang } = useI18n();

  return (
    <section dir={dir} className="section-gap overflow-clip bg-sand/30">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-7 text-center sm:mb-10"
        >
          <p className="mb-3 flex items-center justify-center gap-2 font-body text-xs uppercase tracking-[0.2em] text-accent">
            <span className="block h-px w-6 bg-accent" />
            {t('testimonials_eyebrow')}
            <span className="block h-px w-6 bg-accent" />
          </p>
          <h2 className="font-heading text-display-sm text-foreground">{t('testimonials_title')}</h2>
          <p className="mt-2 font-body text-muted-foreground">{t('testimonials_subtitle')}</p>
        </motion.div>

        <TestimonialStampArc lang={lang} />
      </div>
    </section>
  );
}
