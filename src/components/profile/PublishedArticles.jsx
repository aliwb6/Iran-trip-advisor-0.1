import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Calendar } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';

function localized(article, field, lang) {
  return article[`${field}_${lang}`] || article[`${field}_en`] || article[`${field}_fa`] || '';
}

function articleDate(article, lang) {
  if (!article.created_at) return '';
  return new Date(article.created_at).toLocaleDateString(
    lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-SA' : 'en-US',
  );
}

/** Public, approved articles written by a guide or agency. */
export default function PublishedArticles({ articles, loading, authorName }) {
  const { lang, dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const heading = lang === 'fa'
    ? `مقاله‌های ${authorName}`
    : lang === 'ar'
      ? `مقالات ${authorName}`
      : `Articles by ${authorName}`;

  // No empty block is shown on public profiles; the section appears as soon as
  // the provider has a published article.
  if (!loading && articles.length === 0) return null;

  return (
    <section aria-labelledby="published-articles-heading">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/50 pb-2">
        <h2 id="published-articles-heading" className="font-heading text-2xl font-semibold text-foreground">
          {heading}
        </h2>
        {!loading && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.06] px-2.5 py-1 font-body text-xs font-medium text-accent">
            <BookOpen className="h-3.5 w-3.5" />
            {articles.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" aria-label={lang === 'fa' ? 'در حال بارگذاری مقاله‌ها' : 'Loading articles'}>
          {[0, 1].map((item) => (
            <div key={item} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
              <div className="aspect-[16/9] animate-pulse bg-muted" />
              <div className="space-y-3 p-4"><div className="h-3 w-20 animate-pulse rounded bg-muted" /><div className="h-5 w-4/5 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {articles.map((article, index) => {
            const title = localized(article, 'title', lang);
            const excerpt = localized(article, 'excerpt', lang);
            return (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: Math.min(index * 0.06, 0.24) }}
              >
                <Link
                  to={`/blog/${article.slug}`}
                  state={{ article }}
                  className="group block h-full overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    {article.image_url ? (
                      <img decoding="async" loading="lazy" src={article.image_url} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/15 to-accent/10 text-accent/55"><BookOpen className="h-9 w-9" /></div>
                    )}
                    {article.category && <span className="absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-1 font-body text-[11px] font-semibold capitalize text-accent shadow-sm backdrop-blur-sm">{article.category}</span>}
                  </div>
                  <div className="flex min-h-[156px] flex-col p-4">
                    <h3 className="font-heading text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-accent">{title}</h3>
                    {excerpt && <p className="mt-2 line-clamp-2 font-body text-sm leading-relaxed text-muted-foreground">{excerpt}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 font-body text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gold" />{articleDate(article, lang)}</span>
                      <span className="flex items-center gap-1 font-medium text-accent">{lang === 'fa' ? 'مطالعه' : lang === 'ar' ? 'اقرأ' : 'Read'} <Arrow className="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
