import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useArticles } from '@/hooks/useSupabase';

export default function Blog() {
  const { t, dir, lang } = useI18n();
  const navigate = useNavigate();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const { articles: featuredArticles, loading: loadingFeatured } = useArticles({ featured: true });
  const { articles: allArticles, loading: loadingAll } = useArticles({});

  const loading = loadingFeatured || loadingAll;

  // hero: first featured article (falls back to first article overall)
  const hero = featuredArticles[0] || allArticles[0] || null;
  // grid: all approved articles except the one shown in hero
  const gridArticles = hero ? allArticles.filter(a => a.id !== hero.id) : allArticles;

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

        {/* Featured Post */}
        {!loading && hero && (
          <motion.article
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={() => navigate(`/blog/${hero.slug}`, { state: { article: hero } })}
            className="group grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 cursor-pointer"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
              {hero.image_url ? (
                <img decoding="async" loading="lazy"
                  src={hero.image_url}
                  alt={localized(hero, 'title')}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 text-6xl">
                  ✦
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center">
              {hero.category && (
                <span className="font-body text-xs font-medium text-accent uppercase tracking-wider mb-3">
                  {hero.category}
                </span>
              )}
              <h2 className="font-heading text-3xl lg:text-4xl font-light text-foreground mb-4 group-hover:text-accent transition-colors">
                {localized(hero, 'title')}
              </h2>
              {localized(hero, 'excerpt') && (
                <p className="font-body text-foreground/70 leading-relaxed mb-6">
                  {localized(hero, 'excerpt')}
                </p>
              )}
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {dateOf(hero)}
                </span>
                <span className="flex items-center gap-1.5 font-body text-sm text-accent font-medium">
                  {t('blog_read_more')}
                  <Arrow className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </motion.article>
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
