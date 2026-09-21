import {
  useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { Clock,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { useNavigate } from 'react-router-dom';
import { useArticles } from '@/hooks/useSupabase';

export default function Blog() {
  const { t, dir, lang } = useI18n();
  const navigate = useNavigate();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const { articles: allArticles, loading } = useArticles({});

  // Every featured article gets the prominent treatment. Regular articles never
  // become a hero as a fallback, so the page cannot promote one at random.
  const featuredArticles = allArticles.filter((article) => article.is_featured);
  const gridArticles = allArticles.filter((article) => !article.is_featured);

  const localized = (article, field) =>
    article[`${field}_${lang}`] || article[`${field}_en`] || article[`${field}_fa`] || '';

  const dateOf = (article) =>
    article.created_at
      ? new Date(article.created_at).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-SA' : 'en-US')
      : '';

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
            {t('blog_title')}
          </h1>
          <p className="font-body text-muted-foreground max-w-xl text-lg">
            {t('blog_subtitle')}
          </p>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && allArticles.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-border flex items-center justify-center">
              <span className="text-3xl text-accent/40">✦</span>
            </div>
            <p className="font-heading text-2xl text-muted-foreground font-light">
              {lang === 'fa' ? 'مقاله‌ای منتشر نشده است.' : lang === 'ar' ? 'لا توجد مقالات منشورة.' : 'No articles published yet.'}
            </p>
          </div>
        )}

        {/* Featured articles */}
        {!loading && featuredArticles.length > 0 && (
          <section className="mb-16" aria-label={lang === 'fa' ? 'مقالات ویژه' : lang === 'ar' ? 'المقالات المميزة' : 'Featured articles'}>
            <div className="space-y-12">
              {featuredArticles.map((article, index) => (
                <motion.article
                  key={article.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/blog/${article.slug}`, { state: { article } })}
                  className="group grid grid-cols-1 lg:grid-cols-2 gap-8 cursor-pointer"
                >
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                    {article.image_url ? (
                      <img decoding="async" loading="lazy"
                        src={article.image_url}
                        alt={localized(article, 'title')}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 text-6xl">
                        ✦
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="font-body text-xs font-semibold text-accent uppercase tracking-wider mb-3">
                      ★ {lang === 'fa' ? 'ویژه' : lang === 'ar' ? 'مميز' : 'Featured'}
                      {article.category && ` · ${article.category}`}
                    </span>
                    <h2 className="font-heading text-3xl lg:text-4xl font-medium text-foreground mb-4 group-hover:text-accent transition-colors">
                      {localized(article, 'title')}
                    </h2>
                    {localized(article, 'excerpt') && (
                      <p className="font-body text-foreground/70 leading-relaxed mb-6">
                        {localized(article, 'excerpt')}
                      </p>
                    )}
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {dateOf(article)}
                      </span>
                      <span className="flex items-center gap-1.5 font-body text-sm text-accent font-medium">
                        {t('blog_read_more')}
                        <Arrow className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        )}

        {/* Grid */}
        {!loading && gridArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridArticles.map((article, i) => (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/blog/${article.slug}`, { state: { article } })}
                className="group cursor-pointer"
              >
                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 bg-muted">
                  {article.image_url ? (
                    <img decoding="async" loading="lazy"
                      src={article.image_url}
                      alt={localized(article, 'title')}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 text-4xl">
                      ✦
                    </div>
                  )}
                </div>
                {article.category && (
                  <span className="font-body text-xs font-medium text-accent uppercase tracking-wider">
                    {article.category}
                  </span>
                )}
                <h3 className="font-heading text-xl font-medium text-foreground mt-2 mb-2 group-hover:text-accent transition-colors">
                  {localized(article, 'title')}
                </h3>
                {localized(article, 'excerpt') && (
                  <p className="font-body text-sm text-foreground/60 leading-relaxed mb-3 line-clamp-3">
                    {localized(article, 'excerpt')}
                  </p>
                )}
                <span className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {dateOf(article)}
                </span>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
