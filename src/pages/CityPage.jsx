import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map as MapIcon, User, Landmark, BookOpen, Sparkles,
  Search, ArrowRight, ArrowLeft, ArrowUpRight,
  Clock, DollarSign, Star, Languages, MessageCircle, Compass,
  Calendar, Plane, Info,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { supabase } from '@/supabaseClient';
import { selectPublicProfiles } from '@/lib/publicProfiles';
import { selectPublicTours } from '@/lib/publicTours';
import { avatarFor } from '@/lib/avatar';

// ── City catalog ─────────────────────────────────────────────────────────────
// Keys are the lowercase URL slugs. Each entry carries English copy from the
// spec; FA / AR labels are kept short and inline so the page localises with the
// rest of the site without growing i18n.jsx.
const cityData = {
  isfahan: {
    name: 'Isfahan',
    nameI18n: { fa: 'اصفهان', ar: 'أصفهان' },
    category: 'Architecture & History',
    image: '/images/optimized/isfahan-1600.webp',
    description:
      "Known as 'Half of the World', Isfahan dazzles visitors with its stunning Islamic architecture, turquoise-domed mosques, and the magnificent Naqsh-e Jahan Square — a UNESCO World Heritage Site.",
    highlights: ['Naqsh-e Jahan Square', 'Sheikh Lotfollah Mosque', 'Si-o-Se Pol Bridge', 'Armenian Quarter'],
    bestTime: 'March – May & September – November',
  },
  shiraz: {
    name: 'Shiraz',
    nameI18n: { fa: 'شیراز', ar: 'شيراز' },
    category: 'History & Poetry',
    image: '/images/optimized/shiraz-1600.webp',
    description:
      "The city of poets, roses, and wine. Shiraz is home to Persepolis — the ancient capital of the Persian Empire — and the tombs of legendary Persian poets Hafez and Sa'di.",
    highlights: ['Persepolis', 'Tomb of Hafez', 'Nasir ol-Molk Mosque', 'Eram Garden'],
    bestTime: 'March – May (spring blossoms)',
  },
  yazd: {
    name: 'Yazd',
    nameI18n: { fa: 'یزد', ar: 'يزد' },
    category: 'Culture & Desert',
    image: '/images/optimized/yazd-1600.webp',
    description:
      "A living museum of Persian culture. Yazd's ancient mud-brick architecture, wind towers, and Zoroastrian fire temples make it one of the oldest continuously inhabited cities in the world.",
    highlights: ['Jameh Mosque of Yazd', 'Towers of Silence', 'Zoroastrian Fire Temple', 'Amir Chakhmaq Complex'],
    bestTime: 'October – April (cooler desert season)',
  },
  mashhad: {
    name: 'Mashhad',
    nameI18n: { fa: 'مشهد', ar: 'مشهد' },
    category: 'Spiritual & Cultural',
    image: '/images/optimized/mashhad-1600.webp',
    description:
      "Iran's holiest city and spiritual heart. The magnificent shrine of Imam Reza draws millions of pilgrims annually, surrounded by museums, bazaars, and beautiful gardens.",
    highlights: ['Imam Reza Shrine', 'Goharshad Mosque', 'Mellat Park', 'Khorasan Museum'],
    bestTime: 'April – October',
  },
  gilan: {
    name: 'Gilan',
    nameI18n: { fa: 'گیلان', ar: 'جيلان' },
    category: 'Nature & Forest',
    image: '/images/optimized/gilan-1600.webp',
    description:
      "Iran's lush green paradise. Gilan's misty forests, rice paddies, and Caspian coastline offer a dramatic contrast to Iran's desert interior — perfect for nature lovers.",
    highlights: ['Masuleh Village', 'Anzali Lagoon', 'Rudkhan Castle', 'Rasht Bazaar'],
    bestTime: 'May – September',
  },
  lorestan: {
    name: 'Lorestan',
    nameI18n: { fa: 'لرستان', ar: 'لرستان' },
    category: 'Adventure & Nature',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200',
    description:
      "Iran's adventure capital. Lorestan's dramatic Zagros mountains, ancient caves, and roaring rivers make it a paradise for trekkers, climbers, and those seeking Iran's wild side.",
    highlights: ['Bisheh Waterfall', 'Falak-ol-Aflak Castle', 'Khorramabad River', 'Zagros Mountains'],
    bestTime: 'April – June & September – October',
  },
  tabriz: {
    name: 'Tabriz',
    nameI18n: { fa: 'تبریز', ar: 'تبريز' },
    category: 'Culture & History',
    image: '/images/optimized/tabriz-1600.webp',
    description:
      "One of Iran's oldest cities, Tabriz is a UNESCO-listed bazaar city with rich Azerbaijani culture, stunning architecture, and the famous Tabriz Historic Bazaar Complex — one of the world's largest covered bazaars.",
    highlights: ['Tabriz Historic Bazaar', 'Blue Mosque', 'St. Stepanos Church', 'Arg of Tabriz'],
    bestTime: 'April – May & September – October',
  },
  kerman: {
    name: 'Kerman',
    nameI18n: { fa: 'کرمان', ar: 'كرمان' },
    category: 'History & Desert',
    image: '/images/optimized/kerman-1600.webp',
    description:
      "Gateway to the Lut Desert, Kerman is home to the magnificent Ganjali Khan Complex, ancient bazaars, and some of Iran's finest Persian gardens with a landscape shaped by history and nature.",
    highlights: ['Ganjali Khan Complex', 'Arg of Bam', 'Lut Desert Gateway', 'Kerman Bazaar'],
    bestTime: 'October – April (cooler desert season)',
  },
  kashan: {
    name: 'Kashan',
    nameI18n: { fa: 'کاشان', ar: 'كاشان' },
    category: 'Architecture',
    image: '/images/optimized/kashan-1600.webp',
    description:
      "Famous for its stunning historic houses with intricate tilework, rose water production, and the ancient Fin Garden — one of Iran's oldest Persian gardens and a UNESCO World Heritage Site.",
    highlights: ['Fin Garden', 'Tabatabaei House', 'Borujerdi House', 'Kashan Bazaar'],
    bestTime: 'March – May & September – November',
  },
  qom: {
    name: 'Qom',
    nameI18n: { fa: 'قم', ar: 'قم' },
    category: 'Spiritual',
    image: '/images/optimized/qom-1600.webp',
    description:
      "Iran's most important religious city, home to the magnificent Fatima Masumeh Shrine with its turquoise dome, dozens of seminaries, and a deep insight into Persian Islamic culture and spirituality.",
    highlights: ['Fatima Masumeh Shrine', 'Qom Bazaar', 'Jamkaran Mosque', 'Holy Shrine Museums'],
    bestTime: 'September – May (avoid extreme heat)',
  },
  'kish-island': {
    name: 'Kish Island',
    nameI18n: { fa: 'جزیره کیش', ar: 'جزيرة كيش' },
    category: 'Nature & Leisure',
    image: '/images/optimized/kish-island-1600.webp',
    description:
      "A free-trade island in the Persian Gulf with crystal-clear waters, pristine beaches, coral reefs, duty-free shopping, and water sports — Iran's premier leisure and beach destination.",
    highlights: ['Kish Beaches', 'Coral Reefs', 'Dolphin Watching', 'Shopping & Nightlife'],
    bestTime: 'November – April (pleasant weather)',
  },
  'qeshm-island': {
    name: 'Qeshm Island',
    nameI18n: { fa: 'جزیره قشم', ar: 'جزيرة قشم' },
    category: 'Nature',
    image: '/images/optimized/qeshm-island-1600.webp',
    description:
      "Iran's largest island and a UNESCO Geopark with dramatic Star Valley formations, pristine mangrove forests, Persian Gulf coastlines, and unique geological wonders carved by nature.",
    highlights: ['Stars Valley', 'Mangrove Forests', 'Persian Gulf Beaches', 'Geologically Unique Sites'],
    bestTime: 'October – April',
  },
  'hormuz-island': {
    name: 'Hormuz Island',
    nameI18n: { fa: 'جزیره هرمز', ar: 'جزيرة هرمز' },
    category: 'Nature & Art',
    image: '/images/optimized/hormuz-island-1600.webp',
    description:
      "Known as the Rainbow Island, Hormuz is famous for its multicolored soil, red beaches, vibrant rock formations, and unique geological features in the heart of the Persian Gulf.",
    highlights: ['Red Beach', 'Rainbow Valley', 'Portuguese Castle Ruins', 'Multicolored Rock Formations'],
    bestTime: 'October – April',
  },
  tehran: {
    name: 'Tehran',
    nameI18n: { fa: 'تهران', ar: 'طهران' },
    category: 'Urban & Modern',
    image: '/images/optimized/tehran-1600.webp',
    description:
      "Iran's vibrant capital and largest city. Tehran blends a cosmopolitan urban energy with world-class museums, the snow-capped Alborz Mountains as a backdrop, and a thriving food and arts scene that surprises every visitor.",
    highlights: ['Golestan Palace', 'National Museum of Iran', 'Milad Tower', 'Grand Bazaar of Tehran', 'Darband Mountain Trail', 'Sadabad Complex'],
    bestTime: 'April – June & September – November',
  },
  rasht: {
    name: 'Rasht',
    nameI18n: { fa: 'رشت', ar: 'رشت' },
    category: 'Food & Nature',
    image: '/images/optimized/rasht-1600.webp',
    description:
      "The culinary capital of Iran and gateway to the lush Caspian coast. Rasht is a UNESCO Creative City of Gastronomy, famous for its hearty Gilaki cuisine, vibrant covered bazaar, and easy access to misty forest villages like Masuleh.",
    highlights: ['Rasht Grand Bazaar', 'Rasht Municipality Square', 'Gilaki Cuisine & Food Tour', 'Masuleh Village Day Trip', 'Anzali Lagoon', 'Saravan Forest Park'],
    bestTime: 'May – September (green season)',
  },
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CityPage() {
  const { citySlug } = useParams();
  const navigate = useNavigate();
  const { lang, dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const slug = String(citySlug || '').toLowerCase();
  const city = cityData[slug];

  const [tab, setTab] = useState('tours');
  const [query, setQuery] = useState('');
  const [tours, setTours] = useState([]);
  const [guides, setGuides] = useState([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [guidesLoading, setGuidesLoading] = useState(true);

  // Real Supabase data, scoped to the active city. No mock fallback —
  // when nothing matches we render a "No tour packages…" / "No guides…"
  // empty state so visitors see honest data, not placeholder content.
  //
  // Mapping vs the user's pseudocode:
  //   `tour_packages`  → `tours`            (actual table in this project)
  //   `is_active`      → `status='published'`
  //   `guides`         → `profiles` filtered by role IN (guide, agency)
  //   ilike with the city's display name, not the URL slug
  useEffect(() => {
    if (!city) return;
    let cancelled = false;

    (async () => {
      setToursLoading(true);
      setGuidesLoading(true);

      const [toursRes, guidesRes] = await Promise.all([
        selectPublicTours(supabase)
          .ilike('city', `%${city.name}%`)
          .order('created_at', { ascending: false }),
        selectPublicProfiles(supabase, 'id, full_name, avatar_url, gender, city, languages, role')
          .in('role', ['guide', 'agency'])
          .ilike('city', `%${city.name}%`),
      ]);

      if (cancelled) return;

      if (toursRes.error) console.error('[CityPage] tours fetch error', toursRes.error);
      if (guidesRes.error) console.error('[CityPage] guides fetch error', guidesRes.error);

      setTours(toursRes.data || []);
      setGuides(guidesRes.data || []);
      setToursLoading(false);
      setGuidesLoading(false);
    })();

    return () => { cancelled = true; };
  }, [city]);

  // ── Localised copy ─────────────────────────────────────────────────────────
  const tx = useMemo(() => ({
    notFound:    lang === 'fa' ? 'مقصد یافت نشد' : lang === 'ar' ? 'الوجهة غير موجودة' : 'Destination not found',
    backToHome:  lang === 'fa' ? 'بازگشت به خانه' : lang === 'ar' ? 'العودة إلى الرئيسية' : 'Back to home',
    searchIn:    lang === 'fa' ? `جستجو در ${city?.nameI18n?.fa || city?.name || ''}` : lang === 'ar' ? `ابحث في ${city?.nameI18n?.ar || city?.name || ''}` : `Search in ${city?.name || ''}`,
    tabTours:    lang === 'fa' ? 'تورها' : lang === 'ar' ? 'الجولات' : 'Tours',
    tabGuides:   lang === 'fa' ? 'راهنماها' : lang === 'ar' ? 'المرشدون' : 'Guides',
    tabAttract:  lang === 'fa' ? 'دیدنی‌ها' : lang === 'ar' ? 'الأماكن' : 'Attractions',
    tabAbout:    lang === 'fa' ? 'درباره' : lang === 'ar' ? 'حول' : 'About',
    tabAi:       lang === 'fa' ? 'برنامه‌ریزی با هوش' : lang === 'ar' ? 'خطط مع AI' : 'Plan with AI',
    viewPackage: lang === 'fa' ? 'مشاهده پکیج' : lang === 'ar' ? 'عرض الباقة' : 'View Package',
    contactGuide:lang === 'fa' ? 'تماس با راهنما' : lang === 'ar' ? 'تواصل مع المرشد' : 'Contact Guide',
    fromPrice:   lang === 'fa' ? 'از' : lang === 'ar' ? 'من' : 'from',
    days:        lang === 'fa' ? 'روز' : lang === 'ar' ? 'أيام' : 'days',
    mockBanner:  lang === 'fa' ? 'نمونه — به‌زودی محتوای واقعی برای این شهر اضافه می‌شود' : lang === 'ar' ? 'عينة — سيُضاف محتوى حقيقي لهذه المدينة قريباً' : 'Sample — real content for this city is coming soon',
    aiTitle:     lang === 'fa'
      ? `با هوش مصنوعی، تجربه‌ای کامل از ${city?.nameI18n?.fa || ''} بساز`
      : lang === 'ar'
      ? `خطّط تجربتك المثالية في ${city?.nameI18n?.ar || ''} مع الذكاء الاصطناعي`
      : `Chat with our AI to plan your perfect ${city?.name || ''} experience`,
    aiSub:       lang === 'fa' ? 'بگو چه می‌خواهی — مساعد ما همه‌چیز را برایت آماده می‌کند.' : lang === 'ar' ? 'أخبرنا بما تريد — سيتولى مساعدنا الباقي.' : 'Tell us what you love — our assistant handles the rest.',
    openAi:      lang === 'fa' ? 'باز کردن دستیار هوش مصنوعی' : lang === 'ar' ? 'افتح مساعد الذكاء الاصطناعي' : 'Open AI Assistant',
    travelTips:  lang === 'fa' ? 'نکات سفر' : lang === 'ar' ? 'نصائح السفر' : 'Travel Tips',
    bestTime:    lang === 'fa' ? 'بهترین زمان سفر' : lang === 'ar' ? 'أفضل وقت للزيارة' : 'Best time to visit',
    gettingThere:lang === 'fa' ? 'دسترسی' : lang === 'ar' ? 'الوصول' : 'Getting there',
    gettingThereVal: lang === 'fa' ? 'پرواز داخلی، اتوبوس بین‌شهری یا قطار از تهران' : lang === 'ar' ? 'رحلة داخلية أو حافلة أو قطار من طهران' : 'Domestic flight, intercity bus, or train from Tehran',
    knowBefore:  lang === 'fa' ? 'پیش از سفر' : lang === 'ar' ? 'قبل السفر' : 'Good to know',
    knowBeforeVal: lang === 'fa' ? 'احترام به پوشش محلی، با راهنمای مجاز سفر کن، اینترنت محدود است.' : lang === 'ar' ? 'احترم اللباس المحلي، سافر مع مرشد مرخص، الإنترنت محدود.' : 'Respect local dress codes, travel with a licensed guide, internet access can be limited.',
    noResults:   lang === 'fa' ? 'نتیجه‌ای یافت نشد' : lang === 'ar' ? 'لا توجد نتائج' : 'No results',

    // Empty-state copy
    noTours:     lang === 'fa' ? 'هنوز پکیج توری برای این شهر ثبت نشده است.' : lang === 'ar' ? 'لا توجد باقات سياحية لهذه المدينة بعد.' : 'No tour packages available for this city yet.',
    noToursSub:  lang === 'fa' ? 'به‌زودی دوباره سر بزن — در حال افزودن پکیج‌های جدید هستیم.' : lang === 'ar' ? 'تحقق لاحقاً — نضيف باقات جديدة قريباً.' : "Check back soon — we're adding new packages.",
    planWithAi:  lang === 'fa' ? 'برنامه‌ریزی با هوش مصنوعی' : lang === 'ar' ? 'خطّط مع الذكاء الاصطناعي' : 'Plan with AI',
    noGuides:    lang === 'fa' ? 'هنوز راهنمای محلی برای این شهر ثبت نشده است.' : lang === 'ar' ? 'لا يوجد مرشدون محليون مسجلون لهذه المدينة بعد.' : 'No local guides registered for this city yet.',
    noGuidesSub: lang === 'fa' ? 'می‌خواهی به‌عنوان راهنما ثبت‌نام کنی؟' : lang === 'ar' ? 'هل تريد الانضمام كمرشد؟' : 'Want to become a guide?',
    joinGuide:   lang === 'fa' ? 'ثبت‌نام به‌عنوان راهنما' : lang === 'ar' ? 'انضم كمرشد' : 'Join as a Guide',
    attractionsSoon: lang === 'fa' ? 'دیدنی‌ها به‌زودی' : lang === 'ar' ? 'الأماكن قريباً' : 'Attractions coming soon',
    attractionsSoonSub: lang === 'fa' ? 'در حال انتخاب بهترین جاذبه‌های این شهر هستیم.' : lang === 'ar' ? 'نختار لك أفضل المواقع في هذه المدينة.' : "We're curating the best spots in this city.",
  }), [lang, city]);

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!city) {
    return (
      <div dir={dir} className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <h1 className="font-heading text-3xl font-semibold text-foreground mb-3">{tx.notFound}</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">/{slug}</p>
        <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition">
          <Arrow className="w-4 h-4 rotate-180" />
          {tx.backToHome}
        </Link>
      </div>
    );
  }

  const localName = city.nameI18n?.[lang] || city.name;

  // Search filtering — applied per tab.
  const q = query.trim().toLowerCase();
  const filteredTours      = !q ? tours      : tours.filter((t) => String(t.title || '').toLowerCase().includes(q));
  const filteredGuides     = !q ? guides     : guides.filter((g) => String(g.full_name || '').toLowerCase().includes(q));
  const filteredHighlights = !q ? city.highlights : city.highlights.filter((h) => h.toLowerCase().includes(q));

  const TABS = [
    { id: 'tours',       label: tx.tabTours,    icon: MapIcon },
    { id: 'guides',      label: tx.tabGuides,   icon: User },
    { id: 'attractions', label: tx.tabAttract,  icon: Landmark },
    { id: 'about',       label: tx.tabAbout,    icon: BookOpen },
    { id: 'ai',          label: tx.tabAi,       icon: Sparkles },
  ];

  return (
    <div dir={dir} className="min-h-screen bg-background">
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative h-[460px] sm:h-[520px] overflow-hidden">
        <img
          decoding="async"
          loading="eager"
          fetchPriority="high"
          src={city.image}
          srcSet={city.image.includes('/optimized/') ? `${city.image.replace('-1600.webp', '-640.webp')} 640w, ${city.image} 1600w` : undefined}
          sizes="100vw"
          alt={localName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-navy/70 to-navy/35" />
        <div className="absolute inset-0 carpet-texture opacity-25" />

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 h-full flex items-end pb-12 sm:pb-14 pt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 max-w-2xl"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[10px] font-semibold uppercase tracking-wider text-white mb-4">
              <span className="w-1 h-1 rounded-full bg-gold" />
              {city.category}
            </span>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-tight mb-4">
              {localName}
            </h1>
            <p className="font-body text-sm sm:text-base text-white/80 leading-relaxed max-w-xl">
              {city.description}
            </p>
          </motion.div>

          {/* Search bar (lg:right side of hero, sits below on smaller screens) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="hidden lg:block w-[320px] ms-6"
          >
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-white/60" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tx.searchIn}
                className="w-full bg-white/15 backdrop-blur-xl border border-white/25 rounded-full ps-11 pe-4 py-3 text-white placeholder:text-white/55 text-sm focus:outline-none focus:bg-white/20 focus:border-gold/50 transition"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mobile/tablet search bar (under hero) */}
      <div className="lg:hidden max-w-7xl mx-auto px-5 sm:px-8 -mt-8 relative z-20">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tx.searchIn}
            className="w-full bg-card border border-border/60 rounded-full ps-11 pe-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-accent transition shadow-md"
          />
        </div>
      </div>

      {/* ── Sticky tabs ─────────────────────────────────────────────────────── */}
      <div className="sticky top-[64px] z-30 bg-background/85 backdrop-blur-xl border-b border-border/40 mt-8 lg:mt-0">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (t.id === 'ai') {
                      navigate(`/ai-assistant?city=${encodeURIComponent(city.name)}`);
                      return;
                    }
                    setTab(t.id);
                  }}
                  className={`relative flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                  {active && (
                    <motion.span
                      layoutId="city-tab-underline"
                      className="absolute inset-x-2 bottom-0 h-0.5 bg-gold rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-10 lg:py-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'tours' && (
              <TourGrid
                tours={filteredTours}
                cityName={city.name}
                tx={tx}
                Arrow={Arrow}
                loading={toursLoading}
                searchActive={Boolean(q)}
                navigate={navigate}
              />
            )}

            {tab === 'guides' && (
              <GuideGrid
                guides={filteredGuides}
                cityName={city.name}
                tx={tx}
                loading={guidesLoading}
                searchActive={Boolean(q)}
                navigate={navigate}
              />
            )}

            {tab === 'attractions' && (
              <AttractionsComingSoon tx={tx} />
            )}

            {tab === 'about' && (
              <AboutPanel city={city} tx={tx} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* "Plan with AI" banner — shown only on cities that actually have
            published tours, so cities with no packages aren't over-pushed
            toward the AI assistant. */}
        {tab !== 'ai' && !toursLoading && tours.length > 0 && (
          <PlanWithAiCard cityName={city.name} navigate={navigate} tx={tx} />
        )}
      </main>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function GridSkeleton({ shape = 'card' }) {
  // Three placeholder tiles so the page doesn't flash an empty state before
  // the Supabase call resolves.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`bg-card/50 border border-border/40 rounded-3xl ${shape === 'card' ? 'aspect-[4/3]' : 'h-44'} animate-pulse`}
        />
      ))}
    </div>
  );
}

function NoResults({ tx }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="font-body text-sm">{tx.noResults}</p>
    </div>
  );
}

function TourGrid({ tours, cityName, tx, Arrow, loading, searchActive, navigate }) {
  if (loading) return <GridSkeleton shape="card" />;
  if (tours.length === 0) {
    // A search miss against a populated catalog reads "No results";
    // an empty catalog gets the "no packages yet" CTA from the spec.
    if (searchActive) return <NoResults tx={tx} />;
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center">
          <MapIcon className="w-7 h-7 text-gold" />
        </div>
        <p className="font-heading text-lg text-foreground font-semibold">{tx.noTours}</p>
        <p className="font-body text-sm text-muted-foreground mt-2">{tx.noToursSub}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tours.map((tour) => {
        const img = tour.image_url || tour.cover_image || (Array.isArray(tour.gallery) && tour.gallery[0]) || 'https://images.unsplash.com/photo-1564960723835-2898c9df9297?w=600';
        const title = (tour.title && typeof tour.title === 'object' ? (tour.title.en || tour.title.fa || tour.title.ar) : tour.title) || 'Tour';
        const price = tour.price ?? tour.price_from ?? tour.price_usd;
        const href = tour.slug ? `/tours/${tour.slug}` : '/tours';
        return (
          <Link
            key={tour.id}
            to={href}
            className="group block bg-card rounded-3xl overflow-hidden border border-border/50 hover:border-accent/40 hover:shadow-xl transition-all duration-500"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img decoding="async" loading="lazy" src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <span className="absolute top-3 start-3 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[10px] font-semibold text-white">
                {cityName}
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-heading text-lg font-semibold text-foreground mb-3 group-hover:text-accent transition-colors">{title}</h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {tour.duration ? `${tour.duration} ${tx.days}` : '—'}
                </span>
                {price != null && (
                  <span className="flex items-center gap-1 text-accent font-semibold">
                    <DollarSign className="w-3.5 h-3.5" />
                    {tx.fromPrice} {Number(price).toLocaleString()}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                {tx.viewPackage}
                <Arrow className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function GuideGrid({ guides, cityName, tx, loading, searchActive, navigate }) {
  if (loading) return <GridSkeleton shape="card" />;
  if (guides.length === 0) {
    if (searchActive) return <NoResults tx={tx} />;
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
          <User className="w-7 h-7 text-accent" />
        </div>
        <p className="font-heading text-lg text-foreground font-semibold">{tx.noGuides}</p>
        <p className="font-body text-sm text-muted-foreground mt-2">{tx.noGuidesSub}</p>
        <button
          onClick={() => navigate('/signup')}
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-gold/40 text-gold hover:bg-gold/10 text-sm font-semibold transition-all"
        >
          <Compass className="w-4 h-4" />
          {tx.joinGuide}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {guides.map((guide) => (
        <div
          key={guide.id}
          className="bg-card rounded-3xl border border-border/50 p-6 hover:border-accent/40 hover:shadow-xl transition-all duration-500"
        >
          <div className="flex items-center gap-4 mb-4">
            <img decoding="async" loading="lazy"
              src={avatarFor(guide)}
              alt=""
              className="w-14 h-14 rounded-full object-cover border-2 border-gold/40 flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold text-foreground truncate">{guide.full_name || 'Local guide'}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Compass className="w-3 h-3 text-accent" />
                {guide.city || cityName}
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-accent" />
              {guide.languages || '—'}
            </p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-3.5 h-3.5 ${n <= Math.round(guide.rating || 0) ? 'text-gold fill-gold' : 'text-muted-foreground/30'}`}
                />
              ))}
              {guide.rating != null && (
                <span className="text-xs text-muted-foreground ms-1">{Number(guide.rating).toFixed(1)}</span>
              )}
            </div>
          </div>

          <Link
            to={`/chat/${guide.id}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-white text-sm font-semibold transition"
          >
            <MessageCircle className="w-4 h-4" />
            {tx.contactGuide}
          </Link>
        </div>
      ))}
    </div>
  );
}

function AttractionsComingSoon({ tx }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Landmark className="w-7 h-7 text-accent" />
      </div>
      <p className="font-heading text-lg text-foreground font-semibold">{tx.attractionsSoon}</p>
      <p className="font-body text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{tx.attractionsSoonSub}</p>
    </div>
  );
}

function AboutPanel({ city, tx }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-card border border-border/40 rounded-3xl p-6 sm:p-8">
        <p className="font-body text-base text-foreground/85 leading-relaxed mb-6">{city.description}</p>
        <h3 className="font-heading text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
          {tx.tabAttract}
        </h3>
        <ul className="grid sm:grid-cols-2 gap-2.5">
          {city.highlights.map((h) => (
            <li key={h} className="flex items-center gap-2.5 text-sm text-foreground/80">
              <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <aside className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 space-y-5">
        <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
          {tx.travelTips}
        </h3>
        <Tip icon={Calendar} label={tx.bestTime} value={city.bestTime} />
        <Tip icon={Plane}    label={tx.gettingThere} value={tx.gettingThereVal} />
        <Tip icon={Info}     label={tx.knowBefore}   value={tx.knowBeforeVal} />
      </aside>
    </div>
  );
}

function Tip({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">{label}</p>
        <p className="text-sm text-foreground/85 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

function PlanWithAiCard({ cityName, navigate, tx }) {
  return (
    <div className="mt-12 relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-navy/60 via-card to-card p-8 sm:p-10 text-center">
      <div className="absolute -top-20 -end-20 w-60 h-60 rounded-full bg-gold/15 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gold/15 border border-gold/30 mb-4">
          <Sparkles className="w-5 h-5 text-gold" />
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground mb-2.5">
          {tx.aiTitle}
        </h2>
        <p className="font-body text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          {tx.aiSub}
        </p>
        <button
          onClick={() => navigate(`/ai-assistant?city=${encodeURIComponent(cityName)}`)}
          className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-gold hover:bg-gold-light text-navy font-body font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-gold/30"
        >
          <Sparkles className="w-4 h-4" />
          {tx.openAi}
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
