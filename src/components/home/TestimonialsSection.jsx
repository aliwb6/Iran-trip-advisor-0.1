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
      fa: "ایران واقعاً شگفت‌زده‌ام کرد. مهمان‌نوازی، معماری و غذا فراتر از تصورم بود؛ هیچ‌چیز مرا برای زیبایی خارق‌العادهٔ این کشور آماده نکرده بود. Iran Soul Tours کاری کرد که تمام لحظه‌های سفر بی‌دردسر بگذرد.",
      ar: "أذهلتني إيران حقًا. كرم الضيافة والعمارة والطعام؛ لم يكن بوسعي تخيّل مدى روعة هذا البلد. وجعلت Iran Soul Tours كل لحظة من الرحلة تسير بسلاسة."
    },
    tour: { en: "Persian Jewels — 10 days", fa: "گوهرهای ایران — ۱۰ روز", ar: "جواهر بلاد فارس — ١٠ أيام" },
  },
  {
    name: "Khaled Al-Rashid",
    origin: { en: "Dubai, UAE", fa: "دبی، امارات", ar: "دبي، الإمارات" },
    rating: 5,
    text: {
      en: "As an Arab traveler, I felt completely at home. The guides spoke Arabic, the cultural depth was incredible. Seeing Persepolis at sunrise is something I'll carry forever.",
      fa: "به‌عنوان یک مسافر عرب، کاملاً احساس می‌کردم در خانهٔ خودم هستم. راهنماها عربی صحبت می‌کردند و ژرفای فرهنگ ایران شگفت‌انگیز بود. تماشای تخت جمشید هنگام طلوع آفتاب خاطره‌ای است که همیشه با من می‌ماند.",
      ar: "بوصفي مسافرًا عربيًا، شعرت وكأنني في بيتي. كان المرشدون يتحدثون العربية، وكان عمق الثقافة مدهشًا. ستبقى رؤية برسبوليس عند شروق الشمس ذكرى ترافقني دائمًا."
    },
    tour: { en: "Ancient Persia — 9 days", fa: "ایران باستان — ۹ روز", ar: "بلاد فارس القديمة — ٩ أيام" },
  },
  {
    name: "Yuki Tanaka",
    origin: { en: "Tokyo, Japan", fa: "توکیو، ژاپن", ar: "طوكيو، اليابان" },
    rating: 5,
    text: {
      en: "The photography tour was a dream. Every morning had golden light, every guide knew the perfect angle. The Lut Desert under the stars was the most beautiful thing I've ever photographed.",
      fa: "تور عکاسی مثل یک رؤیا بود. هر صبح نور طلایی زیبایی داشت و راهنماها بهترین زاویه‌ها را می‌شناختند. آسمان پرستارهٔ کویر لوت زیباترین منظره‌ای بود که تا به حال عکاسی کرده‌ام.",
      ar: "كانت جولة التصوير حلمًا. حمل كل صباح ضوءًا ذهبيًا، وكان كل مرشد يعرف الزاوية المثالية. وكانت صحراء لوت تحت النجوم أجمل مشهد التقطت له صورة في حياتي."
    },
    tour: { en: "Photographer's Dream — 11 days", fa: "رؤیای عکاس — ۱۱ روز", ar: "حلم المصوّر — ١١ يومًا" },
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
