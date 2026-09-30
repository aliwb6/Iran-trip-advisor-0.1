import { TransitionSurface } from '@/components/ui/TransitionSurface';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, SlidersHorizontal, X, Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';

// ── FiltersShell ─────────────────────────────────────────────────────────────
// Sticky sidebar on desktop, slide-up drawer on mobile. Hosts the filter
// sections plus a "Clear all" footer. Pages pass their sections as children.
export function FiltersShell({ children, activeCount = 0, onClearAll }) {
  const { lang, dir } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  const tx = {
    filters: lang === 'fa' ? 'فیلترها' : lang === 'ar' ? 'الفلاتر' : 'Filters',
    clearAll: lang === 'fa' ? 'پاک کردن همه' : lang === 'ar' ? 'مسح الكل' : 'Clear all',
    apply: lang === 'fa' ? 'اعمال' : lang === 'ar' ? 'تطبيق' : 'Apply filters',
  };

  const header = (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-gold" />
        <span className="font-heading text-sm font-semibold text-foreground">{tx.filters}</span>
        {activeCount > 0 && (
          <span className="ms-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </div>
      {activeCount > 0 && (
        <button
          onClick={onClearAll}
          className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition"
        >
          {tx.clearAll}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger pill */}
      <div className="lg:hidden mb-5">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border/60 text-sm font-medium text-foreground hover:border-accent/40 transition"
        >
          <SlidersHorizontal className="w-4 h-4 text-gold" />
          {tx.filters}
          {activeCount > 0 && (
            <span className="ms-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop sticky sidebar */}
      <aside className="hidden lg:block w-72 flex-shrink-0">
        <div className="sticky top-24 bg-card border border-border/40 rounded-2xl overflow-hidden">
          {header}
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {children}
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <TransitionSurface kind="backdrop"
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setMobileOpen(false)}
          >
            <motion.div
              dir={dir}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-card rounded-t-3xl border-t border-border/40 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-gold" />
                  <span className="font-heading text-sm font-semibold text-foreground">{tx.filters}</span>
                  {activeCount > 0 && (
                    <span className="ms-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[10px] font-bold">
                      {activeCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-muted/60 text-muted-foreground flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{children}</div>
              <div className="flex items-center gap-3 px-5 py-4 border-t border-border/40">
                {activeCount > 0 && (
                  <button
                    onClick={() => { onClearAll?.(); }}
                    className="flex-1 py-2.5 rounded-full border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    {tx.clearAll}
                  </button>
                )}
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition"
                >
                  {tx.apply}
                </button>
              </div>
            </motion.div>
          </TransitionSurface>
        )}
      </AnimatePresence>
    </>
  );
}

// ── FilterSection ────────────────────────────────────────────────────────────
// Collapsible labelled section. Defaults open. Pages compose these in order
// inside <FiltersShell>.
export function FilterSection({ label, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-start"
      >
        <span className="font-body text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MultiSelectChips ─────────────────────────────────────────────────────────
// Used for city / language / specialty / tour-type selections. `value` is an
// array of currently selected option `value`s; `onChange` returns the updated
// array.
export function MultiSelectChips({ options, value = [], onChange }) {
  const toggle = (v) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
              selected
                ? 'bg-accent border-accent text-white'
                : 'border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── SingleSelectChips ────────────────────────────────────────────────────────
// Same UI as multi-select but only one value at a time. Click again to clear.
export function SingleSelectChips({ options, value = '', onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(selected ? '' : opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
              selected
                ? 'bg-accent border-accent text-white'
                : 'border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── RatingFilter ─────────────────────────────────────────────────────────────
// 3+ / 4+ / 5 segmented selector. Value is the minimum rating (0 = any).
export function RatingFilter({ value = 0, onChange }) {
  const opts = [3, 4, 5];
  return (
    <div className="flex gap-1.5">
      {opts.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            onClick={() => onChange(selected ? 0 : n)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
              selected
                ? 'bg-gold border-gold text-navy'
                : 'border-border/60 text-muted-foreground hover:border-gold/40 hover:text-foreground'
            }`}
          >
            <Star className={`w-3 h-3 ${selected ? 'fill-navy text-navy' : 'fill-gold text-gold'}`} />
            {n}{n < 5 ? '+' : ''}
          </button>
        );
      })}
    </div>
  );
}

// ── PriceRange ───────────────────────────────────────────────────────────────
// Two numeric inputs (min / max) in USD. `value` is `{ min: number|null,
// max: number|null }`. Empty → null. Applied client-side as a >=/<= bound.
export function PriceRange({ value = { min: null, max: null }, onChange, currency = '$' }) {
  const { lang } = useI18n();
  const labels = {
    min: lang === 'fa' ? 'حداقل' : lang === 'ar' ? 'الأدنى' : 'Min',
    max: lang === 'fa' ? 'حداکثر' : lang === 'ar' ? 'الأقصى' : 'Max',
  };
  const handle = (key) => (e) => {
    const raw = e.target.value;
    const num = raw === '' ? null : Number(raw);
    onChange({ ...value, [key]: Number.isFinite(num) ? num : null });
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <label className="block text-[10px] text-muted-foreground mb-1">{labels.min} ({currency})</label>
        <input
          type="number"
          min="0"
          value={value.min ?? ''}
          onChange={handle('min')}
          placeholder="0"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:border-accent transition"
        />
      </div>
      <span className="text-muted-foreground mt-5">—</span>
      <div className="flex-1">
        <label className="block text-[10px] text-muted-foreground mb-1">{labels.max} ({currency})</label>
        <input
          type="number"
          min="0"
          value={value.max ?? ''}
          onChange={handle('max')}
          placeholder="∞"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:border-accent transition"
        />
      </div>
    </div>
  );
}

// ── ToggleRow ────────────────────────────────────────────────────────────────
export function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="font-body text-sm text-foreground/85">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors ${
          checked ? 'bg-accent' : 'bg-muted/80'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

// ── ActiveChips ──────────────────────────────────────────────────────────────
// Renders the currently active filters as removable chips above the results
// grid. `chips` is `[{ key, label, onRemove }]` from the parent's filter
// summarisation — the parent decides what to label each one.
export function ActiveChips({ chips = [] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-xs font-medium text-accent hover:bg-accent hover:text-white transition"
        >
          {chip.label}
          <X className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}
