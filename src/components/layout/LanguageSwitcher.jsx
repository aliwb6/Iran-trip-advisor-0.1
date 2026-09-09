import { useI18n } from '@/lib/i18n.jsx';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/supabaseClient';
import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'fa', label: 'فا', full: 'فارسی' },
  { code: 'ar', label: 'ع', full: 'العربية' },
];

export default function LanguageSwitcher() {
  const { lang, switchLang } = useI18n();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = languages.find(l => l.code === lang);

  const handleLanguageChange = (code) => {
    switchLang(code);
    setOpen(false);

    if (isAuthenticated) {
      void supabase.rpc('set_preferred_language', { language: code }).then(({ error }) => {
        if (error) console.warn('Could not persist preferred language for transactional emails:', error.message);
      });
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 hover:border-accent/50 transition-all duration-300 bg-background/50 backdrop-blur-sm"
        aria-label="Switch language"
      >
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-body font-medium">{current?.label}</span>
      </button>

      {open && (
          <div
            className="absolute top-full mt-2 end-0 bg-white dark:bg-gray-900 border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px] z-50"
          >
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`w-full px-4 py-3 flex items-center justify-between text-sm font-body hover:bg-accent/5 transition-colors ${
                  lang === l.code ? 'text-accent font-medium bg-accent/5' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                <span>{l.full}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{l.label}</span>
              </button>
            ))}
          </div>
      )}
    </div>
  );
}
