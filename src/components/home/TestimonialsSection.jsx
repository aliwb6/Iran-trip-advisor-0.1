import { motion, useReducedMotion } from 'motion/react';
import { useI18n } from '@/lib/i18n.jsx';
import ShakeTestimonial from '@/components/shake-testimonial-card';

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

export default function TestimonialsSection() {
  const { t, dir, lang } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <section dir={dir} className="section-gap overflow-clip bg-sand/30">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
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

        <ShakeTestimonial testimonials={testimonials} lang={lang} t={t} />
      </div>
    </section>
  );
}
