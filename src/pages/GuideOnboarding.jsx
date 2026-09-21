import {
  useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { motion } from 'framer-motion';
import { MapPin,
  Star,
  Check,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';

const SPECIALTY_OPTIONS = [
  { en: 'History & Archaeology', fa: 'تاریخ و باستان‌شناسی', ar: 'التاريخ والآثار' },
  { en: 'Architecture', fa: 'معماری', ar: 'العمارة' },
  { en: 'Food & Cuisine', fa: 'غذا و آشپزی', ar: 'الطعام والمطبخ' },
  { en: 'Photography', fa: 'عکاسی', ar: 'التصوير' },
  { en: 'Nature & Hiking', fa: 'طبیعت‌گردی', ar: 'الطبيعة والمشي' },
  { en: 'Desert Safari', fa: 'کویرگردی', ar: 'رحلة الصحراء' },
  { en: 'Art & Handicrafts', fa: 'هنر و صنایع دستی', ar: 'الفن والحرف اليدوية' },
  { en: 'Religious Sites', fa: 'اماکن مذهبی', ar: 'المواقع الدينية' },
];

export default function GuideOnboarding() {
  const { dir, lang } = useI18n();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    city: '',
    specialty: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim() || !formData.city.trim() || !formData.specialty) {
      setError(lang === 'fa' ? 'لطفاً همه فیلدها را پر کنید' : lang === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('User not authenticated. Please log in.');
      const userId = session.user.id;

      // The profile row already exists (created by handle_new_user trigger on signup),
      // so we update it instead of inserting a new one.
      const { error: supabaseError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          bio: formData.bio,
          city: formData.city,
          specialty: formData.specialty,
          role: 'guide',
          is_approved: false,
        })
        .eq('id', userId);

      if (supabaseError) throw supabaseError;

      navigate('/');
      window.location.reload();
    } catch (err) {
      setError(err.message || (lang === 'fa' ? 'خطا در ذخیره پروفایل' : lang === 'ar' ? 'خطأ في حفظ الملف الشخصي' : 'Failed to save profile'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 mb-4">
            <Star className="w-8 h-8 text-gold" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
            {lang === 'fa' ? 'پروفایل راهنمای خود را بسازید' : lang === 'ar' ? 'أنشئ ملفك الشخصي كمرشد' : 'Create Your Guide Profile'}
          </h1>
          <p className="font-body text-muted-foreground">
            {lang === 'fa' ? 'اطلاعات خود را وارد کنید. پروفایل شما پس از تأیید ادمین نمایش داده می‌شود.' : lang === 'ar' ? 'أدخل معلوماتك. سيتم عرض ملفك بعد موافقة المسؤول.' : 'Enter your details. Your profile will be visible after admin approval.'}
          </p>
        </div>

        <div className="bg-card rounded-3xl border border-border/50 p-8 shadow-warm">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 font-body text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 p-4 rounded-xl bg-gold/10 border border-gold/20 font-body text-sm text-foreground/70 flex items-start gap-2">
            <Check className="w-4 h-4 text-gold mt-0.5 shrink-0" />
            <span>
              {lang === 'fa' ? 'پس از ذخیره، ادمین پروفایل شما را بررسی و تأیید می‌کند.' : lang === 'ar' ? 'بعد الحفظ، سيراجع المسؤول ملفك ويوافق عليه.' : 'After saving, an admin will review and approve your profile.'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-body text-sm text-muted-foreground mb-1.5">
                {lang === 'fa' ? 'نام کامل' : lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={e => handleChange('full_name', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50`}
                placeholder={lang === 'fa' ? 'نام شما' : lang === 'ar' ? 'اسمك' : 'Your name'}
              />
            </div>

            <div>
              <label className="block font-body text-sm text-muted-foreground mb-1.5">
                {lang === 'fa' ? 'شهر' : lang === 'ar' ? 'المدينة' : 'City'}
              </label>
              <div className="relative">
                <MapPin className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${dir === 'rtl' ? 'end-4' : 'start-4'}`} />
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={e => handleChange('city', e.target.value)}
                  className={`w-full ${dir === 'rtl' ? 'pe-11 ps-4' : 'ps-11 pe-4'} py-3 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50`}
                  placeholder={lang === 'fa' ? 'تهران، اصفهان، شیراز...' : lang === 'ar' ? 'طهران، أصفهان، شيراز...' : 'Tehran, Isfahan, Shiraz...'}
                />
              </div>
            </div>

            <div>
              <label className="block font-body text-sm text-muted-foreground mb-1.5">
                {lang === 'fa' ? 'تخصص' : lang === 'ar' ? 'التخصص' : 'Specialty'}
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTY_OPTIONS.map(opt => (
                  <button
                    key={opt.en}
                    type="button"
                    onClick={() => handleChange('specialty', opt.en)}
                    className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all duration-200 border ${
                      formData.specialty === opt.en
                        ? 'bg-accent text-white border-accent'
                        : 'bg-card text-muted-foreground border-border hover:border-accent/50 hover:text-foreground'
                    }`}
                  >
                    {opt[lang] || opt.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-body text-sm text-muted-foreground mb-1.5">
                {lang === 'fa' ? 'درباره شما' : lang === 'ar' ? 'عنك' : 'About You'}
              </label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={e => handleChange('bio', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background font-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                placeholder={lang === 'fa' ? 'تجربه و تخصص خود را بنویسید...' : lang === 'ar' ? 'اكتب عن خبرتك...' : 'Write about your experience...'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-white font-body font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading
                ? (lang === 'fa' ? 'در حال ذخیره...' : lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                : (lang === 'fa' ? 'ذخیره پروفایل' : lang === 'ar' ? 'حفظ الملف الشخصي' : 'Save Profile')}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}