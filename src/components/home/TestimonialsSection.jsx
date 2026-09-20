import { useRef } from 'react';
import { useI18n } from '@/lib/i18n.jsx';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

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

function StackedTestimonial({ review, lang, isLast }) {
  const rowRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: rowRef,
    offset: ['start end', 'end start'],
  });
  const scale = useTransform(scrollYProgress, [0, 0.42], [1.075, 1]);
  const opacity = useTransform(
    scrollYProgress,
    isLast ? [0, 0.42] : [0, 0.42, 0.72, 0.9],
    isLast ? [1, 1] : [1, 1, 1, 0],
  );

  return (
    <div
      ref={rowRef}
      className="relative min-h-[72vh] sm:min-h-[86vh] last:min-h-[72vh] motion-reduce:min-h-0 motion-reduce:pb-6"
    >
      <motion.article
        style={reduceMotion ? undefined : { scale, opacity }}
        className="sticky top-[14vh] sm:top-[18vh] mx-auto w-full max-w-3xl origin-center rounded-3xl border border-border/60 bg-card p-7 shadow-warm sm:p-9 motion-reduce:relative motion-reduce:top-0"
        aria-label={`${review.name} testimonial`}
      >
        <Quote className="absolute end-6 top-6 h-8 w-8 text-accent/10" aria-hidden="true" />

        <div className="mb-5 flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
          {[...Array(review.rating)].map((_, starIndex) => (
            <Star key={starIndex} className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
          ))}
        </div>

        <blockquote className="mb-7 font-body text-base leading-relaxed text-foreground/75 italic sm:text-lg">
          “{review.text[lang] || review.text.en}”
        </blockquote>

        <footer className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-base font-semibold text-foreground">{review.name}</p>
            <p className="font-body text-xs text-muted-foreground">{review.origin[lang] || review.origin.en}</p>
          </div>
          <span className="w-fit rounded-full border border-accent/15 bg-accent/8 px-3 py-1 text-end font-body text-xs text-accent/70">
            {review.tour[lang] || review.tour.en}
          </span>
        </footer>
      </motion.article>
    </div>
  );
}

export default function TestimonialsSection() {
  const { t, dir, lang } = useI18n();

  return (
    <section dir={dir} className="section-gap overflow-clip bg-sand/30">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center sm:mb-14"
        >
          <p className="font-body text-xs uppercase tracking-[0.2em] text-accent mb-3 flex items-center justify-center gap-2">
            <span className="block w-6 h-px bg-accent" />
            {t('testimonials_eyebrow')}
            <span className="block w-6 h-px bg-accent" />
          </p>
          <h2 className="font-heading text-display-sm text-foreground">{t('testimonials_title')}</h2>
          <p className="font-body text-muted-foreground mt-2">{t('testimonials_subtitle')}</p>
        </motion.div>

        <div className="mx-auto max-w-5xl" aria-label={t('testimonials_title')}>
          {testimonials.map((review, index) => (
            <StackedTestimonial
              key={review.name}
              review={review}
              lang={lang}
              isLast={index === testimonials.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
