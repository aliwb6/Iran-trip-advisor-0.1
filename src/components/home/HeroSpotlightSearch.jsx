import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CornerDownLeft, MapPin, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { destinationLabel, iranianDestinations, popularIranianDestinations } from '@/data/iranianCities';
import { useI18n } from '@/lib/i18n.jsx';
import { preloadRoute } from '@/lib/route-loaders';

const recent = ['Isfahan', 'Shiraz', 'Yazd'];
const copy = {
  en: { placeholder: 'Where would you like to go?', input: 'Search destinations, tours, or experiences', recent: 'Recently explored', popular: 'Popular destinations', results: 'Suggestions', none: 'No destination found', hint: 'Press Enter to search all tours', close: 'Close search', select: 'to select' },
  fa: { placeholder: 'رویای سفر به کجا دارید؟', input: 'مقصد، تور یا تجربهٔ خود را جست‌وجو کنید', recent: 'جست‌وجوهای اخیر', popular: 'مقصدهای محبوب', results: 'پیشنهادها', none: 'مقصدی پیدا نشد', hint: 'برای جست‌وجوی همهٔ تورها Enter بزنید', close: 'بستن جست‌وجو', select: 'برای انتخاب' },
  ar: { placeholder: 'إلى أين تحلم بالسفر؟', input: 'ابحث عن وجهة أو جولة أو تجربة', recent: 'تم استكشافه مؤخراً', popular: 'وجهات رائجة', results: 'اقتراحات', none: 'لم يتم العثور على وجهة', hint: 'اضغط Enter للبحث في كل الجولات', close: 'إغلاق البحث', select: 'للاختيار' },
};

export default function HeroSpotlightSearch() {
  const { dir, lang } = useI18n();
  const navigate = useNavigate();
  const text = copy[lang] || copy.en;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? iranianDestinations.filter((city) => [city.en, city.fa, city.ar].some((name) => name.toLocaleLowerCase().includes(term))).slice(0, 6) : [];
  }, [query]);
  const items = query.trim() ? results : recent.map((name) => iranianDestinations.find((city) => city.en === name)).filter(Boolean);

  const close = () => { setOpen(false); setQuery(''); setActive(0); };
  const submit = (city) => {
    const value = city?.en || query.trim();
    if (!value) return;
    close();
    navigate(`/tours?city=${encodeURIComponent(value)}`);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((value) => !value); }
      if (open && event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 80); }, [open]);
  useEffect(() => setActive(0), [query]);

  const dialog = <AnimatePresence>{open && (
    <motion.div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[max(5rem,12vh)] sm:px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={text.input}>
      <button type="button" onClick={close} className="absolute inset-0 cursor-default bg-navy/65 backdrop-blur-md" aria-label={text.close} />
      <motion.div dir={dir} initial={{ opacity: 0, y: -22, scale: 0.96, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -14, scale: 0.97, filter: 'blur(10px)' }} transition={{ type: 'spring', stiffness: 410, damping: 31, mass: 0.8 }} className="relative w-full max-w-2xl overflow-hidden rounded-[1.65rem] border border-white/20 bg-[#10131ce8] shadow-[0_32px_100px_rgba(0,0,0,0.55)]">
        <form className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4" onSubmit={(event) => { event.preventDefault(); submit(items[active]); }}>
          <Search className="h-5 w-5 shrink-0 text-gold" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0))); } if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); } }} placeholder={text.input} autoComplete="off" className="min-w-0 flex-1 bg-transparent font-body text-base text-white outline-none placeholder:text-white/40 sm:text-lg" />
          <kbd className="hidden rounded-md border border-white/15 bg-white/[0.07] px-2 py-1 font-body text-[11px] text-white/50 sm:block">ESC</kbd>
          <button type="button" onClick={close} className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white" aria-label={text.close}><X className="h-4 w-4" /></button>
        </form>
        <div className="max-h-[min(440px,58vh)] overflow-y-auto p-3 sm:p-4">
          {query.trim() && !results.length ? <div className="px-3 py-8 text-center"><p className="font-body text-sm text-white/80">{text.none}</p><p className="mt-1 font-body text-xs text-white/45">{text.hint}</p></div> : <>
            <p className="px-3 pb-2 font-body text-[11px] font-medium uppercase tracking-[0.16em] text-gold/80">{query.trim() ? text.results : text.recent}</p>
            <div className="space-y-1">{items.map((city, index) => <button key={city.en} type="button" onMouseEnter={() => setActive(index)} onClick={() => submit(city)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition ${index === active ? 'bg-white/[0.11]' : 'hover:bg-white/[0.07]'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><MapPin className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-body text-sm font-medium text-white">{destinationLabel(city, lang)}</span><span className="block pt-0.5 font-body text-xs text-white/45">{city.en} · Iran</span></span><Arrow className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-gold" /></button>)}</div>
            {!query.trim() && <><p className="px-3 pb-2 pt-5 font-body text-[11px] font-medium uppercase tracking-[0.16em] text-gold/80">{text.popular}</p><div className="flex flex-wrap gap-2 px-1">{popularIranianDestinations.map((city) => <button key={city.en} type="button" onClick={() => submit(city)} className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-2 font-body text-xs text-white/75 transition hover:border-gold/50 hover:bg-gold/10 hover:text-gold">{destinationLabel(city, lang)}</button>)}</div></>}
          </>}
        </div>
        <div className="flex justify-end border-t border-white/10 px-5 py-3 font-body text-[11px] text-white/40"><span className="flex items-center gap-1.5"><CornerDownLeft className="h-3.5 w-3.5" /> {text.select}</span></div>
      </motion.div>
    </motion.div>
  )}</AnimatePresence>;

  return <><button type="button" onClick={() => { preloadRoute('/tours'); setOpen(true); }} onMouseEnter={() => preloadRoute('/tours')} className="group flex w-full max-w-lg items-center gap-3 rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-start shadow-xl backdrop-blur-md transition duration-300 hover:border-gold/60 hover:bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-haspopup="dialog" aria-expanded={open}><MapPin className="h-4 w-4 shrink-0 text-gold" /><span className="min-w-0 flex-1 truncate font-body text-sm text-white/55">{text.placeholder}</span><span className="hidden rounded-lg border border-white/15 bg-white/[0.08] px-2 py-1 font-body text-[10px] text-white/50 sm:inline">⌘ K</span><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition group-hover:bg-accent"><Search className="h-3.5 w-3.5" /></span></button>{typeof document !== 'undefined' ? createPortal(dialog, document.body) : null}</>;
}
