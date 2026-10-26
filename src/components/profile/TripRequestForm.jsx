import { TransitionSurface } from '@/components/ui/TransitionSurface';
import {
  useState,
  useEffect,
  useRef } from 'react';
import { motion,
  AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  MapPin,
  Car,
  Hotel,
  Calendar,
  Users,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/supabaseClient';
import { iranianCities as IRANIAN_CITIES, iranianDestinations } from '@/data/iranianCities';
import { allLanguages, mergeLanguages, popularLanguages, toLanguageOptions } from '@/data/languages';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { localize, localizeTripOption } from '@/lib/localize';

const HOLIDAY_TYPES = [
  { id: 'Active',       label: 'Active',       emoji: '🏃' },
  { id: 'Local Living', label: 'Local Living',  emoji: '🏘️' },
  { id: 'Nature',       label: 'Nature',        emoji: '🌿' },
  { id: 'Offbeat',      label: 'Offbeat',       emoji: '🗺️' },
  { id: 'Relaxing',     label: 'Relaxing',      emoji: '😌' },
];

const ADDITIONAL_SERVICES = [
  { id: 'Air Tickets',        label: 'Air Tickets',        emoji: '✈️' },
  { id: 'Train Tickets',      label: 'Train Tickets',      emoji: '🚂' },
  { id: 'Attraction Tickets', label: 'Attraction Tickets', emoji: '🎟️' },
  { id: 'Visa',               label: 'Visa',               emoji: '📋' },
  { id: 'Airport Transfer',   label: 'Airport Transfer',   emoji: '🚗' },
];

const STAR_RATINGS = [
  { stars: 1, label: 'Budget' },
  { stars: 2, label: 'Economy' },
  { stars: 3, label: 'Standard' },
  { stars: 4, label: 'Premium' },
  { stars: 5, label: 'Luxury' },
];

const HOW_IT_WORKS = [
  {
    icon: '✍️',
    title: 'Tell us your travel wishlist',
    desc: 'Share your destination, dates, and preferences',
  },
  {
    icon: '💬',
    title: 'Receive proposals from local guides',
    desc: 'Expert guides craft tailored itineraries for you',
  },
  {
    icon: '✅',
    title: 'Choose your guide',
    desc: 'Compare proposals and pick the perfect match',
  },
  {
    icon: '🌟',
    title: 'Have an unforgettable journey',
    desc: 'Experience authentic Iran with a dedicated local guide',
  },
];

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const GUIDE_LANGUAGE_OPTIONS = mergeLanguages(popularLanguages, allLanguages);
const GUIDE_LANGUAGE_LABELS = Object.fromEntries(toLanguageOptions(GUIDE_LANGUAGE_OPTIONS).map(option => [option.key, option]));
const CITY_LABELS = Object.fromEntries(iranianDestinations.map(city => [city.en, city]));
const REQUIREMENTS_MIN_LENGTH = 80;

const INITIAL_FORM = {
  destinations: [],
  start_date: '',
  end_date: '',
  arrival_hour: '09',
  arrival_minute: '00',
  arrival_period: 'AM',
  departure_hour: '09',
  departure_minute: '00',
  departure_period: 'AM',
  timings_flexible: false,
  maleAdults: 1,
  femaleAdults: 0,
  children: 0,
  guide_languages: [],
  assistance: [],
  accommodation_stars: null,
  requirements: '',
  holiday_types: [],
  additional_services: [],
  tour_type: '',
};

// ── Calendar helpers ───────────────────────────────────────────────────────

const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_HEADERS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr, lang = 'en') {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (lang === 'en') return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
  return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'ar-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function tripDays(start, end) {
  if (!start || !end) return 0;
  return Math.ceil((new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / 86400000);
}

// ── DatePickerInput ────────────────────────────────────────────────────────

function DatePickerInput({ value, onChange, otherDate }) {
  const { lang } = useI18n();
  const now = new Date();
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const wrapperRef = useRef(null);
  const todayStr   = getTodayStr();

  useEffect(() => {
    if (!open) return;
    const src = value || otherDate;
    if (src) {
      const [y, m] = src.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevMonth = () => setViewMonth(m => {
    if (m === 0) { setViewYear(y => y - 1); return 11; }
    return m - 1;
  });

  const nextMonth = () => setViewMonth(m => {
    if (m === 11) { setViewYear(y => y + 1); return 0; }
    return m + 1;
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const offsetRaw   = new Date(viewYear, viewMonth, 1).getDay();
  const offset      = offsetRaw === 0 ? 6 : offsetRaw - 1;

  const rangeStart = value && otherDate ? (value <= otherDate ? value : otherDate) : null;
  const rangeEnd   = value && otherDate ? (value <= otherDate ? otherDate : value) : null;

  const handleDayClick = (day) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (ds < todayStr) return;
    onChange(ds);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-2.5 bg-background/50 border rounded-xl text-sm text-left transition-colors ${
          open ? 'border-accent' : 'border-border/40'
        } ${value ? 'text-foreground' : 'text-muted-foreground/60'}`}
      >
        {value ? formatDateDisplay(value, lang) : localize(lang, 'Select date…', 'تاریخ را انتخاب کنید…', 'اختر التاريخ…')}
      </button>

      <AnimatePresence>
        {open && (
          <TransitionSurface kind="dropdown" data-origin="top-left"
            className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border/60 rounded-2xl shadow-2xl p-4 w-[272px]"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button" onClick={prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {lang === 'en' ? MONTH_NAMES[viewMonth] : new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'ar-u-ca-gregory', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1))}
                {lang === 'en' ? ` ${viewYear}` : ''}
              </span>
              <button
                type="button" onClick={nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-0.5">
              {DAY_HEADERS.map(d => (
                <div key={d} className="flex items-center justify-center text-[10px] font-medium text-muted-foreground/70 pb-1">
                  {lang === 'en' ? d : new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'ar-u-ca-gregory', { weekday: 'short' }).format(new Date(2024, 0, 1 + DAY_HEADERS.indexOf(d)))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: offset }, (_, i) => <div key={`p${i}`} className="h-9" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const ds = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isSelected = ds === value;
                const isOther    = ds === otherDate;
                const inRange    = rangeStart && rangeEnd && ds > rangeStart && ds < rangeEnd;
                const isToday    = ds === todayStr;
                const isPast     = ds < todayStr;

                return (
                  <div
                    key={day}
                    className={`relative flex items-center justify-center h-9 ${
                      inRange || isSelected || isOther ? 'bg-accent/10' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => !isPast && handleDayClick(day)}
                      disabled={isPast}
                      className={`relative w-8 h-8 rounded-full text-xs font-medium transition-all ${
                        isSelected || isOther
                          ? 'bg-accent text-white shadow-sm shadow-accent/40'
                          : isPast
                          ? 'text-muted-foreground/25 cursor-not-allowed'
                          : 'hover:bg-accent/20 text-foreground'
                      }`}
                    >
                      {day}
                      {isToday && !isSelected && !isOther && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </TransitionSurface>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CityMultiSelect ────────────────────────────────────────────────────────

function CityMultiSelect({ values, onChange }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const { t, lang, dir } = useI18n();

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = IRANIAN_CITIES.filter(
    c => !values.includes(c) && [c, CITY_LABELS[c]?.fa, CITY_LABELS[c]?.ar].some(label => label?.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  );

  const remove = (city) => onChange(values.filter(c => c !== city));
  const add = (city) => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return;

    const canonicalCity = IRANIAN_CITIES.find(
      option => [option, CITY_LABELS[option]?.fa, CITY_LABELS[option]?.ar].some(label => label?.toLocaleLowerCase() === trimmedCity.toLocaleLowerCase())
    ) || trimmedCity;
    const alreadySelected = values.some(
      value => value.toLocaleLowerCase() === canonicalCity.toLocaleLowerCase()
    );

    if (!alreadySelected) onChange([...values, canonicalCity]);
    setSearch('');
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={`min-h-[42px] px-3 py-2 bg-background/50 border rounded-xl flex flex-wrap gap-1.5 cursor-text transition-colors ${
          open ? 'border-accent' : 'border-border/40'
        }`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {values.map(city => (
          <span
            key={city}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/25"
          >
            {CITY_LABELS[city]?.[lang] || city}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(city); }}
              className="w-4 h-4 rounded-full hover:bg-accent/20 flex items-center justify-center transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && search.trim()) {
              e.preventDefault();
              add(search);
            }
          }}
          placeholder={values.length === 0 ? t('trip_city_placeholder') : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50 py-0.5"
        />
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <TransitionSurface kind="dropdown" data-origin="top-left"
            className="absolute left-0 top-full mt-1.5 z-50 w-full bg-card border border-border/60 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1"
          >
            {filtered.map(city => (
              <button
                key={city}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); add(city); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-start"
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {CITY_LABELS[city]?.[lang] || city}
              </button>
            ))}
          </TransitionSurface>
        )}
      </AnimatePresence>
    </div>
  );
}

function LanguageMultiSelect({ values, onChange }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const normalizedSearch = search.trim().toLocaleLowerCase();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  const hasValue = (language) => values.some(value => value.toLocaleLowerCase() === language.toLocaleLowerCase());
  const filtered = GUIDE_LANGUAGE_OPTIONS.filter(language => !hasValue(language) && [language, GUIDE_LANGUAGE_LABELS[language]?.fa, GUIDE_LANGUAGE_LABELS[language]?.ar].some(label => label?.toLocaleLowerCase().includes(normalizedSearch)));
  const exactOptionExists = GUIDE_LANGUAGE_OPTIONS.some(language => [language, GUIDE_LANGUAGE_LABELS[language]?.fa, GUIDE_LANGUAGE_LABELS[language]?.ar].some(label => label?.toLocaleLowerCase() === normalizedSearch)) || hasValue(search.trim());

  const add = (language) => {
    const clean = language.trim();
    if (!clean) return;
    const canonical = GUIDE_LANGUAGE_OPTIONS.find(option => [option, GUIDE_LANGUAGE_LABELS[option]?.fa, GUIDE_LANGUAGE_LABELS[option]?.ar].some(label => label?.toLocaleLowerCase() === clean.toLocaleLowerCase())) || clean;
    if (hasValue(canonical)) return;
    onChange([...values, canonical]);
    setSearch('');
    setOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={`min-h-[42px] px-3 py-2 bg-background/50 border rounded-xl flex flex-wrap gap-1.5 cursor-text transition-colors ${open ? 'border-accent' : 'border-border/40'}`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {values.map(language => (
          <span key={language} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/25">
            {GUIDE_LANGUAGE_LABELS[language]?.[lang] || language}
            <button type="button" aria-label={`${localize(lang, 'Remove', 'حذف', 'إزالة')} ${language}`} onClick={event => { event.stopPropagation(); onChange(values.filter(value => value !== language)); }} className="w-4 h-4 rounded-full hover:bg-accent/20 flex items-center justify-center">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={search}
          onChange={event => { setSearch(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter') {
              event.preventDefault();
              add(filtered[0] || search);
            }
          }}
          placeholder={values.length ? localize(lang, 'Search or add another language…', 'زبان دیگری جست‌وجو یا اضافه کنید…', 'ابحث عن لغة أخرى أو أضفها…') : localize(lang, 'Search or add a language…', 'زبانی جست‌وجو یا اضافه کنید…', 'ابحث عن لغة أو أضفها…')}
          className="flex-1 min-w-[190px] bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50 py-0.5"
        />
      </div>

      <AnimatePresence>
        {open && (filtered.length > 0 || (search.trim() && !exactOptionExists)) && (
          <TransitionSurface kind="dropdown" data-origin="top-left" className="absolute left-0 top-full mt-1.5 z-50 w-full bg-card border border-border/60 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1">
            {filtered.slice(0, 20).map(language => (
              <button key={language} type="button" onMouseDown={event => { event.preventDefault(); add(language); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent text-start">
                {GUIDE_LANGUAGE_LABELS[language]?.[lang] || language}
              </button>
            ))}
            {search.trim() && !exactOptionExists && (
              <button type="button" onMouseDown={event => { event.preventDefault(); add(search); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10 text-start border-t border-border/30">
                <Plus className="w-4 h-4" /> {localize(lang, 'Add', 'افزودن', 'إضافة')} “{search.trim()}”
              </button>
            )}
          </TransitionSurface>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function FieldLabel({ children }) {
  return <p className="text-sm font-medium text-foreground mb-2.5">{children}</p>;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1">{msg}</p>;
}

function Counter({ label, sublabel, value, onChange, min = 0 }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-background/50 border border-border/40">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-8 h-8 rounded-full border-2 border-border/50 flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 transition-colors"
        >
          <span className="text-base leading-none select-none">−</span>
        </button>
        <span className="w-6 text-center font-semibold text-foreground tabular-nums">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border-2 border-border/50 flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
        >
          <span className="text-base leading-none select-none">+</span>
        </button>
      </div>
    </div>
  );
}

function TimeSelect({ label, hourKey, minuteKey, periodKey, form, onChange, disabled }) {
  const cls = `bg-background/50 border border-border/40 rounded-lg px-2.5 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors`;
  return (
    <div className={`min-w-0 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-1.5">
        <select value={form[hourKey]}   onChange={e => onChange(hourKey, e.target.value)}   className={`min-w-0 flex-1 ${cls}`}>
          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={form[minuteKey]} onChange={e => onChange(minuteKey, e.target.value)} className={`min-w-0 flex-1 ${cls}`}>
          {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={form[periodKey]} onChange={e => onChange(periodKey, e.target.value)} className={`shrink-0 ${cls}`}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

function ToggleChip({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
        selected
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border/40 text-muted-foreground hover:border-accent/40 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function ToggleBlock({ selected, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
        selected
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border/40 text-muted-foreground hover:border-accent/40 hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconGridItem({ selected, onClick, emoji, label, multi = false }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
        selected
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border/40 text-muted-foreground hover:border-accent/40 hover:text-foreground'
      }`}
    >
      {selected && multi && (
        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center">
          <Check className="w-2 h-2 text-white" />
        </div>
      )}
      <span className="text-xl leading-none">{emoji}</span>
      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step, packageMode = false }) {
  const { lang } = useI18n();
  const steps = packageMode
    ? [localize(lang, 'Customization', 'شخصی‌سازی', 'تخصيص الرحلة'), localize(lang, 'Your Details', 'جزئیات سفر شما', 'تفاصيل رحلتك')]
    : [localize(lang, 'Trip Details', 'جزئیات سفر', 'تفاصيل الرحلة'), localize(lang, 'Preferences', 'ترجیحات', 'التفضيلات')];
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((label, i) => {
        const s       = i + 1;
        const done    = step > s;
        const active  = step === s;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                done   ? 'bg-accent text-white'
                : active ? 'bg-accent text-white ring-4 ring-accent/20'
                : 'bg-border/50 text-muted-foreground'
              }`}>
                {done ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
                active ? 'text-accent' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-20 h-0.5 mx-2 mb-4 rounded-full transition-all duration-300 ${
                step > 1 ? 'bg-accent' : 'bg-border/50'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PackageRequestSummary({ context, form, lang }) {
  const adults = form.maleAdults + form.femaleAdults;
  const travellers = [
    adults ? `${adults} ${localize(lang, adults === 1 ? 'Adult' : 'Adults', 'بزرگسال', 'بالغ')}` : null,
    form.children ? `${form.children} ${localize(lang, form.children === 1 ? 'Child' : 'Children', 'کودک', 'طفل')}` : null,
  ].filter(Boolean).join(', ');

  return (
    <aside className="hidden lg:flex w-[330px] shrink-0 flex-col overflow-hidden border-e border-border/50 bg-card">
      <div className="relative h-48 shrink-0 bg-muted">
        {context.image && (
          <img src={context.image} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">{context.eyebrow}</p>
          <h3 className="mt-1 font-heading text-lg font-semibold leading-snug">{context.title}</h3>
          {context.location && <p className="mt-2 flex items-center gap-1.5 text-xs text-white/80"><MapPin className="h-3.5 w-3.5" />{context.location}</p>}
        </div>
      </div>

      <div className="space-y-4 p-5 text-sm">
        <div className="flex items-start gap-2.5 text-muted-foreground">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{form.start_date && form.end_date ? `${formatDateDisplay(form.start_date, lang)} — ${formatDateDisplay(form.end_date, lang)}` : localize(lang, 'Choose your travel dates', 'تاریخ سفر را انتخاب کنید', 'اختر مواعيد سفرك')}</span>
        </div>
        <div className="flex items-start gap-2.5 text-muted-foreground">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{travellers || localize(lang, 'Choose your travellers', 'تعداد مسافران را مشخص کنید', 'حدّد عدد المسافرين')}</span>
        </div>
      </div>

      <div className="mt-auto border-t border-border/50 p-5">
        {context.price != null && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{localize(lang, 'Estimated from', 'قیمت تخمینی از', 'السعر التقديري ابتداءً من')}</span>
            <span className="font-heading text-lg font-semibold text-foreground">USD {Number(context.price).toLocaleString()}</span>
          </div>
        )}
        {context.meta && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{context.meta}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">{localize(lang, 'The final price is confirmed after your request is reviewed.', 'قیمت نهایی پس از بررسی درخواست شما تأیید می‌شود.', 'يُحدَّد السعر النهائي بعد مراجعة طلبك.')}</p>
      </div>
    </aside>
  );
}

// ── Step 1: Trip Details ───────────────────────────────────────────────────

function Step1({ form, set, toggleAssistance, errors }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const starsRef = useRef(null);

  const handleAssistanceClick = (item) => {
    const isAddingAccommodation = item === 'Accommodation'
      && !form.assistance.includes('Accommodation');

    toggleAssistance(item);

    // Only reveal the star choices after an explicit user action. Running this
    // for prefilled package data makes the modal open halfway down the form.
    if (isAddingAccommodation) {
      setTimeout(() => starsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
  };

  const handleStartDate = (v) => {
    set('start_date', v);
    if (form.end_date && form.end_date <= v) {
      set('end_date', addDays(v, 1));
    }
  };

  const handleEndDate = (v) => {
    if (form.start_date && v <= form.start_date) {
      set('end_date', addDays(form.start_date, 1));
    } else {
      set('end_date', v);
    }
  };

  const days = tripDays(form.start_date, form.end_date);

  return (
    <div className="space-y-5">
      {/* Destination — multi-city select */}
      <div>
        <FieldLabel>{l('I am travelling to', 'مقصد سفر من', 'وجهة سفري')}</FieldLabel>
        <CityMultiSelect
          values={form.destinations}
          onChange={v => set('destinations', v)}
        />
        <FieldError msg={errors?.destinations} />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">{l('Start Date', 'تاریخ شروع', 'تاريخ البداية')}</p>
          <DatePickerInput
            value={form.start_date}
            onChange={handleStartDate}
            otherDate={form.end_date}
          />
          <FieldError msg={errors?.start_date} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">{l('End Date', 'تاریخ پایان', 'تاريخ النهاية')}</p>
          <DatePickerInput
            value={form.end_date}
            onChange={handleEndDate}
            otherDate={form.start_date}
          />
          <FieldError msg={errors?.end_date} />
        </div>
      </div>
      {days > 0 && (
        <p className="text-xs text-accent font-medium -mt-2">
          {l('Trip duration:', 'مدت سفر:', 'مدة الرحلة:')} {days} {l(days !== 1 ? 'days' : 'day', 'روز', 'يوم')} {l('(minimum 1 day)', '(حداقل یک روز)', '(يوم واحد على الأقل)')}
        </p>
      )}

      {/* Times */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <TimeSelect
          label={l('Arrival Time', 'زمان ورود', 'وقت الوصول')}
          hourKey="arrival_hour" minuteKey="arrival_minute" periodKey="arrival_period"
          form={form} onChange={set} disabled={form.timings_flexible}
        />
        <TimeSelect
          label={l('Departure Time', 'زمان خروج', 'وقت المغادرة')}
          hourKey="departure_hour" minuteKey="departure_minute" periodKey="departure_period"
          form={form} onChange={set} disabled={form.timings_flexible}
        />
      </div>

      {/* Timings flexible */}
      <div
        onClick={() => set('timings_flexible', !form.timings_flexible)}
        className="flex items-center gap-3 cursor-pointer group select-none"
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          form.timings_flexible
            ? 'bg-accent border-accent'
            : 'border-border/60 group-hover:border-accent/50'
        }`}>
          {form.timings_flexible && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="text-sm text-foreground">{l('Not yet sure about my timings', 'هنوز زمان‌بندی سفرم مشخص نیست', 'لم أحدد مواعيد رحلتي بعد')}</span>
      </div>

      {/* Traveller counts */}
      <div className="space-y-2">
        <Counter label={l('Male Adults', 'بزرگسالان مرد', 'الرجال البالغون')} value={form.maleAdults} onChange={v => set('maleAdults', v)} min={0} />
        <Counter label={l('Female Adults', 'بزرگسالان زن', 'النساء البالغات')} value={form.femaleAdults} onChange={v => set('femaleAdults', v)} min={0} />
        {(form.maleAdults + form.femaleAdults) === 0 && (
          <p className="text-xs text-red-400 px-1">{l('At least 1 adult (male or female) required.', 'دست‌کم یک بزرگسال باید در سفر باشد.', 'يجب أن يرافق الرحلة شخص بالغ واحد على الأقل.')}</p>
        )}
        <FieldError msg={errors?.adults} />
        <Counter label={l('Children', 'کودکان', 'الأطفال')} sublabel={l('2–12 years', '۲ تا ۱۲ سال', 'من سنتين إلى ١٢ سنة')} value={form.children} onChange={v => set('children', v)} min={0} />
      </div>

      {/* Guide languages */}
      <div>
        <FieldLabel>{l('I need a guide who speaks', 'به راهنمایی نیاز دارم که به این زبان‌ها صحبت کند', 'أحتاج إلى مرشد يتحدث اللغات التالية')}</FieldLabel>
        <LanguageMultiSelect values={form.guide_languages} onChange={languages => set('guide_languages', languages)} />
        <FieldError msg={errors?.guide_languages} />
      </div>

      {/* Assistance */}
      <div>
        <FieldLabel>{l('I need assistance with', 'برای این موارد به کمک نیاز دارم', 'أحتاج إلى مساعدة في')}</FieldLabel>
        <div className="flex gap-3">
          <ToggleBlock
            selected={form.assistance.includes('Transportation')}
            onClick={() => handleAssistanceClick('Transportation')}
            icon={<Car className="w-4 h-4" />}
            label={l('Transportation', 'حمل‌ونقل', 'النقل')}
          />
          <ToggleBlock
            selected={form.assistance.includes('Accommodation')}
            onClick={() => handleAssistanceClick('Accommodation')}
            icon={<Hotel className="w-4 h-4" />}
            label={l('Accommodation', 'اقامت', 'الإقامة')}
          />
        </div>

        <AnimatePresence>
          {form.assistance.includes('Accommodation') && (
            <motion.div
              ref={starsRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 mt-3">
                {STAR_RATINGS.map(({ stars, label }) => (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => set('accommodation_stars', form.accommodation_stars === stars ? null : stars)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${
                      form.accommodation_stars === stars
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border/40 text-muted-foreground hover:border-accent/40 hover:text-foreground'
                    }`}
                  >
                    <span className="text-[10px] leading-none tracking-tight">{'★'.repeat(stars)}</span>
                    <span className="text-[9px] font-medium">{localize(lang, label, { Budget: 'اقتصادی', Economy: 'مقرون‌به‌صرفه', Standard: 'استاندارد', Premium: 'ممتاز', Luxury: 'لوکس' }[label], { Budget: 'اقتصادي', Economy: 'موفّر', Standard: 'قياسي', Premium: 'ممتاز', Luxury: 'فاخر' }[label])}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Step 2: Preferences ────────────────────────────────────────────────────

function Step2({
  form, set, toggle, errors,
  customHolidayTypes, onAddHolidayType,
  customAdditionalServices, onAddAdditionalService,
  requirementsPlaceholder,
}) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const [newHolidayType,    setNewHolidayType]    = useState('');
  const [showHolidayInput,  setShowHolidayInput]  = useState(false);
  const [newService,        setNewService]        = useState('');
  const [showServiceInput,  setShowServiceInput]  = useState(false);
  const holidayInputRef = useRef(null);
  const serviceInputRef = useRef(null);
  const requirementsLength = form.requirements.trim().length;

  const submitHolidayType = () => {
    const v = newHolidayType.trim();
    if (!v) return;
    onAddHolidayType(v);
    setNewHolidayType('');
    setShowHolidayInput(false);
  };

  const submitService = () => {
    const v = newService.trim();
    if (!v) return;
    onAddAdditionalService(v);
    setNewService('');
    setShowServiceInput(false);
  };

  return (
    <div className="space-y-6">
      {/* Holiday types */}
      <div>
        <FieldLabel>{l('Type of holiday I am looking for', 'سبک سفر دلخواه من', 'نمط الرحلة الذي أفضّله')}</FieldLabel>
        <div className="grid grid-cols-5 gap-2">
          {HOLIDAY_TYPES.map(type => (
            <IconGridItem
              key={type.id}
              selected={form.holiday_types.includes(type.id)}
              onClick={() => toggle('holiday_types', type.id)}
              emoji={type.emoji}
              label={localizeTripOption(type.label, lang)}
              multi
            />
          ))}
          {customHolidayTypes.map(ct => (
            <IconGridItem
              key={ct}
              selected={form.holiday_types.includes(ct)}
              onClick={() => toggle('holiday_types', ct)}
              emoji="✨"
              label={ct}
              multi
            />
          ))}
        </div>

        {/* Add custom holiday type */}
        <div className="mt-2.5">
          <AnimatePresence mode="wait">
            {showHolidayInput ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex gap-2"
              >
                <input
                  ref={holidayInputRef}
                  autoFocus
                  value={newHolidayType}
                  onChange={e => setNewHolidayType(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitHolidayType();
                    if (e.key === 'Escape') { setShowHolidayInput(false); setNewHolidayType(''); }
                  }}
                  placeholder={l('e.g. Spiritual, Photography…', 'مثلاً زیارتی، عکاسی…', 'مثلاً سياحة دينية، تصوير…')}
                  className="flex-1 px-3 py-1.5 text-xs bg-background/50 border border-border/40 rounded-lg focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={submitHolidayType}
                  disabled={!newHolidayType.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 transition-colors"
                >
                  {l('Add', 'افزودن', 'إضافة')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowHolidayInput(false); setNewHolidayType(''); }}
                  className="px-3 py-1.5 rounded-lg border border-border/40 text-muted-foreground text-xs hover:text-foreground transition-colors"
                >
                  {l('Cancel', 'انصراف', 'إلغاء')}
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                type="button"
                onClick={() => setShowHolidayInput(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs font-medium text-muted-foreground hover:border-accent hover:text-accent transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {l('Add custom', 'افزودن سبک دلخواه', 'إضافة نمط آخر')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <FieldError msg={errors?.holiday_types} />
      </div>

      {/* Additional services */}
      <div>
        <FieldLabel>{l('Additional services I require', 'خدمات اضافی موردنیاز من', 'الخدمات الإضافية التي أحتاج إليها')}</FieldLabel>
        <div className="grid grid-cols-5 gap-2">
          {ADDITIONAL_SERVICES.map(svc => (
            <IconGridItem
              key={svc.id}
              selected={form.additional_services.includes(svc.id)}
              onClick={() => toggle('additional_services', svc.id)}
              emoji={svc.emoji}
              label={localizeTripOption(svc.label, lang)}
              multi
            />
          ))}
          {customAdditionalServices.map(cs => (
            <IconGridItem
              key={cs}
              selected={form.additional_services.includes(cs)}
              onClick={() => toggle('additional_services', cs)}
              emoji="📦"
              label={cs}
              multi
            />
          ))}
        </div>

        {/* Add custom service */}
        <div className="mt-2.5">
          <AnimatePresence mode="wait">
            {showServiceInput ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex gap-2"
              >
                <input
                  ref={serviceInputRef}
                  autoFocus
                  value={newService}
                  onChange={e => setNewService(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitService();
                    if (e.key === 'Escape') { setShowServiceInput(false); setNewService(''); }
                  }}
                  placeholder={l('e.g. Camel Riding, Photography Guide…', 'مثلاً شترسواری، راهنمای عکاسی…', 'مثلاً ركوب الجمال، مرشد للتصوير…')}
                  className="flex-1 px-3 py-1.5 text-xs bg-background/50 border border-border/40 rounded-lg focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={submitService}
                  disabled={!newService.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 transition-colors"
                >
                  {l('Add', 'افزودن', 'إضافة')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowServiceInput(false); setNewService(''); }}
                  className="px-3 py-1.5 rounded-lg border border-border/40 text-muted-foreground text-xs hover:text-foreground transition-colors"
                >
                  {l('Cancel', 'انصراف', 'إلغاء')}
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                type="button"
                onClick={() => setShowServiceInput(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs font-medium text-muted-foreground hover:border-accent hover:text-accent transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {l('Add service', 'افزودن خدمت', 'إضافة خدمة')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tour type */}
      <div>
        <FieldLabel>{l('I prefer:', 'ترجیح می‌دهم:', 'أفضل:')}</FieldLabel>
        <div className="flex gap-3">
          {[
            { id: 'Private Tour', label: 'Private Tour' },
            { id: 'Group Tour',   label: 'Group Tour'   },
          ].map(t => (
            <ToggleBlock
              key={t.id}
              selected={form.tour_type === t.id}
              onClick={() => set('tour_type', form.tour_type === t.id ? '' : t.id)}
              label={localizeTripOption(t.label, lang)}
            />
          ))}
        </div>
      </div>

      {/* Requirements — intentionally last so travellers can add anything not covered above */}
      <div>
        <label className="block text-sm font-bold text-foreground mb-2.5">
          {l('Your Requirements', 'نیازها و توضیحات شما', 'احتياجاتك وملاحظاتك')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.requirements}
          onChange={e => set('requirements', e.target.value)}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          placeholder={requirementsPlaceholder || l('Describe anything else we should know about your travel goals, interests, or special needs...', 'درباره هدف سفر، علایق یا نیازهای ویژه‌ای که باید بدانیم بنویسید…', 'أخبرنا بأي تفاصيل أخرى عن أهداف سفرك أو اهتماماتك أو احتياجاتك الخاصة…')}
          rows={2}
          minLength={REQUIREMENTS_MIN_LENGTH}
          required
          aria-describedby="trip-requirements-help trip-requirements-count"
          style={{ minHeight: '60px', maxHeight: '200px', overflow: 'hidden', resize: 'none' }}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.08] border border-gray-200 dark:border-white/20 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/45 focus:placeholder:text-transparent focus:outline-none focus:border-accent transition-colors"
        />
        <FieldError msg={errors?.requirements} />
        <div className="mt-2 flex items-start justify-between gap-3 text-xs">
          <p id="trip-requirements-help" className="text-muted-foreground">
            {l('Add any details not covered above. Minimum', 'جزئیات دیگری را که در بالا نبود بنویسید. حداقل', 'أضف أي تفاصيل لم تذكرها أعلاه. الحد الأدنى')} {REQUIREMENTS_MIN_LENGTH} {l('characters.', 'نویسه.', 'حرفاً.')}
          </p>
          <span
            id="trip-requirements-count"
            className={`shrink-0 font-medium tabular-nums ${
              requirementsLength >= REQUIREMENTS_MIN_LENGTH ? 'text-accent' : 'text-red-400'
            }`}
          >
            {requirementsLength}/{REQUIREMENTS_MIN_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function TripRequestForm({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  prefillData = null,
  requestContext = null,
}) {
  const { user }       = useAuth();
  const { t, lang, dir } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const queryClient    = useQueryClient();
  const packageMode = Boolean(requestContext?.package);
  const [step, setStep]           = useState(1);
  const [direction, setDirection] = useState(1);
  const [form, setForm]           = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]       = useState({});
  const scrollAreaRef = useRef(null);

  const [customHolidayTypes,       setCustomHolidayTypes]       = useState([]);
  const [customAdditionalServices, setCustomAdditionalServices] = useState([]);

  // AnimatePresence preserves the same scroll container while the modal opens
  // and while its steps change. Start every view at the beginning of its form.
  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = requestAnimationFrame(() => {
      if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, step]);

  // Pre-populate from prefillData (AI conversational draft) — simple direct merge
  useEffect(() => {
    if (!isOpen || !prefillData) return;
    // AI drafts carry a total adult count while the request form displays a
    // gender split. Preserve the total in a sensible editable default.
    const totalAdults = Math.max(1, Number(prefillData.adults) || 1);
    setForm({
      ...INITIAL_FORM,
      ...prefillData,
      maleAdults: Number(prefillData.maleAdults) || totalAdults,
      femaleAdults: Number(prefillData.femaleAdults) || 0,
    });
    setStep(1);
    setDirection(1);
    setErrors({});
    setCustomHolidayTypes([]);
    setCustomAdditionalServices([]);
  }, [isOpen, prefillData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate from initialData when modal opens
  useEffect(() => {
    if (!initialData || !isOpen) return;

    const standardHT = HOLIDAY_TYPES.map(t => t.id);
    const customHT   = (initialData.holiday_types || []).filter(t => !standardHT.includes(t));

    const standardAS = ADDITIONAL_SERVICES.map(s => s.id);
    const customAS   = (initialData.additional_services || []).filter(s => !standardAS.includes(s));

    setCustomHolidayTypes(customHT);
    setCustomAdditionalServices(customAS);

    setForm(f => ({
      ...f,
      destinations:        initialData.destinations_array
        || (initialData.destination
            ? initialData.destination.split(',').map(s => s.trim()).filter(Boolean)
            : []),
      start_date:          initialData.start_date  || '',
      end_date:            initialData.end_date    || '',
      timings_flexible:    initialData.timings_flexible ?? false,
      maleAdults:          Number(initialData.male_adults)   || Number(initialData.adults) || 1,
      femaleAdults:        Number(initialData.female_adults) || 0,
      children:            Number(initialData.children) || 0,
      guide_languages:     initialData.guide_languages  || [],
      requirements:        initialData.requirements     || '',
      holiday_types:       initialData.holiday_types    || [],
      additional_services: initialData.additional_services || [],
      tour_type:
        initialData.tour_type === 'private' ? 'Private Tour'
        : initialData.tour_type === 'group' ? 'Group Tour'
        : initialData.tour_type || '',
      assistance: initialData.assistance?.length
        ? initialData.assistance
        : [
            ...(initialData.needs_accommodation ? ['Accommodation'] : []),
            ...(initialData.needs_transport     ? ['Transportation'] : []),
          ],
      accommodation_stars: initialData.accommodation_stars || null,
    }));
  }, [initialData, isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const toggle = (key, item) => setForm(f => {
    const arr = f[key];
    return { ...f, [key]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] };
  });

  const toggleAssistance = (item) => {
    setForm(f => {
      const removing      = f.assistance.includes(item);
      const newAssistance = removing
        ? f.assistance.filter(x => x !== item)
        : [...f.assistance, item];
      return {
        ...f,
        assistance: newAssistance,
        ...(item === 'Accommodation' && removing ? { accommodation_stars: null } : {}),
      };
    });
  };

  const addCustomHolidayType = (label) => {
    if (customHolidayTypes.includes(label)) return;
    setCustomHolidayTypes(prev => [...prev, label]);
    // Auto-select the new custom type
    setForm(f => ({ ...f, holiday_types: [...f.holiday_types, label] }));
  };

  const addCustomAdditionalService = (label) => {
    if (customAdditionalServices.includes(label)) return;
    setCustomAdditionalServices(prev => [...prev, label]);
    setForm(f => ({ ...f, additional_services: [...f.additional_services, label] }));
  };

  const handleClose = () => {
    setStep(1);
    setDirection(1);
    setForm(INITIAL_FORM);
    setErrors({});
    setCustomHolidayTypes([]);
    setCustomAdditionalServices([]);
    onClose();
  };

  const goNext = () => {
    const errs = {};
    if (!form.destinations.length) errs.destinations = t('trip_city_error');
    if (!form.start_date)          errs.start_date     = l('Please select a start date.', 'لطفاً تاریخ شروع را انتخاب کنید.', 'يُرجى اختيار تاريخ البداية.');
    if (!form.end_date)            errs.end_date       = l('Please select an end date.', 'لطفاً تاریخ پایان را انتخاب کنید.', 'يُرجى اختيار تاريخ النهاية.');
    if (form.start_date && form.end_date && form.end_date <= form.start_date)
      errs.end_date = l('End date must be after start date.', 'تاریخ پایان باید پس از تاریخ شروع باشد.', 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية.');
    if (!form.guide_languages.length)
      errs.guide_languages = l('Please select at least one language.', 'لطفاً دست‌کم یک زبان انتخاب کنید.', 'يُرجى اختيار لغة واحدة على الأقل.');
    if ((form.maleAdults + form.femaleAdults) < 1)
      errs.adults = l('At least 1 adult is required.', 'دست‌کم یک بزرگسال باید در سفر باشد.', 'يجب أن يرافق الرحلة شخص بالغ واحد على الأقل.');

    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setDirection(1);
    setStep(2);
  };

  const goBack = () => {
    setErrors({});
    setDirection(-1);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error(l('Please log in to submit a request.', 'برای ارسال درخواست، ابتدا وارد حساب خود شوید.', 'يُرجى تسجيل الدخول لإرسال الطلب.'));
      return;
    }

    const errs = {};
    const trimmedRequirements = form.requirements.trim();
    if (!form.holiday_types.length)
      errs.holiday_types = l('Please select at least one type of holiday.', 'لطفاً دست‌کم یک سبک سفر انتخاب کنید.', 'يُرجى اختيار نمط رحلة واحد على الأقل.');
    if (trimmedRequirements.length < REQUIREMENTS_MIN_LENGTH)
      errs.requirements = `${l('Please write at least', 'لطفاً دست‌کم', 'يُرجى كتابة')} ${REQUIREMENTS_MIN_LENGTH} ${l('characters in Your Requirements', 'نویسه در بخش نیازها و توضیحات بنویسید', 'حرفاً في خانة الاحتياجات والملاحظات')} (${trimmedRequirements.length}/${REQUIREMENTS_MIN_LENGTH}).`;

    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const arrival_time   = form.timings_flexible ? null : `${form.arrival_hour}:${form.arrival_minute} ${form.arrival_period}`;
      const departure_time = form.timings_flexible ? null : `${form.departure_hour}:${form.departure_minute} ${form.departure_period}`;

      const payload = {
        user_id:             user.id,
        destination:         form.destinations,
        start_date:          form.start_date  || null,
        end_date:            form.end_date    || null,
        arrival_time,
        departure_time,
        timings_flexible:    form.timings_flexible,
        adults:              form.maleAdults + form.femaleAdults,
        male_adults:         form.maleAdults,
        female_adults:       form.femaleAdults,
        children:            form.children,
        guide_languages:     form.guide_languages,
        assistance:          form.assistance,
        accommodation_stars: form.accommodation_stars,
        requirements:        trimmedRequirements,
        holiday_types:       form.holiday_types,
        additional_services: form.additional_services,
        tour_type:           form.tour_type,
        status:              'active',
        created_at:          new Date().toISOString(),
      };

      const { error } = await supabase.from('trip_requests').insert(payload);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['trip_requests', user.id] });
      toast.success(l('Trip request submitted! Local guides will reach out soon.', 'درخواست سفر ثبت شد! راهنماهای محلی به‌زودی با شما تماس می‌گیرند.', 'أُرسل طلب رحلتك! سيتواصل معك المرشدون المحليون قريباً.'));

      onSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(l('Failed to submit. Please try again.', 'ارسال درخواست انجام نشد. لطفاً دوباره تلاش کنید.', 'تعذر إرسال الطلب. يُرجى المحاولة مجدداً.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <TransitionSurface kind="backdrop"
          key="modal-root"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal card */}
          <TransitionSurface kind="modal"
            className={`relative z-10 flex w-full overflow-hidden shadow-2xl ${packageMode ? 'max-w-6xl rounded-2xl border border-border/60' : 'max-w-4xl rounded-3xl'}`}
            style={{ maxHeight: 'min(92vh, 800px)' }}
          >
            {/* ── Sidebar (desktop only) ── */}
            {packageMode ? (
              <PackageRequestSummary context={requestContext} form={form} lang={lang} />
            ) : (
            <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-navy relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full p-7">
                <div className="mb-8">
                  <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-4">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-heading text-white text-base font-semibold leading-snug">
                    {l('How it works', 'مراحل کار', 'كيف تسير العملية')}
                  </h3>
                  <p className="text-white/45 text-[11px] mt-1 leading-relaxed">
                    {l('Plan your perfect Iran trip in minutes', 'سفر دلخواهتان به ایران را در چند دقیقه برنامه‌ریزی کنید', 'خطّط لرحلتك إلى إيران في دقائق')}
                  </p>
                </div>

                <div className="space-y-5 flex-1">
                  {HOW_IT_WORKS.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-base shrink-0 mt-0.5">
                        {s.icon}
                      </div>
                      <div>
                        <p className="text-white text-xs font-semibold leading-snug">{[
                          l('Tell us your travel wishlist', 'خواسته‌هایتان را بگویید', 'أخبرنا بما ترغب به في رحلتك'),
                          l('Receive proposals from local guides', 'از راهنماهای محلی پیشنهاد بگیرید', 'تلقَّ عروضاً من المرشدين المحليين'),
                          l('Choose your guide', 'راهنمای خود را انتخاب کنید', 'اختر مرشدك'),
                          l('Have an unforgettable journey', 'سفری فراموش‌نشدنی داشته باشید', 'استمتع برحلة لا تُنسى'),
                        ][i]}</p>
                        <p className="text-white/45 text-[11px] mt-0.5 leading-relaxed">{[
                          l('Share your destination, dates, and preferences', 'مقصد، تاریخ و ترجیحاتتان را ثبت کنید', 'شاركنا وجهتك ومواعيدك وتفضيلاتك'),
                          l('Expert guides craft tailored itineraries for you', 'راهنماهای متخصص برنامه‌هایی متناسب با شما تهیه می‌کنند', 'يعدّ المرشدون الخبراء برامج تناسبك'),
                          l('Compare proposals and pick the perfect match', 'پیشنهادها را مقایسه کنید و بهترین گزینه را برگزینید', 'قارن العروض واختر الأنسب لك'),
                          l('Experience authentic Iran with a dedicated local guide', 'با همراهی راهنمای محلی، ایران را از نزدیک تجربه کنید', 'اكتشف إيران الأصيلة برفقة مرشد محلي'),
                        ][i]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-px h-full bg-white/10" />
            </aside>
            )}

            {/* ── Form area ── */}
            <div className="flex-1 bg-card flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-6 sm:px-8 pt-6 pb-0 shrink-0">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    {packageMode ? l('Customize your tour', 'تور خود را شخصی‌سازی کنید', 'خصّص جولتك') : l('New Trip Request', 'درخواست سفر جدید', 'طلب رحلة جديد')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {packageMode
                      ? (step === 1 ? l('Tell us how you would like to tailor this package.', 'بگویید این بسته سفر را چگونه می‌خواهید تغییر دهید.', 'أخبرنا كيف تريد تخصيص باقة السفر هذه.') : l('Confirm your preferences before sending the request.', 'پیش از ارسال درخواست، ترجیحات خود را تأیید کنید.', 'أكد تفضيلاتك قبل إرسال الطلب.'))
                      : (step === 1 ? l('Step 1 of 2 — Trip Details', 'مرحله ۱ از ۲ — جزئیات سفر', 'الخطوة ١ من ٢ — تفاصيل الرحلة') : l('Step 2 of 2 — Preferences', 'مرحله ۲ از ۲ — ترجیحات', 'الخطوة ٢ من ٢ — التفضيلات'))}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="px-6 sm:px-8 pt-5 shrink-0">
                <StepIndicator step={step} packageMode={packageMode} />
              </div>

              {/* Scrollable content */}
              <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-6 sm:px-8 pb-4">
                {requestContext && !packageMode && (
                  <div className="mb-5 rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                      {requestContext.eyebrow}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {requestContext.title}
                    </p>
                    {requestContext.meta && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {requestContext.meta}
                      </p>
                    )}
                  </div>
                )}
                <div className="mb-5 rounded-2xl border border-border/40 bg-background/45 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{l('Your request at a glance:', 'خلاصه درخواست شما:', 'ملخص طلبك:')} </span>
                  {form.destinations.length ? form.destinations.map(city => CITY_LABELS[city]?.[lang] || city).join('، ') : l('Destination pending', 'مقصد هنوز مشخص نشده', 'لم تُحدَّد الوجهة بعد')} · {form.start_date && form.end_date ? `${formatDateDisplay(form.start_date, lang)} — ${formatDateDisplay(form.end_date, lang)}` : l('Dates pending', 'تاریخ‌ها هنوز مشخص نشده‌اند', 'لم تُحدَّد المواعيد بعد')} · {form.maleAdults + form.femaleAdults} {l('adults', 'بزرگسال', 'بالغ')} ({form.maleAdults} {l('men', 'مرد', 'رجال')}, {form.femaleAdults} {l('women', 'زن', 'نساء')}){form.children ? `, ${form.children} ${l('children', 'کودک', 'أطفال')}` : ''}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ x: direction * 36, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: direction * -36, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {step === 1 ? (
                      <Step1
                        form={form} set={set}
                        toggleAssistance={toggleAssistance} errors={errors}
                      />
                    ) : (
                      <Step2
                        form={form} set={set} toggle={toggle} errors={errors}
                        customHolidayTypes={customHolidayTypes}
                        onAddHolidayType={addCustomHolidayType}
                        customAdditionalServices={customAdditionalServices}
                        onAddAdditionalService={addCustomAdditionalService}
                        requirementsPlaceholder={initialData?.requirements_placeholder}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer buttons */}
              <div className="px-6 sm:px-8 py-4 border-t border-border/40 shrink-0 flex items-center justify-between gap-3 bg-card">
                {step === 1 ? (
                  <button
                    onClick={handleClose}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l('Cancel', 'انصراف', 'إلغاء')}
                  </button>
                ) : (
                  <button
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {l('Back', 'بازگشت', 'رجوع')}
                  </button>
                )}

                {step === 1 ? (
                  <button
                    onClick={goNext}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/25"
                  >
                    {packageMode ? l('Continue', 'ادامه', 'متابعة') : l('Next', 'بعدی', 'التالي')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/25 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {l('Submitting…', 'در حال ارسال…', 'جارٍ الإرسال…')}</>
                      : (packageMode ? l('Send Customization Request', 'ارسال درخواست شخصی‌سازی', 'إرسال طلب التخصيص') : l('Submit Request', 'ثبت درخواست', 'إرسال الطلب'))
                    }
                  </button>
                )}
              </div>
            </div>
          </TransitionSurface>
        </TransitionSurface>
      )}
    </AnimatePresence>
  );
}
