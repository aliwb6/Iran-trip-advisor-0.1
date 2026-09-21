  import {
  useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { supabase } from '@/supabaseClient';
  import { useI18n } from '@/lib/i18n.jsx';
  import { Plus,
  Trash2,
  Save,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';

  const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

  export default function AdminTourForm() {
    const { t, lang } = useI18n();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
      title: '',
      description: '',
      header_image: '',
      price: '',
      days: 1,
      cities: 1,
      highlights: [''],
      itinerary: [{ day: 1, title: '', description: '' }],
      included: [''],
      not_included: [''],
    });

    const updateField = (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateItinerary = (index, field, value) => {
      const updated = [...formData.itinerary];
      updated[index] = { ...updated[index], [field]: value };
      updateField('itinerary', updated);
    };

    const addItineraryDay = () => {
      const newDay = formData.itinerary.length + 1;
      updateField('itinerary', [...formData.itinerary, { day: newDay, title: '', description: '' }]);
    };

    const removeItineraryDay = (index) => {
      const updated = formData.itinerary.filter((_, i) => i !== index).map((item, i) => ({ ...item, day: i + 1 }));
      updateField('itinerary', updated);
    };

    const updateArrayField = (field, index, value) => {
      const updated = [...formData[field]];
      updated[index] = value;
      updateField(field, updated);
    };

    const addArrayItem = (field) => {
      updateField(field, [...formData[field], '']);
    };

    const removeArrayItem = (field, index) => {
      updateField(field, formData[field].filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
      setSaving(true);
      setError('');
      setSuccess(false);

      try {
        const payload = {
          title: formData.title,
          description: formData.description,
          header_image: formData.header_image,
          price: parseFloat(formData.price) || 0,
          days: parseInt(formData.days) || 1,
          cities: parseInt(formData.cities) || 1,
          highlights: formData.highlights.filter(h => h.trim()),
          itinerary: formData.itinerary.filter(i => i.title.trim()).map(i => ({
            day: parseInt(i.day) || 1,
            title: i.title,
            description: i.description,
          })),
          included: formData.included.filter(i => i.trim()),
          not_included: formData.not_included.filter(i => i.trim()),
        };

        const { error: supabaseError } = await supabase.from('tours').insert(payload);

        if (supabaseError) throw supabaseError;

        setSuccess(true);
        setTimeout(() => navigate('/tours'), 1500);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-8">
          {lang === 'fa' ? 'ایجاد تور جدید' : lang === 'ar' ? 'إنشاء رحلة جديدة' : 'Create New Tour'}
        </h1>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 font-body">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-body">
            {lang === 'fa' ? 'تور با موفقیت ذخیره شد!' : lang === 'ar' ? 'تم حفظ الرحلة بنجاح!' : 'Tour saved successfully!'}
          </div>
        )}

        <div className="space-y-8">
          <section className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {lang === 'fa' ? 'اطلاعات اصلی' : lang === 'ar' ? 'المعلومات الأساسية' : 'Basic Info'}
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block font-body text-sm text-muted-foreground mb-1">
                  {lang === 'fa' ? 'عنوان' : lang === 'ar' ? 'العنوان' : 'Title'}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block font-body text-sm text-muted-foreground mb-1">
                  {lang === 'fa' ? 'توضیحات' : lang === 'ar' ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                />
              </div>
              <div>
                <label className="block font-body text-sm text-muted-foreground mb-1">
                  {lang === 'fa' ? 'لینک تصویر هدر' : lang === 'ar' ? 'رابط صورة الهيدر' : 'Header Image URL'}
                </label>
                <input
                  type="url"
                  value={formData.header_image}
                  onChange={e => updateField('header_image', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {lang === 'fa' ? 'جزئیات تور' : lang === 'ar' ? 'تفاصيل الرحلة' : 'Tour Details'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-body text-sm text-muted-foreground mb-1">
                  {lang === 'fa' ? 'قیمت ($)' : lang === 'ar' ? 'السعر ($)' : 'Price ($)'}
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => updateField('price', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block font-body text-sm text-muted-foreground mb-1">
                  {lang === 'fa' ? 'تعداد روزها' : lang === 'ar' ? 'عدد الأيام' : 'Days'}
                </label>
                <select
                  value={formData.days}
                  onChange={e => updateField('days', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-body text-sm text-muted-foreground mb-1">
                  {lang === 'fa' ? 'تعداد شهرها' : lang === 'ar' ? 'عدد المدن' : 'Cities'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.cities}
                  onChange={e => updateField('cities', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {lang === 'fa' ? 'برنامه سفر (روز به روز)' : lang === 'ar' ? 'خط الرحلة (يوم بيوم)' : 'Itinerary (Day by Day)'}
              </h2>
              <button
                onClick={addItineraryDay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-body font-medium hover:bg-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {lang === 'fa' ? 'افزودن روز' : lang === 'ar' ? 'إضافة يوم' : 'Add Day'}
              </button>
            </div>
            <div className="space-y-4">
              {formData.itinerary.map((day, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/50 bg-background space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-lg font-semibold text-accent">
                      {lang === 'fa' ? 'روز' : lang === 'ar' ? 'يوم' : 'Day'} {day.day}
                    </span>
                    <button
                      onClick={() => removeItineraryDay(i)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={lang === 'fa' ? 'عنوان روز' : lang === 'ar' ? 'عنوان اليوم' : 'Day Title'}
                    value={day.title}
                    onChange={e => updateItinerary(i, 'title', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <textarea
                    rows={3}
                    placeholder={lang === 'fa' ? 'توضیحات روز' : lang === 'ar' ? 'وصف اليوم' : 'Day Description'}
                    value={day.description}
                    onChange={e => updateItinerary(i, 'description', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {lang === 'fa' ? 'نکات برجسته' : lang === 'ar' ? 'المرورزات' : 'Highlights'}
            </h2>
            <div className="space-y-3">
              {formData.highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={h}
                    onChange={e => updateArrayField('highlights', i, e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder={lang === 'fa' ? 'مورد را وارد کنید' : lang === 'ar' ? 'أدخل العنصر' : 'Enter item'}
                  />
                  <button
                    onClick={() => removeArrayItem('highlights', i)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addArrayItem('highlights')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-accent text-accent text-sm font-body hover:bg-accent/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {lang === 'fa' ? 'افزودن مورد' : lang === 'ar' ? 'إضافة عنصر' : 'Add Item'}
              </button>
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {lang === 'fa' ? 'شامل' : lang === 'ar' ? 'مشمول' : 'Included'}
            </h2>
            <div className="space-y-3">
              {formData.included.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={e => updateArrayField('included', i, e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder={lang === 'fa' ? 'مورد را وارد کنید' : lang === 'ar' ? 'أدخل العنصر' : 'Enter item'}
                  />
                  <button
                    onClick={() => removeArrayItem('included', i)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addArrayItem('included')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-accent text-accent text-sm font-body hover:bg-accent/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {lang === 'fa' ? 'افزودن مورد' : lang === 'ar' ? 'إضافة عنصر' : 'Add Item'}
              </button>
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {lang === 'fa' ? 'شامل نیست' : lang === 'ar' ? 'غير مشمول' : 'Not Included'}
            </h2>
            <div className="space-y-3">
              {formData.not_included.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={e => updateArrayField('not_included', i, e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder={lang === 'fa' ? 'مورد را وارد کنید' : lang === 'ar' ? 'أدخل العنصر' : 'Enter item'}
                  />
                  <button
                    onClick={() => removeArrayItem('not_included', i)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addArrayItem('not_included')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-accent text-accent text-sm font-body hover:bg-accent/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {lang === 'fa' ? 'افزودن مورد' : lang === 'ar' ? 'أدخل العنصر' : 'Add Item'}
              </button>
            </div>
          </section>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-accent text-white font-body font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? (lang === 'fa' ? 'در حال ذخیره...' : lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (lang === 'fa' ? 'ذخیره تور' : lang === 'ar' ? 'حفظ الرحلة' : 'Save Tour')}
          </button>
        </div>
      </div>
    );
  }
