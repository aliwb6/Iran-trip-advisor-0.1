import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';

const IMAGES = {
  mosque: "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/7a7bd2ab5_generated_847e20ff.png",
  isfahan: "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/67ecc93d7_generated_d105795a.png",
  persepolis: "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/edfc38152_generated_aa7676e0.png",
  tilework: "https://media.base44.com/images/public/69fddcfab0730c36bda3631e/f18bb9878_generated_9073fec9.png",
};

export default function About() {
  const { t, dir, lang } = useI18n();

  return (
    <div dir={dir} className="pt-24 pb-16">
      {/* Hero */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img decoding="async" loading="lazy"
          src={IMAGES.isfahan}
          alt={lang === 'fa' ? 'نمایی گسترده از معماری تاریخی اصفهان' : lang === 'ar' ? 'مشهد بانورامي للعمارة التاريخية في أصفهان' : "Panoramic view of Isfahan's historic architecture"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 max-w-7xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light text-foreground mb-3"
          >
            {t('about_title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-body text-lg text-muted-foreground"
          >
            {t('about_subtitle')}
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Mission */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-light text-foreground mb-6">
              {t('about_mission')}
            </h2>
            <p className="font-body text-foreground/70 leading-relaxed text-lg">
              {t('about_mission_text')}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden">
              <img decoding="async" loading="lazy"
                src={IMAGES.tilework}
                alt={lang === 'fa' ? 'کاشی‌کاری هندسی ایرانی با رنگ‌های فیروزه‌ای و طلایی' : lang === 'ar' ? 'فسيفساء هندسية فارسية باللونين الفيروزي والذهبي' : 'Intricate Persian geometric tilework mosaic in turquoise and gold'}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -end-4 w-24 h-24 border-2 border-gold/30 rounded-full" />
          </motion.div>
        </div>

        {/* Why Iran */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden">
              <img decoding="async" loading="lazy"
                src={IMAGES.persepolis}
                alt={lang === 'fa' ? 'ویرانه‌های تخت جمشید در نور غروب، با ستون‌های سنگی و آسمان کهربایی' : lang === 'ar' ? 'أطلال برسبوليس عند الغروب، وأعمدتها الحجرية تحت سماء كهرمانية' : 'Ancient Persepolis ruins at golden hour, massive stone columns against amber sky'}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-light text-foreground mb-6">
              {t('about_iran_title')}
            </h2>
            <p className="font-body text-foreground/70 leading-relaxed text-lg">
              {t('about_iran_text')}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
