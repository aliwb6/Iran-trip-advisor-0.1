import { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n.jsx';

const CATEGORIES = [
  { value: 'architecture', label: 'article_cat_architecture' },
  { value: 'history',      label: 'article_cat_history' },
  { value: 'culture',      label: 'article_cat_culture' },
  { value: 'nature',       label: 'article_cat_nature' },
  { value: 'food',         label: 'article_cat_food' },
  { value: 'photography',  label: 'article_cat_photography' },
  { value: 'general',      label: 'article_cat_general' },
];

const EMPTY = { image_url: '', title: '', excerpt: '', content: '', category: 'general' };

export default function ArticleEditor({ userId, authorType, onSuccess, onCancel }) {
  const { t, lang, dir } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = authorType === 'admin';

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error(t('article_title_required'));
      return;
    }
    setSubmitting(true);
    try {
      const slug = `article-${Date.now()}`;
      const localizedFields = {
        [`title_${lang}`]: form.title.trim(),
        [`excerpt_${lang}`]: form.excerpt.trim(),
        [`content_${lang}`]: form.content.trim(),
      };
      const { error } = await supabase.from('articles').insert({
        slug,
        author_id: userId,
        author_type: authorType,
        image_url: form.image_url.trim() || null,
        ...localizedFields,
        category: form.category,
        status: isAdmin ? 'approved' : 'pending',
        is_featured: false,
        is_published: isAdmin,
      });
      if (error) throw error;
      toast.success(t(isAdmin ? 'article_published_toast' : 'article_submitted_toast'));
      setForm(EMPTY);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || t('article_save_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      dir={dir}
      onSubmit={handleSubmit}
      className="space-y-5 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
    >
      <h2 className="text-lg font-semibold text-white">{t('article_editor_title')}</h2>

      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-yellow-300 text-sm">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{t('article_pending_notice')}</span>
        </div>
      )}

      {/* Image URL + preview */}
      <div className="space-y-2">
        <label className="block text-xs text-white/60 font-medium">{t('article_field_image')}</label>
        <input
          type="url"
          value={form.image_url}
          onChange={set('image_url')}
          placeholder="https://..."
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50"
        />
        {form.image_url && (
          <img decoding="async" loading="lazy"
            src={form.image_url}
            alt={t('article_img_preview_alt')}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="mt-2 h-40 w-full object-cover rounded-xl border border-white/10"
          />
        )}
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label className="block text-xs text-white/60 font-medium">
          {t('article_field_title')} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={set('title')}
          maxLength={120}
          required
          placeholder={t('article_title_placeholder')}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50"
        />
        <p className="text-xs text-white/30 text-left">{form.title.length}/120</p>
      </div>

      {/* Excerpt */}
      <div className="space-y-1">
        <label className="block text-xs text-white/60 font-medium">{t('article_field_excerpt')}</label>
        <textarea
          value={form.excerpt}
          onChange={set('excerpt')}
          maxLength={500}
          rows={2}
          placeholder={t('article_excerpt_placeholder')}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50 resize-none"
        />
        <p className="text-xs text-white/30 text-left">{form.excerpt.length}/500</p>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <label className="block text-xs text-white/60 font-medium">{t('article_field_content')}</label>
        <textarea
          value={form.content}
          onChange={set('content')}
          rows={10}
          placeholder={t('article_content_placeholder')}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50 resize-y"
        />
      </div>

      {/* Category */}
      <div className="space-y-1">
        <label className="block text-xs text-white/60 font-medium">{t('article_field_category')}</label>
        <select
          value={form.category}
          onChange={set('category')}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 appearance-none cursor-pointer"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value} className="bg-zinc-900">
              {t(c.label)}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {submitting ? t('article_submitting') : t(isAdmin ? 'article_publish' : 'article_submit_for_review')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 bg-white/[0.05] hover:bg-white/[0.09] text-white/70 text-sm py-2.5 rounded-xl transition-colors border border-white/10"
          >
            {t('dashboard_cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
