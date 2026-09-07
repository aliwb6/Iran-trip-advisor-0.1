import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export default function FilterDropdown({ label, value, options, onChange, lang, icon: Icon = null, searchable = false, multiple = false, inactiveKey = 'all' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const selectedValues = multiple ? (Array.isArray(value) ? value : value && value !== inactiveKey ? [value] : []) : [];
  const selected = options.find(o => o.key === value) || options[0];
  const isActive = multiple ? selectedValues.length > 0 : value !== inactiveKey;
  const selectedText = multiple
    ? selectedValues.length === 0
      ? (options[0]?.[lang] || options[0]?.en)
      : selectedValues.length === 1
        ? (() => {
            const option = options.find(item => item.key === selectedValues[0]);
            return option?.[lang] || option?.en || selectedValues[0];
          })()
        : lang === 'fa'
          ? `${selectedValues.length} مقصد`
          : lang === 'ar'
            ? `${selectedValues.length} وجهات`
            : `${selectedValues.length} destinations`
    : `${selected.icon ? `${selected.icon} ` : ''}${selected[lang] || selected.en}`;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = !normalizedQuery
    ? options
    : options.filter((option, index) => index === 0 || ['en', 'fa', 'ar', 'key'].some((field) =>
        String(option[field] || '').toLocaleLowerCase().includes(normalizedQuery)
      ));

  const close = () => { setOpen(false); setQuery(''); };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full min-w-0 sm:flex-1 sm:min-w-[130px]">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full min-w-0 flex items-center justify-between gap-2 px-4 py-3 rounded-xl border font-body text-sm transition-all duration-200
          ${isActive
            ? 'border-accent/70 bg-accent/10 text-accent'
            : 'border-border/50 bg-card/60 text-foreground/70 hover:border-accent/40 hover:text-foreground'
          } backdrop-blur-sm`}
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

      {open && (
        <div className="absolute top-full mt-2 start-0 z-50 w-full min-w-0 sm:min-w-full sm:w-72 max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 py-2 overflow-hidden">
          <div className="px-4 pb-2 mb-1 border-b border-border/30">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-1.5">
              <span className="text-accent text-xs">❖</span> {label}
            </p>
          </div>
          {searchable && (
            <div className="px-3 pb-2 border-b border-border/30">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={lang === 'fa' ? 'جستجوی شهر یا روستا…' : lang === 'ar' ? 'ابحث عن مدينة أو قرية…' : 'Search city or village…'}
                  className="w-full min-w-0 ps-9 pe-3 py-2 rounded-lg border border-border/60 bg-background/80 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1 overscroll-contain">
          {visibleOptions.map(opt => {
            const checked = multiple
              ? (opt.key === inactiveKey ? selectedValues.length === 0 : selectedValues.includes(opt.key))
              : opt.key === value;
            return (
            <button
              key={opt.key}
              onClick={() => {
                if (!multiple) {
                  onChange(opt.key);
                  close();
                  return;
                }
                if (opt.key === inactiveKey) {
                  onChange([]);
                  return;
                }
                onChange(checked
                  ? selectedValues.filter(item => item !== opt.key)
                  : [...selectedValues, opt.key]);
              }}
              className={`w-full min-w-0 flex items-center gap-3 px-4 py-2.5 text-sm font-body text-start transition-colors
                ${checked
                  ? 'text-accent bg-accent/10 font-semibold'
                  : 'text-foreground/70 hover:bg-accent/5 hover:text-foreground'
                }`}
            >
              {opt.icon && <span className="w-5 flex-shrink-0 text-center text-base">{opt.icon}</span>}
              <span className="min-w-0 break-words">{opt[lang] || opt.en}</span>
              {checked && <span className="ms-auto flex-shrink-0 text-accent text-xs">✓</span>}
            </button>
          )})}
          {visibleOptions.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-muted-foreground">
              {lang === 'fa' ? 'مقصدی پیدا نشد' : lang === 'ar' ? 'لم يتم العثور على وجهة' : 'No destination found'}
            </p>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
