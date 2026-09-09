import { useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { iranianCities } from '@/data/iranianCities';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ACCOMMODATION_TYPES,
  HOTEL_STAR_LEVELS,
  TRANSPORTATION_OPTIONS,
  MEALS_OPTIONS,
  OTHER_OPTIONS,
  DEFAULT_INCLUDED_STATE,
  serializeIncluded,
  parseIncluded,
} from '@/lib/tourInclusions';

export const THEMES = [
  { value: 'nature',    en: 'Nature & Wildlife 🌿',        fa: 'طبیعت‌گردی و حیات وحش 🌿', ar: 'الطبيعة والحياة البرية 🌿' },
  { value: 'cultural',  en: 'Cultural & Historical 🏛️',    fa: 'فرهنگی و تاریخی 🏛️',       ar: 'ثقافي وتاريخي 🏛️' },
  { value: 'coastal',   en: 'Coastal & Marine 🏖️',         fa: 'ساحلی و دریایی 🏖️',        ar: 'ساحلي وبحري 🏖️' },
  { value: 'urban',     en: 'Urban & Modern 🏙️',           fa: 'شهری و مدرن 🏙️',           ar: 'حضري وعصري 🏙️' },
  { value: 'rural',     en: 'Rural & Eco 🏡',              fa: 'روستایی و بوم‌گردی 🏡',     ar: 'ريفي وبيئي 🏡' },
  { value: 'luxury',    en: 'Luxury & VIP 👑',             fa: 'لاکچری و VIP 👑',           ar: 'فاخر و VIP 👑' },
  { value: 'budget',    en: 'Budget & Backpacking 🎒',     fa: 'اقتصادی و کوله‌گردی 🎒',   ar: 'اقتصادي وحقيبة ظهر 🎒' },
  { value: 'adventure',    en: 'Adventure & Trekking 🧗',     fa: 'ماجراجویی و طبیعت‌پیمایی 🧗', ar: 'مغامرة ورحلات 🧗' },
  { value: 'culinary',     en: 'Food & Culinary 🍽️',         fa: 'غذا و آشپزی ایرانی 🍽️',     ar: 'الطعام وفنون الطهي 🍽️' },
  { value: 'desert',       en: 'Desert & Stargazing 🏜️',      fa: 'کویر و رصد ستارگان 🏜️',     ar: 'الصحراء ومراقبة النجوم 🏜️' },
  { value: 'photography',  en: 'Photography 📸',              fa: 'عکاسی 📸',                    ar: 'التصوير 📸' },
  { value: 'pilgrimage',   en: 'Religious & Pilgrimage 🕌',   fa: 'زیارتی و مذهبی 🕌',          ar: 'ديني وزيارات 🕌' },
  { value: 'wellness',     en: 'Wellness & Medical 🌿',       fa: 'سلامت و درمانی 🌿',           ar: 'الصحة والعلاج 🌿' },
  { value: 'family',       en: 'Family Friendly 👨‍👩‍👧‍👦',          fa: 'خانوادگی 👨‍👩‍👧‍👦',                ar: 'عائلي 👨‍👩‍👧‍👦' },
  { value: 'architecture', en: 'Architecture & Archaeology 🏰', fa: 'معماری و باستان‌شناسی 🏰', ar: 'العمارة والآثار 🏰' },
];

const TITLE_EXAMPLES = [
  '7-Day Persian Heritage Journey: Tehran, Kashan, Isfahan & Yazd',
  'Northern Iran Nature Escape: Forests, Villages & Caspian Coast',
  'Taste of Iran: A 5-Day Culinary Tour',
  'Desert Stars & Ancient Cities Adventure',
];

export const DIFFICULTY_OPTIONS = [
  { value: 'easy',        en: 'Easy',        fa: 'آسان',   ar: 'سهل' },
  { value: 'moderate',    en: 'Moderate',    fa: 'متوسط',  ar: 'متوسط' },
  { value: 'challenging', en: 'Challenging', fa: 'دشوار',  ar: 'صعب' },
];

export const TOUR_TYPE_OPTIONS = [
  { value: 'private', en: 'Private', fa: 'خصوصی', ar: 'خاصة' },
  { value: 'group', en: 'Group', fa: 'گروهی', ar: 'جماعية' },
];

export const EMPTY_TOUR = {
  title: '', slug: '', description: '', duration: '', price: '',
  highlights: '', itinerary: '',
  image_url: '', gallery: '', status: 'draft', difficulty: '', tour_type: '',
};

export default function TourForm({ editing, onDone, onCancel, isPlatform = false }) {
  const { t, lang, dir } = useI18n();
  const fileRef    = useRef(null);
  const galleryRef = useRef(null);

  const initialStatus = isPlatform ? 'published' : 'draft';

  const [form, setForm] = useState(() => {
    if (!editing) return { ...EMPTY_TOUR, status: initialStatus };
    return {
      title:       editing.title || '',
      slug:        editing.slug || '',
      description: editing.description || '',
      duration:    editing.duration != null ? String(editing.duration) : '',
      price:       editing.price != null ? String(editing.price) : '',
      highlights:  Array.isArray(editing.highlights) ? editing.highlights.join('\n') : (editing.highlights || ''),
      itinerary:   editing.itinerary || '',
      status:      editing.status || initialStatus,
      difficulty:  editing.difficulty || '',
      tour_type:   editing.tour_type || '',
    };
  });

  // Cities as a chip list — typed name → Enter → chip; chips are removable.
  const [cities, setCities] = useState(() => {
    if (!editing) return [];
    if (Array.isArray(editing.cities)) return editing.cities.filter(Boolean);
    if (typeof editing.cities === 'string' && editing.cities.trim()) {
      return editing.cities.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  });
  const [cityInput, setCityInput] = useState('');

  // Structured "What's Included" selections — single source of truth.
  // Hydrated from whatever's on the existing tour row (new English labels or
  // legacy slug rows are both accepted by parseIncluded).
  const [included, setIncluded] = useState(() =>
    editing ? parseIncluded(editing.included) : { ...DEFAULT_INCLUDED_STATE }
  );

  const setIncludedField = (field, value) =>
    setIncluded(prev => ({ ...prev, [field]: value }));

  const toggleTransport = (value) =>
    setIncluded(prev => ({
      ...prev,
      transportation: prev.transportation.includes(value)
        ? prev.transportation.filter(v => v !== value)
        : [...prev.transportation, value],
    }));

  const toggleOther = (value) =>
    setIncluded(prev => ({
      ...prev,
      other: prev.other.includes(value)
        ? prev.other.filter(v => v !== value)
        : [...prev.other, value],
    }));

  const [selectedThemes, setSelectedThemes] = useState(() => {
    if (!editing) return [];
    if (Array.isArray(editing.theme)) return editing.theme;
    return editing.theme ? [editing.theme] : [];
  });
  const [imageUrl,     setImageUrl]     = useState(editing?.image_url || '');
  const [mainImageCaption, setMainImageCaption] = useState(editing?.main_image_caption || '');
  const [galleryUrls,  setGalleryUrls]  = useState(() => {
    if (!editing) return [];
    if (Array.isArray(editing.gallery)) return editing.gallery;
    return editing.gallery ? editing.gallery.split(',').map(s => s.trim()).filter(Boolean) : [];
  });
  const [galleryCaptions, setGalleryCaptions] = useState(() => {
    if (!editing || !Array.isArray(editing.gallery_captions)) return [];
    return editing.gallery_captions;
  });
  const [pasteUrl,     setPasteUrl]     = useState('');
  const [uploadingMain,    setUploadingMain]    = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState('');
  const [customTheme,   setCustomTheme]   = useState('');
  const [customTransportation, setCustomTransportation] = useState('');
  const [showCustomTransportation, setShowCustomTransportation] = useState(false);
  const [customOther, setCustomOther] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'title') {
        updated.slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      return updated;
    });
  };

  const toggleTheme = (v) => setSelectedThemes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  // Cities chip input — Enter / comma adds a chip, X removes it.
  const addCity = () => {
    const v = cityInput.trim();
    if (!v) return;
    setCities(prev => prev.includes(v) ? prev : [...prev, v]);
    setCityInput('');
  };
  const removeCity = (name) => setCities(prev => prev.filter(c => c !== name));
  const onCityKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCity();
    } else if (e.key === 'Backspace' && !cityInput && cities.length) {
      setCities(prev => prev.slice(0, -1));
    }
  };


  const addCustomTheme = () => {
    const v = customTheme.trim();
    if (v) { setSelectedThemes(p => p.includes(v) ? p : [...p, v]); setCustomTheme(''); }
  };
  const addCustomTransportation = () => {
    const value = customTransportation.trim();
    if (!value) return;
    setIncluded(prev => ({
      ...prev,
      transportation: prev.transportation.includes(value)
        ? prev.transportation
        : [...prev.transportation, value],
    }));
    setCustomTransportation('');
  };

  const toggleCustomTransportation = (enabled) => {
    setShowCustomTransportation(!!enabled);
    if (enabled) return;

    setCustomTransportation('');
    setIncluded(prev => ({
      ...prev,
      transportation: prev.transportation.filter(value =>
        TRANSPORTATION_OPTIONS.some(option => option.value === value)
      ),
    }));
  };

  const addCustomOther = () => {
    const value = customOther.trim();
    if (!value) return;
    setIncluded(prev => ({
      ...prev,
      other: prev.other.includes(value) ? prev.other : [...prev.other, value],
    }));
    setCustomOther('');
  };

  const uploadFile = async (file) => {
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
    const { error: uploadErr } = await supabase.storage.from('tour-images').upload(fileName, file);
    if (uploadErr) throw uploadErr;
    const { data } = supabase.storage.from('tour-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingMain(true);
    try { setImageUrl(await uploadFile(file)); }
    catch (err) { setError(err.message); }
    finally { setUploadingMain(false); }
  };

  const handleGalleryUpload = async (files) => {
    const arr = Array.from(files).slice(0, 10 - galleryUrls.length);
    if (!arr.length) return;
    setUploadingGallery(true);
    try {
      const urls = await Promise.all(arr.map(uploadFile));
      const validUrls = urls.filter(Boolean);
      setGalleryUrls(prev => [...prev, ...validUrls]);
      setGalleryCaptions(prev => [...prev, ...validUrls.map(() => '')]);
    } catch (err) { setError(err.message); }
    finally { setUploadingGallery(false); }
  };

  // Add an externally-hosted image by pasting its URL — it shares the same
  // `galleryUrls` array / 10-image limit as device uploads and is NOT uploaded
  // to the bucket. We validate the string and optionally verify it actually
  // loads before committing it.
  const handleAddGalleryUrl = (e) => {
    e.preventDefault();
    const raw = pasteUrl.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) {
      setError(
        lang === 'fa' ? 'لطفاً یک نشانی تصویر معتبر وارد کنید (با http:// یا https:// شروع شود).'
        : lang === 'ar' ? 'يرجى إدخال رابط صورة صالح (يبدأ بـ http:// أو https://).'
        : 'Please enter a valid image URL (starting with http:// or https://).'
      );
      return;
    }
    if (galleryUrls.length >= 10) {
      setError(
        lang === 'fa' ? 'حداکثر ۱۰ تصویر مجاز است.'
        : lang === 'ar' ? 'الحد الأقصى ١٠ صور.'
        : 'Maximum of 10 images allowed.'
      );
      return;
    }

    const verifyAndAdd = () => {
      setGalleryUrls(prev => [...prev, raw]);
      setGalleryCaptions(prev => [...prev, '']);
      setPasteUrl('');
      setError('');
    };

    // Sanity-check the URL loads before adding (so we don't persist dead links).
    const img = new Image();
    img.onload = verifyAndAdd;
    img.onerror = () => {
      setError(
        lang === 'fa' ? 'این نشانی بارگذاری نشد. مطمئن شوید یک تصویر معتبر است و دسترسی‌پذیر است.'
        : lang === 'ar' ? 'تعذّر تحميل هذا الرابط. تأكد أنه صورة صالحة ويمكن الوصول إليها.'
        : 'That URL could not be loaded. Make sure it is a valid, accessible image.'
      );
    };
    img.src = raw;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.tour_type) {
      setError(
        lang === 'fa' ? 'لطفاً نوع تور را انتخاب کنید.'
        : lang === 'ar' ? 'يرجى اختيار نوع الرحلة.'
        : 'Please select a tour type.'
      );
      return;
    }

    if (!form.difficulty) {
      setError(
        lang === 'fa' ? 'لطفاً سطح دشواری را انتخاب کنید.'
        : lang === 'ar' ? 'يرجى اختيار مستوى الصعوبة.'
        : 'Please select a difficulty level.'
      );
      return;
    }

    setSaving(true);
    try {
      // Note: `status` is not part of the form anymore (guides shouldn't set it).
      // It's assigned by the create/edit branches below — preserved on edit,
      // defaulted on create.
      const payload = {
        title:       form.title,
        slug:        form.slug,
        description: form.description,
        duration:    form.duration ? Number(form.duration) : null,
        price:       form.price ? Number(form.price) : null,
        tour_type:   form.tour_type,
        // Keep the legacy single-value fields in sync for older listing/detail
        // consumers while Cities remains the only editable source of truth.
        location:    cities.join(', ') || null,
        city:        cities[0] || null,
        cities,
        theme:       selectedThemes,
        difficulty:  form.difficulty,
        highlights:  form.highlights.split('\n').filter(Boolean),
        itinerary:   form.itinerary,
        // Inclusion list is serialised into a readable English label array
        // (e.g. ["Hotel (4★)", "Airport Transfer", "Breakfast only"]).
        // The "Not Included" column is no longer written — anything not
        // selected here is implicitly excluded.
        included:    serializeIncluded(included),
        image_url:   imageUrl,
        main_image_caption: mainImageCaption.trim() || null,
        gallery:     galleryUrls,
        gallery_captions: galleryUrls.map((_, index) => (galleryCaptions[index] || '').trim()),
      };

      if (editing) {
        // Preserve existing status on edit. Platform-tour admin edits also
        // force-publish (existing behaviour).
        const updatePayload = isPlatform
          ? { ...payload, status: 'published', owner_id: null, is_platform_tour: true }
          : payload;
        const { data: updated, error: err } = await supabase
          .from('tours').update(updatePayload).eq('id', editing.id).select().single();
        if (err) throw err;
        onDone(updated, false);
      } else {
        let insertPayload;
        if (isPlatform) {
          insertPayload = { ...payload, status: 'published', owner_id: null, is_platform_tour: true };
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          insertPayload = { ...payload, status: 'draft', owner_id: user.id };
        }
        const { data: created, error: err } = await supabase
          .from('tours').insert(insertPayload).select().single();
        if (err) throw err;
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setForm({ ...EMPTY_TOUR, status: initialStatus, difficulty: '' });
          setSelectedThemes([]);
          setCities([]);
          setCityInput('');
          setIncluded({ ...DEFAULT_INCLUDED_STATE });
          setImageUrl('');
          setMainImageCaption('');
          setGalleryUrls([]);
          setGalleryCaptions([]);
        }, 2000);
        onDone(created, true);
      }
    } catch (err) {
      setError(err.message || 'Failed to save tour');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)] focus:ring-1 focus:ring-[hsl(178,85%,32%)]/50 transition';
  const labelClass = 'block text-white/50 text-xs mb-1.5 font-medium';
  const tagBase    = 'rounded-full px-3 py-1.5 text-sm cursor-pointer flex items-center gap-1.5 border transition';
  const tagOn      = `${tagBase} border-teal-400 bg-teal-400/20 text-white`;
  const tagOff     = `${tagBase} border-white/20 text-white/70 hover:border-teal-400`;
  const customTransportationValues = included.transportation.filter(value =>
    !TRANSPORTATION_OPTIONS.some(option => option.value === value)
  );
  const customTransportationEnabled = showCustomTransportation || customTransportationValues.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-lg">{editing ? t('dashboard_update_tour') : t('dashboard_add_tour')}</h2>
          <p className="text-white/40 text-xs mt-0.5">{editing ? t('dashboard_update_tour') : t('dashboard_add_tour')}</p>
        </div>
        {editing && (
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-white/15 text-white/50 text-xs hover:text-white hover:border-white/30 transition">
            ✕ {t('dashboard_cancel')}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Tour created successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-6 space-y-5">

        {/* Title */}
        <div>
          <label className={labelClass}>Title *</label>
          <input
            name="title"
            required
            list="tour-title-examples"
            value={form.title}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. 7-Day Persian Heritage Journey: Tehran, Kashan, Isfahan & Yazd"
          />
          <datalist id="tour-title-examples">
            {TITLE_EXAMPLES.map(example => <option key={example} value={example} />)}
          </datalist>
          <p className="text-white/30 text-[10px] mt-1.5">
            {lang === 'fa'
              ? 'نمونه‌ها: سفر میراث پارسی ۷ روزه · طبیعت‌گردی شمال ایران · تور خوراک ایران'
              : lang === 'ar'
              ? 'أمثلة: رحلة التراث الفارسي لمدة 7 أيام · مغامرة طبيعية في شمال إيران · جولة طعام إيرانية'
              : 'Examples: 7-Day Persian Heritage Journey · Northern Iran Nature Escape · Taste of Iran Culinary Tour'}
          </p>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={5}
            className={`${inputClass} resize-none`}
            placeholder={lang === 'fa'
              ? 'مثال: در این سفر ۷ روزه، مهمانان از تهران تا یزد با معماری، غذا و زندگی محلی ایران آشنا می‌شوند. برنامه شامل بازدیدهای روزانه، زمان آزاد و همراهی راهنمای محلی است. این تور برای علاقه‌مندان به فرهنگ و تاریخ مناسب است.'
              : lang === 'ar'
              ? 'مثال: في هذه الرحلة التي تستغرق 7 أيام، يكتشف الضيوف العمارة والطعام والحياة المحلية من طهران إلى يزد. تشمل الجولة زيارات يومية ووقتاً حراً ودليلاً محلياً.'
              : 'Example: On this 7-day journey from Tehran to Yazd, guests discover Iran’s architecture, food, and local life. The plan includes guided daily visits, free time, and local support. Ideal for culture and history lovers.'}
          />
          <p className="text-white/30 text-[10px] mt-1.5">
            {lang === 'fa' ? 'مسیر سفر، تجربه‌های اصلی، خدمات و مناسب‌بودن تور برای مخاطب را کوتاه و روشن توضیح دهید.' : 'Briefly cover the route, key experiences, included support, and who the tour is best for.'}
          </p>
        </div>

        {/* Duration / Price */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Duration (days)</label>
            <input name="duration" type="number" min="1" value={form.duration} onChange={handleChange} className={inputClass} placeholder="7" />
          </div>
          <div>
            <label className={labelClass}>Price (USD)</label>
            <input name="price" type="number" min="0" value={form.price} onChange={handleChange} className={inputClass} placeholder="1200" />
          </div>
        </div>

        {/* Cities — chip input. Press Enter or comma to add, X (or Backspace on empty) to remove. */}
        <div>
          <label className={labelClass}>Cities</label>
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-xl border border-white/10 bg-white/[0.05] focus-within:border-[hsl(178,85%,32%)] focus-within:ring-1 focus-within:ring-[hsl(178,85%,32%)]/50 transition">
            {cities.map(c => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-400/15 border border-teal-400/30 text-white text-xs"
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeCity(c)}
                  className="text-white/60 hover:text-white"
                  aria-label={`Remove ${c}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              list="iran-destinations"
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              onKeyDown={onCityKeyDown}
              onBlur={addCity}
              className="flex-1 min-w-[140px] bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none px-1 py-1"
              placeholder={cities.length === 0 ? 'Type a city and press Enter — e.g. Tehran' : 'Add another…'}
            />
          </div>
          <p className="text-white/30 text-[10px] mt-1">Press Enter or comma to add. Click ✕ to remove.</p>
          <datalist id="iran-destinations">
            {iranianCities.map(city => <option key={city} value={city} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tour Type (required) */}
          <div>
            <label htmlFor="tour-type" className={labelClass}>
              {lang === 'fa' ? 'نوع تور' : lang === 'ar' ? 'نوع الرحلة' : 'Tour Type'} <span className="text-red-400">*</span>
              <span className="ms-1 text-white/40 text-[10px] font-normal">
                {lang === 'fa' ? '(الزامی)' : lang === 'ar' ? '(مطلوب)' : '(Required)'}
              </span>
            </label>
            <Select
              value={form.tour_type}
              onValueChange={value => setForm(prev => ({ ...prev, tour_type: value }))}
              dir={dir}
            >
              <SelectTrigger
                id="tour-type"
                aria-required="true"
                className="w-full h-11 rounded-xl border-white/10 bg-white/[0.05] px-3.5 text-sm text-white shadow-none focus:border-[hsl(178,85%,32%)] focus:ring-1 focus:ring-[hsl(178,85%,32%)]/50 data-[placeholder]:text-white/35"
              >
                <SelectValue
                  placeholder={lang === 'fa'
                    ? 'خصوصی یا گروهی را انتخاب کنید…'
                    : lang === 'ar'
                    ? 'اختر خاصة أو جماعية…'
                    : 'Select Private or Group…'}
                />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[hsl(222,45%,14%)] text-white shadow-xl">
                {TOUR_TYPE_OPTIONS.map(opt => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="cursor-pointer focus:bg-teal-400/20 focus:text-white"
                  >
                    {opt[lang] || opt.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-white/30 text-[10px] mt-1.5">
              {lang === 'fa'
                ? 'خصوصی: رزرو برای همان مسافر/گروه اوست. گروهی: مسافران مختلف می‌توانند در یک تور شرکت کنند.'
                : lang === 'ar'
                ? 'خاصة: الحجز مخصص للمسافر أو مجموعته. جماعية: يمكن لمسافرين مختلفين الانضمام إلى نفس الجولة.'
                : 'Private: one booking reserves the tour for that traveler/party. Group: different travelers may join the same tour.'}
            </p>
          </div>

          {/* Difficulty (required) */}
          <div>
            <label htmlFor="tour-difficulty" className={labelClass}>
              {lang === 'fa' ? 'سطح دشواری' : lang === 'ar' ? 'مستوى الصعوبة' : 'Difficulty'} <span className="text-red-400">*</span>
              <span className="ms-1 text-white/40 text-[10px] font-normal">
                {lang === 'fa' ? '(الزامی)' : lang === 'ar' ? '(مطلوب)' : '(Required)'}
              </span>
            </label>
            <Select
              value={form.difficulty}
              onValueChange={value => setForm(prev => ({ ...prev, difficulty: value }))}
              dir={dir}
            >
              <SelectTrigger
                id="tour-difficulty"
                aria-required="true"
                className="w-full h-11 rounded-xl border-white/10 bg-white/[0.05] px-3.5 text-sm text-white shadow-none focus:border-[hsl(178,85%,32%)] focus:ring-1 focus:ring-[hsl(178,85%,32%)]/50 data-[placeholder]:text-white/35"
              >
                <SelectValue
                  placeholder={lang === 'fa'
                    ? 'سطح دشواری را انتخاب کنید…'
                    : lang === 'ar'
                    ? 'اختر مستوى الصعوبة…'
                    : 'Select a difficulty level…'}
                />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[hsl(222,45%,14%)] text-white shadow-xl">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="cursor-pointer focus:bg-teal-400/20 focus:text-white"
                  >
                    {opt[lang] || opt.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Theme tag chips */}
        <div>
          <label className={labelClass}>Theme (select multiple)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {THEMES.map(th => (
              <button type="button" key={th.value} onClick={() => toggleTheme(th.value)}
                className={selectedThemes.includes(th.value) ? tagOn : tagOff}>
                {th[lang] || th.en}
              </button>
            ))}
            {selectedThemes.filter(v => !THEMES.find(th => th.value === v)).map(v => (
              <button type="button" key={v} onClick={() => toggleTheme(v)} className={tagOn}>✏️ {v}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={customTheme} onChange={e => setCustomTheme(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTheme())}
              className={inputClass} placeholder="+ Add custom theme..." />
            <button type="button" onClick={addCustomTheme}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:border-teal-400 hover:text-white transition whitespace-nowrap">
              Add
            </button>
          </div>
        </div>

        {/* Highlights */}
        <div>
          <label className={labelClass}>Highlights (one per line)</label>
          <textarea name="highlights" value={form.highlights} onChange={handleChange} rows={4} className={`${inputClass} resize-none`} placeholder={"Visit the Great Mosque of Isfahan\nExplore Naghsh-e Jahan Square\nTraditional Persian cooking class"} />
        </div>

        {/* Itinerary */}
        <div>
          <label className={labelClass}>Day-by-Day Itinerary</label>
          <textarea name="itinerary" value={form.itinerary} onChange={handleChange} rows={5} className={`${inputClass} resize-none`} placeholder={"Day 1: Arrival in Tehran...\nDay 2: Flight to Isfahan..."} />
        </div>

        {/* What's Included — structured selections.
            Anything NOT picked here is implicitly excluded. */}
        <div>
          <label className={labelClass}>What&#39;s Included</label>
          <p className="text-white/40 text-[10px] mb-2">
            {lang === 'fa' ? 'هر آنچه انتخاب نشود، در تور لحاظ نشده محسوب می‌شود.'
              : lang === 'ar' ? 'كل ما لا تختاره يُعد غير مشمول تلقائياً.'
              : 'Anything you do not select is automatically considered "not included".'}
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-6">

            {/* ── Group 1: Accommodation ── */}
            <div>
              <p className="text-white/70 text-xs font-semibold mb-3">
                {lang === 'fa' ? 'محل اقامت' : lang === 'ar' ? 'الإقامة' : 'Accommodation'}
              </p>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="inc-accommodation"
                  checked={included.accommodationEnabled}
                  onCheckedChange={(v) => setIncluded(prev => ({
                    ...prev,
                    accommodationEnabled: !!v,
                    // Clear the sub-selection when toggling off.
                    accommodationType: v ? prev.accommodationType : '',
                  }))}
                  className="border-white/40 data-[state=checked]:bg-teal-400 data-[state=checked]:text-[hsl(222,45%,14%)] data-[state=checked]:border-teal-400"
                />
                <Label htmlFor="inc-accommodation" className="text-white text-sm cursor-pointer m-0">
                  {lang === 'fa' ? 'اقامت شامل شود'
                    : lang === 'ar' ? 'الإقامة مشمولة'
                    : 'Accommodation included'}
                </Label>
              </div>

              <AnimatePresence initial={false}>
                {included.accommodationEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 ms-7 space-y-3">
                      <div>
                        <Label className="text-white/50 text-xs mb-1.5 block">
                          {lang === 'fa' ? 'نوع اقامت' : lang === 'ar' ? 'نوع الإقامة' : 'Type'}
                        </Label>
                        <Select
                          value={included.accommodationType}
                          onValueChange={(v) => setIncludedField('accommodationType', v)}
                          dir={dir}
                        >
                          <SelectTrigger className="w-full md:w-80 bg-white/[0.05] border-white/10 text-white text-sm h-10 rounded-xl">
                            <SelectValue
                              placeholder={
                                lang === 'fa' ? 'یک نوع را انتخاب کنید'
                                  : lang === 'ar' ? 'اختر النوع'
                                  : 'Select a type…'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOMMODATION_TYPES.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt[lang] || opt.en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <AnimatePresence initial={false}>
                        {['hotel', 'traditional'].includes(included.accommodationType) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div>
                              <Label className="text-white/50 text-xs mb-1.5 block">
                                {included.accommodationType === 'traditional'
                                  ? (lang === 'fa' ? 'درجه خانه سنتی' : lang === 'ar' ? 'تصنيف المنزل التقليدي' : 'Traditional house rating')
                                  : (lang === 'fa' ? 'ستاره هتل' : lang === 'ar' ? 'تصنيف الفندق' : 'Hotel star rating')}
                              </Label>
                              <Select
                                value={String(included.hotelStars)}
                                onValueChange={(v) => setIncludedField('hotelStars', Number(v))}
                                dir={dir}
                              >
                                <SelectTrigger className="w-full md:w-40 bg-white/[0.05] border-white/10 text-white text-sm h-10 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {HOTEL_STAR_LEVELS.map(s => (
                                    <SelectItem key={s} value={String(s)}>{s}★</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ── Group 2: Transportation ── */}
            <div>
              <p className="text-white/70 text-xs font-semibold mb-3">
                {lang === 'fa' ? 'حمل و نقل' : lang === 'ar' ? 'النقل' : 'Transportation'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRANSPORTATION_OPTIONS.map(opt => {
                  const id = `inc-t-${opt.value}`;
                  const checked = included.transportation.includes(opt.value);
                  return (
                    <div key={opt.value} className="flex items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => toggleTransport(opt.value)}
                        className="border-white/40 data-[state=checked]:bg-teal-400 data-[state=checked]:text-[hsl(222,45%,14%)] data-[state=checked]:border-teal-400"
                      />
                      <Label htmlFor={id} className="text-white/85 text-sm cursor-pointer m-0">
                        {opt[lang] || opt.en}
                      </Label>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="inc-t-other"
                    checked={customTransportationEnabled}
                    onCheckedChange={toggleCustomTransportation}
                    className="border-white/40 data-[state=checked]:bg-teal-400 data-[state=checked]:text-[hsl(222,45%,14%)] data-[state=checked]:border-teal-400"
                  />
                  <Label htmlFor="inc-t-other" className="text-white/85 text-sm cursor-pointer m-0">
                    {lang === 'fa' ? 'سایر' : lang === 'ar' ? 'أخرى' : 'Other'}
                  </Label>
                </div>
              </div>
              {customTransportationValues.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {customTransportationValues.map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleTransport(value)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-teal-400/40 bg-teal-400/15 text-white text-xs"
                        title={lang === 'fa' ? 'حذف' : 'Remove'}
                      >
                        {value}<X className="w-3 h-3" />
                      </button>
                    ))}
                </div>
              )}
              <AnimatePresence initial={false}>
                {customTransportationEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        value={customTransportation}
                        onChange={event => setCustomTransportation(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addCustomTransportation();
                          }
                        }}
                        className={inputClass}
                        maxLength={80}
                        aria-label={lang === 'fa' ? 'نوع دیگر حمل‌ونقل' : lang === 'ar' ? 'وسيلة نقل أخرى' : 'Other transportation'}
                        placeholder={lang === 'fa' ? 'مثلاً قایق، دوچرخه یا خودروی آفرود…' : lang === 'ar' ? 'مثلاً قارب أو دراجة أو سيارة دفع رباعي…' : 'e.g. boat, bicycle, or 4×4 vehicle…'}
                      />
                      <button
                        type="button"
                        onClick={addCustomTransportation}
                        disabled={!customTransportation.trim()}
                        className="px-4 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:border-teal-400 hover:text-white transition whitespace-nowrap disabled:opacity-40"
                      >
                        {lang === 'fa' ? 'افزودن' : lang === 'ar' ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ── Group 3: Meals ── */}
            <div>
              <p className="text-white/70 text-xs font-semibold mb-3">
                {lang === 'fa' ? 'وعده‌های غذایی' : lang === 'ar' ? 'الوجبات' : 'Meals'}
              </p>
              <Select
                value={included.meals}
                onValueChange={(v) => setIncludedField('meals', v)}
                dir={dir}
              >
                <SelectTrigger className="w-full md:w-80 bg-white/[0.05] border-white/10 text-white text-sm h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEALS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt[lang] || opt.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ── Group 4: Other ── */}
            <div>
              <p className="text-white/70 text-xs font-semibold mb-3">
                {lang === 'fa' ? 'دیگر' : lang === 'ar' ? 'أخرى' : 'Other'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {OTHER_OPTIONS.map(opt => {
                  const id = `inc-o-${opt.value}`;
                  const checked = included.other.includes(opt.value);
                  return (
                    <div key={opt.value} className="flex items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => toggleOther(opt.value)}
                        className="border-white/40 data-[state=checked]:bg-teal-400 data-[state=checked]:text-[hsl(222,45%,14%)] data-[state=checked]:border-teal-400"
                      />
                      <Label htmlFor={id} className="text-white/85 text-sm cursor-pointer m-0">
                        {opt[lang] || opt.en}
                      </Label>
                    </div>
                  );
                })}
              </div>
              {included.other.some(value => !OTHER_OPTIONS.some(opt => opt.value === value)) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {included.other
                    .filter(value => !OTHER_OPTIONS.some(opt => opt.value === value))
                    .map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleOther(value)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-teal-400/40 bg-teal-400/15 text-white text-xs"
                        title={lang === 'fa' ? 'حذف' : 'Remove'}
                      >
                        {value}<X className="w-3 h-3" />
                      </button>
                    ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={customOther}
                  onChange={event => setCustomOther(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addCustomOther();
                    }
                  }}
                  className={inputClass}
                  maxLength={100}
                  placeholder={lang === 'fa' ? 'خدمت یا مورد دیگری اضافه کنید…' : lang === 'ar' ? 'أضف خدمة أو عنصراً آخر…' : 'Add another included item…'}
                />
                <button
                  type="button"
                  onClick={addCustomOther}
                  disabled={!customOther.trim()}
                  className="px-4 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:border-teal-400 hover:text-white transition whitespace-nowrap disabled:opacity-40"
                >
                  {lang === 'fa' ? 'بیشتر اضافه کن' : lang === 'ar' ? 'إضافة المزيد' : 'Add More'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Image drag-and-drop upload */}
        <div>
          <label className={labelClass}>Main Image</label>
          <div
            onDrop={e => { e.preventDefault(); handleImageUpload(e.dataTransfer.files[0]); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 transition-all"
          >
            {uploadingMain ? (
              <div className="flex flex-col items-center gap-2 text-white/50">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Uploading...</p>
              </div>
            ) : imageUrl ? (
              <div className="relative" onClick={e => e.stopPropagation()}>
                <img decoding="async" loading="lazy" src={imageUrl} className="w-full h-48 object-cover rounded-lg" alt="main" />
                <button type="button" onClick={() => { setImageUrl(''); setMainImageCaption(''); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500/80 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/40">
                <Upload className="w-8 h-8" />
                <p className="text-sm">📷 Drop image here or click to browse</p>
                <p className="text-xs">JPG, PNG, WEBP</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleImageUpload(e.target.files[0])} />
          </div>
          {imageUrl && (
            <input
              type="text"
              maxLength={180}
              value={mainImageCaption}
              onChange={e => setMainImageCaption(e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder={lang === 'fa' ? 'توضیح کوتاه عکس اصلی…' : lang === 'ar' ? 'وصف قصير للصورة الرئيسية…' : 'Short caption for the main image…'}
            />
          )}
        </div>

        {/* Gallery multi-image upload */}
        <div>
          <label className={labelClass}>Gallery Images ({galleryUrls.length}/10)</label>
          {galleryUrls.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {galleryUrls.map((url, i) => (
                <div key={`${url}-${i}`} className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                  <div className="relative aspect-video group">
                    <img decoding="async" loading="lazy" src={url} alt={`g${i}`} className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => {
                        setGalleryUrls(prev => prev.filter((_, idx) => idx !== i));
                        setGalleryCaptions(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-500/80">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={180}
                    value={galleryCaptions[i] || ''}
                    onChange={e => setGalleryCaptions(prev => galleryUrls.map((_, idx) => idx === i ? e.target.value : (prev[idx] || '')))}
                    className="w-full px-3 py-2 bg-transparent text-white text-xs placeholder:text-white/25 outline-none border-t border-white/10"
                    placeholder={lang === 'fa' ? 'این تصویر کجاست و چیست؟' : lang === 'ar' ? 'أين التقطت هذه الصورة وما هي؟' : 'Where is this and what does it show?'}
                  />
                </div>
              ))}
            </div>
          )}
          {galleryUrls.length < 10 && (
            <div
              onDrop={e => { e.preventDefault(); handleGalleryUpload(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => galleryRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 transition-all"
            >
              {uploadingGallery ? (
                <div className="flex flex-col items-center gap-2 text-white/50">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-sm">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/40">
                  <Upload className="w-6 h-6" />
                  <p className="text-sm">Add up to {10 - galleryUrls.length} more images</p>
                </div>
              )}
              <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleGalleryUpload(e.target.files)} />
            </div>
          )}

          {/* Add an external image by pasting its URL — shares the same limit. */}
          {galleryUrls.length < 10 && (
            <form onSubmit={handleAddGalleryUrl} className="flex gap-2">
              <input
                type="url"
                value={pasteUrl}
                onChange={e => setPasteUrl(e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder={
                  lang === 'fa' ? 'یا یک نشانی تصویر (URL) بچسبانید…'
                  : lang === 'ar' ? 'أو الصق رابط صورة (URL)…'
                  : '…or paste an image URL'
                }
              />
              <button
                type="submit"
                disabled={!pasteUrl.trim()}
                className="px-4 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:border-teal-400 hover:text-white transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lang === 'fa' ? 'افزودن' : lang === 'ar' ? 'إضافة' : 'Add'}
              </button>
            </form>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[hsl(178,85%,32%)] text-white font-semibold text-sm hover:bg-[hsl(178,85%,28%)] disabled:opacity-60 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? t('dashboard_saving') : editing ? t('dashboard_update_tour') : t('dashboard_save_tour')}
          </button>
        </div>
      </form>
    </div>
  );
}
