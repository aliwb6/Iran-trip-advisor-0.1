import {
  useState } from 'react';
import { Camera,
  Check,
  X,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { avatarFor } from '@/lib/avatar';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { transformImage, imgPresets } from '@/lib/imageTransform';

// Premium circular avatar with hover edit overlay. Clicking opens a small
// URL prompt (matches the existing ProfileView/GalleryView pattern in
// Dashboard.jsx, which is URL-based rather than direct file upload).
export default function UserAvatar({ profile, userId, onSave, size = 132, editable = true }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError('');
    try {
      const value = url.trim();
      const { error: err } = await supabase
        .from('profiles')
        .update({ avatar_url: value || null })
        .eq('id', userId);
      if (err) throw err;
      onSave?.({ ...(profile || {}), avatar_url: value || null });
      setOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setUrl(profile?.avatar_url || '');
    setError('');
    setOpen(false);
  };

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full border-2 border-gold/60 shadow-[0_8px_40px_rgba(0,0,0,0.45)] overflow-hidden bg-navy"
      >
        <img decoding="async" loading="lazy"
          src={transformImage(avatarFor(profile), imgPresets.avatar)}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {editable && (
        <button
          onClick={() => setOpen(true)}
          className="absolute bottom-0 end-0 w-10 h-10 rounded-full bg-gold hover:bg-gold-light text-navy shadow-lg flex items-center justify-center transition-all border-2 border-background"
          aria-label="Change avatar"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}

      {open && (
        <div className="absolute top-full mt-3 start-1/2 -translate-x-1/2 w-72 z-30 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl p-4">
          <p className="font-body text-xs text-muted-foreground mb-2">
            {lang === 'fa' ? 'لینک تصویر پروفایل' : lang === 'ar' ? 'رابط صورة الملف الشخصي' : 'Profile photo URL'}
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border/60 focus:border-accent text-foreground text-sm outline-none mb-3"
            dir="ltr"
            autoFocus
          />
          {error && <p className="text-destructive text-xs mb-2">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold disabled:opacity-60 transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {lang === 'fa' ? 'ذخیره' : lang === 'ar' ? 'حفظ' : 'Save'}
            </button>
            <button
              onClick={cancel}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition"
            >
              <X className="w-3.5 h-3.5" />
              {lang === 'fa' ? 'لغو' : lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
