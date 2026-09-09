import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const localizedText = (option, lang) => option?.[lang] || option?.en || option?.key || '';

export default function FilterDropdown({
  label,
  value,
  options,
  onChange,
  lang,
  icon: Icon = null,
  searchable = false,
  multiple = false,
  inactiveKey = 'all',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const normalizedLabel = String(label || '').trim().toLocaleLowerCase();
  const isLanguageFilter = ['language', 'زبان', 'اللغة'].includes(normalizedLabel);

  // Guides/Agencies use rating + review-specific sort choices. Keep their
  // visible sort menu aligned with the requested UX without forcing each page
  // to duplicate presentation logic: Recommended -> Highest Review, Newest is
  // removed. Tour Packages use the same dropdown but their own option set.
  const isProfileSort = inactiveKey === 'recommended'
    && options.some(option => option.key === 'rating')
    && options.some(option => option.key === 'reviews');

  const displayOptions = isProfileSort
    ? options
        .filter(option => option.key !== 'newest')
        .map(option => option.key === 'recommended'
          ? {
              ...option,
              en: 'Highest Review',
              fa: 'بالاترین امتیاز نظرات',
              ar: 'أعلى التقييمات',
            }
          : option)
    : options;

  const selectedValues = multiple
    ? (Array.isArray(value) ? value : value && value !== inactiveKey ? [value] : [])
    : [];
  const selected = displayOptions.find(option => option.key === value) || displayOptions[0];
  const isActive = multiple ? selectedValues.length > 0 : value !== inactiveKey;

  const selectedText = multiple
    ? selectedValues.length === 0
      ? localizedText(displayOptions[0], lang)
      : selectedValues.length === 1
        ? (() => {
            const option = displayOptions.find(item => item.key === selectedValues[0]);
            return localizedText(option, lang) || selectedValues[0];
          })()
        : lang === 'fa'
          ? `${selectedValues.length} مقصد`
          : lang === 'ar'
            ? `${selectedValues.length} وجهات`
            : `${selectedValues.length} destinations`
    : `${selected?.icon ? `${selected.icon} ` : ''}${localizedText(selected, lang)}`;

  const effectiveSearchable = searchable || isLanguageFilter;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = !normalizedQuery
    ? displayOptions
    : displayOptions.filter((option, index) => index === 0 || ['en', 'fa', 'ar', 'key'].some((field) =>
        String(option[field] || '').toLocaleLowerCase().includes(normalizedQuery)
      ));

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const clearCurrent = () => {
    onChange(multiple ? [] : inactiveKey);
    close();
  };

  const searchPlaceholder = isLanguageFilter
    ? (lang === 'fa' ? 'جستجوی زبان…' : lang === 'ar' ? 'ابحث عن لغة…' : 'Search language…')
    : (lang === 'fa' ? 'جستجوی شهر یا روستا…' : lang === 'ar' ? 'ابحث عن مدينة أو قرية…' : 'Search city or village…');

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full min-w-0 sm:flex-1 sm:min-w-[130px]">
      <div
        className={`w-full min-w-0 flex items-stretch rounded-xl border font-body text-sm transition-all duration-200 overflow-hidden
          ${isActive
            ? 'border-accent/70 bg-accent/10 text-accent'
            : 'border-border/50 bg-card/60 text-foreground/70 hover:border-accent/40 hover:text-foreground'
          } backdrop-blur-sm`}
      >
        <button
          type="button"
          onClick={() => setOpen(current => !current)}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 px-4 py-3 text-start"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />}
            <span className="text-[11px] uppercase tracking-wider opacity-60 hidden sm:block">{label}</span>
            <span className={`min-w-0 font-medium truncate ${isActive ? 'text-accent' : ''}`}>
              {selectedText}
            </span>
          </span>
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {isActive && (
          <button
            type="button"
            onClick={clearCurrent}
            aria-label={lang === 'fa' ? `حذف فیلتر ${label}` : lang === 'ar' ? `مسح فلتر ${label}` : `Clear ${label} filter`}
            title={lang === 'fa' ? 'حذف این فیلتر' : lang === 'ar' ? 'مسح هذا الفلتر' : 'Clear this filter'}
            className="flex w-9 flex-shrink-0 items-center justify-center border-s border-current/10 text-current/60 hover:bg-accent/10 hover:text-accent transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 start-0 z-50 w-full min-w-0 sm:min-w-full sm:w-72 max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 py-2 overflow-hidden">
          <div className="px-4 pb-2 mb-1 border-b border-border/30">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-1.5">
              <span className="text-accent text-xs">❖</span> {label}
            </p>
          </div>

          {effectiveSearchable && (
            <div className="px-3 pb-2 border-b border-border/30">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full min-w-0 ps-9 pe-3 py-2 rounded-lg border border-border/60 bg-background/80 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
                />
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1 overscroll-contain">
            {visibleOptions.map(option => {
              const checked = multiple
                ? (option.key === inactiveKey ? selectedValues.length === 0 : selectedValues.includes(option.key))
                : option.key === value;

              return (
                <button
                  type="button"
                  key={option.key}
                  onClick={() => {
                    if (!multiple) {
                      onChange(option.key);
                      close();
                      return;
                    }

                    if (option.key === inactiveKey) {
                      onChange([]);
                      return;
                    }

                    onChange(checked
                      ? selectedValues.filter(item => item !== option.key)
                      : [...selectedValues, option.key]);
                  }}
                  className={`w-full min-w-0 flex items-center gap-3 px-4 py-2.5 text-sm font-body text-start transition-colors
                    ${checked
                      ? 'text-accent bg-accent/10 font-semibold'
                      : 'text-foreground/70 hover:bg-accent/5 hover:text-foreground'
                    }`}
                >
                  {option.icon && <span className="w-5 flex-shrink-0 text-center text-base">{option.icon}</span>}
                  <span className="min-w-0 break-words">{localizedText(option, lang)}</span>
                  {checked && option.key !== inactiveKey && <X className="ms-auto w-3.5 h-3.5 flex-shrink-0 text-accent" />}
                  {checked && option.key === inactiveKey && <span className="ms-auto flex-shrink-0 text-accent text-xs">✓</span>}
                </button>
              );
            })}

            {visibleOptions.length === 0 && (
              <p className="px-4 py-5 text-center text-xs text-muted-foreground">
                {isLanguageFilter
                  ? (lang === 'fa' ? 'زبانی پیدا نشد' : lang === 'ar' ? 'لم يتم العثور على لغة' : 'No language found')
                  : (lang === 'fa' ? 'مقصدی پیدا نشد' : lang === 'ar' ? 'لم يتم العثور على وجهة' : 'No destination found')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
