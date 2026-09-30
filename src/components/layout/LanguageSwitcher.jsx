import SmoothDropdown from '@/components/smooth-dropdown';
import { useI18n } from '@/lib/i18n.jsx';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/supabaseClient';
import { Globe, Languages } from 'lucide-react';

const languages = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'fa', label: 'فا', full: 'فارسی' },
  { code: 'ar', label: 'ع', full: 'العربية' },
];

export default function LanguageSwitcher() {
  const { lang, dir, switchLang } = useI18n();
  const { isAuthenticated } = useAuth();

  const current = languages.find(l => l.code === lang);

  const handleLanguageChange = (code) => {
    switchLang(code);

    if (isAuthenticated) {
      void supabase.rpc('set_preferred_language', { language: code }).then(({ error }) => {
        if (error) console.warn('Could not persist preferred language for transactional emails:', error.message);
      });
    }
  };

  return (
    <SmoothDropdown
      triggerLabel="Switch language"
      dir={dir}
      activeId={lang}
      contentWidth="min(10rem, calc(100vw - 2rem))"
      items={languages.map((language) => ({
        id: language.code,
        label: `${language.full} · ${language.label}`,
        icon: Languages,
        onSelect: () => handleLanguageChange(language.code),
      }))}
      triggerClassName="flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 hover:border-accent/50 transition-all duration-300 bg-background/50 backdrop-blur-sm"
      trigger={() => (
        <>
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-body font-medium text-foreground">{current?.label}</span>
        </>
      )}
    />
  );
}
