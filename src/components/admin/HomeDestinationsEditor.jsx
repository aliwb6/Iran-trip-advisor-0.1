import IconSwap from '@/components/ui/IconSwap';
import {
  useEffect,
  useState } from 'react';
import { Image as ImageIcon,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { SPOTLIGHT_CITIES } from '@/components/SpotlightDestinations';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

const emptyItem = () => ({
  id: null, slug: '', image_url: '', name_en: '', name_fa: '', name_ar: '',
  category_en: '', category_fa: '', category_ar: '', is_active: true,
});

const fallbackRows = SPOTLIGHT_CITIES.map((item, index) => ({
  id: null,
  slug: item.slug,
  image_url: item.image,
  name_en: item.name.en,
  name_fa: item.name.fa,
  name_ar: item.name.ar,
  category_en: item.category.en,
  category_fa: item.category.fa,
  category_ar: item.category.ar,
  sort_order: index,
  is_active: true,
}));

export default function HomeDestinationsEditor() {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  useEffect(() => {
    supabase.from('homepage_destinations').select('*').order('sort_order').then(({ data, error }) => {
      setItems(!error && data?.length ? data : fallbackRows);
      setLoading(false);
    });
  }, []);

  const change = (index, field, value) => setItems(current => current.map((item, i) =>
    i === index ? { ...item, [field]: value } : item
  ));

  const remove = async (index) => {
    const item = items[index];
    if (item.id) {
      const { error } = await supabase.from('homepage_destinations').delete().eq('id', item.id);
      if (error) return toast.error(error.message);
    }
    setItems(current => current.filter((_, i) => i !== index));
  };

  const uploadImage = async (index, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error(l('Please choose an image file.', 'لطفاً یک فایل تصویری انتخاب کنید.', 'يرجى اختيار ملف صورة.'));
    if (file.size > 10 * 1024 * 1024) return toast.error(l('Image must be smaller than 10 MB.', 'حجم تصویر باید کمتر از ۱۰ مگابایت باشد.', 'يجب أن يقلّ حجم الصورة عن 10 ميغابايت.'));

    setUploadingIndex(index);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `homepage/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('tour-images').upload(path, file);
    if (error) {
      setUploadingIndex(null);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from('tour-images').getPublicUrl(path);
    change(index, 'image_url', data.publicUrl);
    setUploadingIndex(null);
  };

  const save = async () => {
    const invalid = items.some(item => !String(item.slug || '').trim() || !String(item.image_url || '').trim() || !String(item.name_en || '').trim());
    if (invalid) return toast.error(l('Slug, English name and image are required.', 'شناسهٔ مسیر، نام انگلیسی و تصویر الزامی‌اند.', 'المعرّف والاسم الإنجليزي والصورة مطلوبة.'));
    setSaving(true);
    const rows = items.map((item, index) => ({
      slug: String(item.slug || '').trim(), image_url: String(item.image_url || '').trim(), name_en: String(item.name_en || '').trim(),
      name_fa: String(item.name_fa || '').trim() || null, name_ar: String(item.name_ar || '').trim() || null,
      category_en: String(item.category_en || '').trim() || null, category_fa: String(item.category_fa || '').trim() || null,
      category_ar: String(item.category_ar || '').trim() || null, sort_order: index, is_active: item.is_active,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from('homepage_destinations')
      .upsert(rows, { onConflict: 'slug' })
      .select()
      .order('sort_order');
    setSaving(false);
    if (error) return toast.error(error.message);
    setItems(data || rows);
    toast.success(l('Homepage destinations saved.', 'مقصدهای صفحهٔ اصلی ذخیره شدند.', 'حُفظت وجهات الصفحة الرئيسية.'));
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-700" /></div>;

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-teal-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-foreground font-bold text-lg">{l("Explore Iran's Hidden Wonders", 'شگفتی‌های کمترشناخته‌شدهٔ ایران', 'اكتشف عجائب إيران الخفية')}</h2>
          <p className="text-muted-foreground text-xs mt-1">{l('Edit homepage destination cards, labels and images.', 'کارت‌های مقصد، عنوان‌ها و تصاویر صفحهٔ اصلی را ویرایش کنید.', 'عدّل بطاقات الوجهات وعناوينها وصورها في الصفحة الرئيسية.')}</p>
        </div>
        <button onClick={() => setItems(current => [...current, emptyItem()])} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted text-foreground text-xs hover:bg-muted">
          <Plus className="w-4 h-4" /> {l('Add destination', 'افزودن مقصد', 'إضافة وجهة')}
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id || `${item.slug}-${index}`} className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex gap-4">
              <div className="w-28 shrink-0">
                <div className="w-28 h-28 rounded-xl overflow-hidden bg-card flex items-center justify-center">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-7 h-7 text-muted-foreground" />}
                </div>
                <label className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-muted text-muted-foreground text-[11px] cursor-pointer hover:bg-muted">
                  {<IconSwap active={uploadingIndex === index} a={<Upload className="w-3.5 h-3.5" />} b={<Loader2 className="w-3.5 h-3.5 animate-spin" />} keepMounted={false} />}
                  {l('Upload image', 'بارگذاری تصویر', 'رفع صورة')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingIndex !== null}
                    onChange={event => uploadImage(index, event.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <input className={inputClass} value={item.name_en} onChange={e => change(index, 'name_en', e.target.value)} placeholder={l('English name *', 'نام انگلیسی *', 'الاسم الإنجليزي *')} dir="ltr" />
                <input className={inputClass} value={item.name_fa} onChange={e => change(index, 'name_fa', e.target.value)} placeholder="نام فارسی" dir="rtl" />
                <input className={inputClass} value={item.name_ar} onChange={e => change(index, 'name_ar', e.target.value)} placeholder="الاسم العربي" dir="rtl" />
                <input className={inputClass} value={item.category_en} onChange={e => change(index, 'category_en', e.target.value)} placeholder={l('English category', 'دسته‌بندی انگلیسی', 'الفئة بالإنجليزية')} dir="ltr" />
                <input className={inputClass} value={item.category_fa} onChange={e => change(index, 'category_fa', e.target.value)} placeholder="دسته‌بندی فارسی" dir="rtl" />
                <input className={inputClass} value={item.category_ar} onChange={e => change(index, 'category_ar', e.target.value)} placeholder="الفئة العربية" dir="rtl" />
                <input className={`${inputClass} md:col-span-2`} value={item.image_url} onChange={e => change(index, 'image_url', e.target.value)} placeholder={l('Image URL *', 'نشانی تصویر *', 'رابط الصورة *')} dir="ltr" />
                <input className={inputClass} value={item.slug} onChange={e => change(index, 'slug', e.target.value)} placeholder={l('Destination slug *', 'شناسهٔ مسیر مقصد *', 'معرّف رابط الوجهة *')} dir="ltr" />
              </div>
              <button onClick={() => remove(index)} className="self-start p-2 rounded-lg text-red-700 bg-red-500/10 hover:bg-red-500/20" aria-label={l('Delete destination', 'حذف مقصد', 'حذف الوجهة')}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="mt-5 ms-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold disabled:opacity-60">
        {<IconSwap active={saving} a={<Save className="w-4 h-4" />} b={<Loader2 className="w-4 h-4 animate-spin" />} keepMounted={false} />} {l('Save changes', 'ذخیرهٔ تغییرات', 'حفظ التغييرات')}
      </button>
    </div>
  );
}
