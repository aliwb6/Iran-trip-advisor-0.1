import {
  useParams,
  Link,
  useLocation } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { 
  ArrowRight,
  ArrowLeft,
  Calendar,
  User,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { useArticleBySlug } from '@/hooks/useSupabase';

export default function ArticleDetails() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { t, lang, dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const routeArticle = state?.article?.slug === slug ? state.article : null;
  const { article, loading } = useArticleBySlug(slug, routeArticle);

  if (loading) {
    return (
      <div dir={dir} className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" aria-label="Loading article" />
      </div>
    );
  }

  if (!article) {
    return (
      <div dir={dir} className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-3xl text-foreground mb-4">Article Not Found</h1>
          <Link to="/blog" className="text-accent hover:underline">{t('view_all')} →</Link>
        </div>
      </div>
    );
  }

  const localized = (field) =>
    article[`${field}_${lang}`] || article[`${field}_fa`] || article[`${field}_en`] || '';
  const title = localized('title');
  const excerpt = localized('excerpt');
  const content = localized('content');
  const category = article.category || '';
  const author = 'Iran Trip Advisor';
  const date = article.created_at
    ? new Date(article.created_at).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-US')
    : '';
  const paragraphs = content.split(/\n\s*\n|\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <div dir={dir} className="pt-0 pb-20 min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-[50vh] min-h-[350px] overflow-hidden">
        <img decoding="async" loading="lazy"
          src={article.image_url || '/images/shiraz.jpg'}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        
        {/* Back button */}
        <Link 
          to="/blog" 
          className="absolute top-24 start-6 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
        >
          <Arrow className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          {t('back_to_home')}
        </Link>

        {/* Content overlay */}
        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Category */}
              <span className="inline-block px-4 py-1.5 rounded-full bg-accent text-white text-sm font-body font-medium mb-4">
                {category}
              </span>

              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl text-white mb-4 leading-tight">
                {title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-white/70">
                <span className="flex items-center gap-1.5 font-body text-sm">
                  <User className="w-4 h-4" />
                  {author}
                </span>
                <span className="flex items-center gap-1.5 font-body text-sm">
                  <Calendar className="w-4 h-4" />
                  {date}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Excerpt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-10"
        >
          <p className="font-body text-xl text-foreground/70 leading-relaxed italic border-s-4 border-accent ps-4">
            {excerpt}
          </p>
        </motion.div>

        {/* Article Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="prose prose-lg max-w-none"
        >
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="font-body text-foreground/80 leading-relaxed mb-6 text-lg whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
