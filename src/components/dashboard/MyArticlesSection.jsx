import { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { Star, Trash2, PenLine, ChevronRight } from 'lucide-react';
import { useMyArticles } from '@/hooks/useSupabase';
import ArticleEditor from '@/components/articles/ArticleEditor';
import { useI18n } from '@/lib/i18n.jsx';

export default function MyArticlesSection({ user }) {
  const { t, lang, dir } = useI18n();
  const authorType = user?.profile?.role || 'guide';
  const { articles, loading, refetch } = useMyArticles(user?.id);
  const [showEditor, setShowEditor] = useState(false);

  const total     = articles.length;
  const published = articles.filter(a => a.status === 'approved').length;
  const pending   = articles.filter(a => a.status === 'pending').length;
  const rejected  = articles.filter(a => a.status === 'rejected').length;
  const statusLabels = {
    approved: { label: t('article_status_published'), cls: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
    pending:  { label: t('article_status_pending'), cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    rejected: { label: t('article_status_rejected'), cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  };
  const writingTips = [t('article_tip_1'), t('article_tip_2'), t('article_tip_3')];
  const articleText = (article, field) =>
    article[`${field}_${lang}`] || article[`${field}_en`] || article[`${field}_fa`] || '';
  const dateLocale = lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-SA' : 'en-US';

  const handleDelete = async (id) => {
    if (!window.confirm(t('article_delete_confirm'))) return;
    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (error) { toast.error(t('article_delete_error')); return; }
    toast.success(t('article_deleted_toast'));
    refetch();
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <PenLine className="w-5 h-5 text-teal-400" />
          {t('article_section_title')}
        </h2>
        <button
          onClick={() => setShowEditor(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
        >
          {showEditor ? t('article_close_form') : t('article_new')}
        </button>
      </div>

      {/* Inline editor */}
      {showEditor && (
        <ArticleEditor
          userId={user?.id}
          authorType={authorType}
          onSuccess={() => { setShowEditor(false); refetch(); }}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('article_stat_total'), value: total,     cls: 'text-white' },
          { label: t('article_stat_published'), value: published, cls: 'text-teal-400' },
          { label: t('article_stat_pending'), value: pending,   cls: 'text-yellow-400' },
          { label: t('article_stat_rejected'), value: rejected,  cls: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.cls}`}>{stat.value}</p>
            <p className="text-xs text-white/50 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Article list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <PenLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t('article_empty_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(article => {
            const s = statusLabels[article.status] || statusLabels.pending;
            const title = articleText(article, 'title');
            const excerpt = articleText(article, 'excerpt');
            return (
              <div
                key={article.id}
                className="flex gap-4 bg-white/[0.04] border border-white/[0.07] rounded-xl p-4"
              >
                {/* Thumbnail */}
                {article.image_url ? (
                  <img decoding="async" loading="lazy"
                    src={article.image_url}
                    alt=""
                    className="w-20 h-16 object-cover rounded-lg shrink-0 border border-white/10"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-20 h-16 rounded-lg bg-white/[0.06] shrink-0 flex items-center justify-center text-white/20 border border-white/10">
                    <PenLine className="w-5 h-5" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate flex-1">{title}</p>
                    {article.is_featured && (
                      <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0 fill-yellow-400 mt-0.5" />
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                  {excerpt && (
                    <p className="text-xs text-white/50 mt-1 line-clamp-2">{excerpt}</p>
                  )}
                  {article.status === 'rejected' && article.admin_note && (
                    <p className="text-xs text-red-400 mt-1">{t('article_rejected_reason')}{article.admin_note}</p>
                  )}
                  <p className="text-[10px] text-white/30 mt-2">
                    {new Date(article.created_at).toLocaleDateString(dateLocale)}
                  </p>
                </div>

                {/* Delete (pending only) */}
                {article.status === 'pending' && (
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="shrink-0 p-2 text-white/30 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                    title={t('article_delete_confirm')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Writing tips */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
        <p className="text-xs font-semibold text-teal-400 mb-3 flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5" />
          {t('article_writing_tips_title')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {writingTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/50">
              <span className="text-teal-500 shrink-0 mt-0.5">◆</span>
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
