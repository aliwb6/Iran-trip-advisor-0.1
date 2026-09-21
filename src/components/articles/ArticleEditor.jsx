import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
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
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export default function ArticleEditor({ userId, authorType, onSuccess, onCancel }) {
  const { t, lang, dir } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImagePath, setUploadedImagePath] = useState(null);
  const fileInputRef = useRef(null);

  const isAdmin = authorType === 'admin';

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const removeUploadedImage = async (objectPath = uploadedImagePath) => {
    if (!objectPath) return;
    setUploadedImagePath(null);
    const { error } = await supabase.storage.from('article-images').remove([objectPath]);
    if (error) console.warn('Could not remove unused article image:', error.message);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error(lang === 'fa' ? 'فقط فایل‌های JPG، PNG یا WebP مجاز هستند.' : lang === 'ar' ? 'يُسمح فقط بملفات JPG وPNG وWebP.' : 'Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(lang === 'fa' ? 'حجم تصویر باید حداکثر ۵ مگابایت باشد.' : lang === 'ar' ? 'يجب ألا يتجاوز حجم الصورة 5 ميغابايت.' : 'Image size must be 5 MB or smaller.');
      return;
    }

    setUploadingImage(true);
    try {
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
      const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(objectPath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('article-images').getPublicUrl(objectPath);
      if (!data?.publicUrl) throw new Error('Image URL could not be created.');

      await removeUploadedImage();
      setUploadedImagePath(objectPath);
      setForm(current => ({ ...current, image_url: data.publicUrl }));
    } catch (error) {
      toast.error(error.message || (lang === 'fa' ? 'آپلود تصویر ناموفق بود.' : 'Image upload failed.'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUrlChange = (event) => {
    if (uploadedImagePath) void removeUploadedImage();
    set('image_url')(event);
  };

  const clearImage = () => {
    if (uploadedImagePath) void removeUploadedImage();
    setForm(current => ({ ...current, image_url: '' }));
  };

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
      setUploadedImagePath(null);
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

      {/* Image URL or local upload + preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-xs text-white/60 font-medium">{t('article_field_image')}</label>
          <span className="text-[11px] text-white/35">JPG, PNG, WebP · 5 MB</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={form.image_url}
            onChange={handleImageUrlChange}
            placeholder="https://..."
            dir="ltr"
            className="min-w-0 flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleImageUpload(event.target.files?.[0])}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage || submitting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-teal-400/40 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-300 transition hover:border-teal-300 hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploadingImage
              ? (lang === 'fa' ? 'در حال آپلود...' : lang === 'ar' ? 'جارٍ الرفع...' : 'Uploading...')
              : (lang === 'fa' ? 'انتخاب از دستگاه' : lang === 'ar' ? 'اختيار من الجهاز' : 'Upload from device')}
          </button>
        </div>
        {form.image_url && (
          <div className="relative mt-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <img decoding="async" loading="lazy"
              src={form.image_url}
              alt={t('article_img_preview_alt')}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="h-44 w-full object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute end-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-500"
              aria-label={lang === 'fa' ? 'حذف تصویر' : lang === 'ar' ? 'إزالة الصورة' : 'Remove image'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
