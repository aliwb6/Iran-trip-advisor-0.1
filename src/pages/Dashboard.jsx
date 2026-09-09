import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Briefcase, PlusCircle, Bell, MessageCircle,
  User, Image as ImageIcon, CalendarDays, CreditCard, Star, Settings,
  ChevronDown, ChevronRight, LogOut, Edit2, Trash2, ExternalLink,
  Loader2, Clock, MapPin, DollarSign, Upload, Shield, TrendingUp,
  MessageSquare, Package, CheckCircle2, X, Plus, Globe, AlertTriangle,
  BookOpen, Send,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';
import { avatarFor } from '@/lib/avatar';
import TourForm from '@/components/dashboard/TourForm';
import MyArticlesSection from '../components/dashboard/MyArticlesSection';
import GuideRequestsView from '@/components/dashboard/GuideRequestsView';
import NotificationsView from '@/components/dashboard/NotificationsView';
import BookingsView from '@/components/dashboard/BookingsView';
import PaymentHistoryView from '@/components/dashboard/PaymentHistoryView';
import TripRequestForm from '@/components/profile/TripRequestForm';
import { checkProfileCompletion } from '@/lib/profileCompletion';
import { fetchProfileReviewsSafely } from '@/lib/reviews';
import { parseLanguages, popularLanguages } from '@/data/languages';
import { iranianDestinations } from '@/data/iranianCities';
import { cancelTripRequest } from '@/api/tripRequests';
import { fetchParticipantProfiles } from '@/api/participantProfiles';
import {
  MAX_SPECIAL_ABILITY_LENGTH,
  PROVIDER_SPECIAL_ABILITY_OPTIONS,
  addProviderAbility,
  normalizeProviderAbilities,
} from '@/lib/providerCapabilities';

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHART_DATA = MONTHS.map(name => ({ name, actual: 0, future: 0 }));

const NAV = [
  { id: 'home',       label: 'Dashboard',       Icon: LayoutDashboard },
  { id: 'my-tours',   label: 'My Tours',         Icon: Briefcase },
  { id: 'add-tour',   label: 'Add New Tour',     Icon: PlusCircle },
  { id: 'requests',          label: 'Requests',          Icon: Send },
  { id: 'my-trip-requests',  label: 'My Trip Requests',  Icon: MapPin },
  { id: 'notifications',     label: 'Notifications',     Icon: Bell },
  { id: 'chat',           label: 'Chat',             Icon: MessageCircle },
  {
    id: 'profile', label: 'Profile', Icon: User,
    sub: [
      { id: 'profile', label: 'Edit Profile' },
      { id: 'gallery', label: 'My Gallery' },
    ],
  },
  { id: 'bookings',   label: 'My Bookings',      Icon: CalendarDays },
  { id: 'payment',    label: 'Payment History',  Icon: CreditCard },
  { id: 'my-reviews', label: 'My Reviews',       Icon: Star },
  { id: 'articles',   label: 'My Articles',       Icon: BookOpen },
  { id: 'settings',   label: 'Settings',         Icon: Settings },
];

const PROFILE_FIELDS = ['full_name', 'phone', 'city', 'bio', 'avatar_url', 'languages'];
const PROFILE_TOUR_TYPES = [
  { value: 'Cultural', en: 'Cultural', fa: 'فرهنگی', ar: 'ثقافي' },
  { value: 'Adventure', en: 'Adventure', fa: 'ماجراجویی', ar: 'مغامرة' },
  { value: 'Nature', en: 'Nature & Eco', fa: 'طبیعت و بوم‌گردی', ar: 'الطبيعة والبيئة' },
  { value: 'History & Heritage', en: 'History & Heritage', fa: 'تاریخ و میراث', ar: 'التاريخ والتراث' },
  { value: 'Architecture', en: 'Architecture', fa: 'معماری', ar: 'العمارة' },
  { value: 'Food & Culinary', en: 'Food & Culinary', fa: 'غذا و آشپزی', ar: 'الطعام وفنون الطهي' },
  { value: 'Photography', en: 'Photography', fa: 'عکاسی', ar: 'التصوير' },
  { value: 'Religious', en: 'Religious', fa: 'مذهبی', ar: 'ديني' },
  { value: 'Luxury', en: 'Luxury', fa: 'لاکچری', ar: 'فاخر' },
  { value: 'Budget-friendly', en: 'Budget-friendly', fa: 'اقتصادی', ar: 'اقتصادي' },
  { value: 'Business Travel', en: 'Business Travel', fa: 'سفر تجاری', ar: 'سفر الأعمال' },
];

// ─── Shared sub-components ───────────────────────────────────────────────────

function EmptyState({ Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-white/25" />
      </div>
      <p className="text-white/60 font-medium text-sm mb-1">{title}</p>
      {desc && <p className="text-white/35 text-xs max-w-xs">{desc}</p>}
    </div>
  );
}

const parseProfileCities = (profile) => {
  const source = Array.isArray(profile?.other_cities) && profile.other_cities.length
    ? profile.other_cities
    : String(profile?.city || '').split(/[,،;]/);
  const seen = new Set();
  return source.map(city => String(city || '').trim()).filter(city => {
    const key = city.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function ProfileCityMultiSelect({ values, onChange, lang }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const normalizedSearch = search.trim().toLocaleLowerCase();

  useEffect(() => {
    if (!open) return;
    const closeOutside = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  const isSelected = city => values.some(value => value.toLocaleLowerCase() === city.toLocaleLowerCase());
  const labelFor = city => {
    const match = iranianDestinations.find(item => item.en.toLocaleLowerCase() === city.toLocaleLowerCase());
    return match?.[lang] || match?.en || city;
  };
  const matches = iranianDestinations
    .filter(city => !isSelected(city.en))
    .filter(city => normalizedSearch && [city.en, city.fa, city.ar].some(label => label.toLocaleLowerCase().includes(normalizedSearch)))
    .slice(0, 12);
  const exactMatch = iranianDestinations.find(city => [city.en, city.fa, city.ar].some(label => label.toLocaleLowerCase() === normalizedSearch));
  const customAlreadySelected = isSelected(search.trim());

  const add = city => {
    const clean = city.trim();
    if (!clean || isSelected(clean)) return;
    onChange([...values, clean]);
    setSearch('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map(city => (
          <button key={city} type="button" onClick={() => onChange(values.filter(value => value !== city))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(178,85%,32%)]/20 border border-[hsl(178,85%,32%)] text-teal-300 text-xs" title="Remove city">
            <MapPin className="w-3 h-3" />{labelFor(city)}<X className="w-3 h-3" />
          </button>
        ))}
      </div>
      <div className="relative">
        <MapPin className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          ref={inputRef}
          value={search}
          onChange={event => { setSearch(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter') {
              event.preventDefault();
              add(matches[0]?.en || exactMatch?.en || search);
            }
          }}
          className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)] focus:ring-1 focus:ring-[hsl(178,85%,32%)]/50 transition"
          placeholder={lang === 'fa' ? 'جست‌وجو و افزودن شهر…' : lang === 'ar' ? 'ابحث عن مدينة وأضفها…' : 'Search and add a city…'}
          autoComplete="off"
        />
      </div>
      <AnimatePresence>
        {open && normalizedSearch && (matches.length > 0 || (!exactMatch && !customAlreadySelected)) && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-40 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl bg-[hsl(222,45%,14%)] border border-white/10 shadow-2xl py-1">
            {matches.map(city => (
              <button key={city.en} type="button" onMouseDown={event => { event.preventDefault(); add(city.en); }} className="w-full flex items-center gap-2 px-3 py-2 text-start text-sm text-white/70 hover:bg-white/[0.07] hover:text-white">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />{city[lang] || city.en}
              </button>
            ))}
            {!exactMatch && !customAlreadySelected && (
              <button type="button" onMouseDown={event => { event.preventDefault(); add(search); }} className="w-full flex items-center gap-2 px-3 py-2 text-start text-sm text-teal-300 hover:bg-teal-500/10 border-t border-white/[0.06]">
                <Plus className="w-3.5 h-3.5" />{lang === 'fa' ? `افزودن «${search.trim()}»` : lang === 'ar' ? `إضافة «${search.trim()}»` : `Add “${search.trim()}”`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-[hsl(38,62%,58%)] fill-[hsl(38,62%,58%)]' : 'text-white/20'}`}
        />
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ section, onNavigate, profileExpanded, setProfileExpanded, userName, userRole, onLogout, profile }) {
  const { t, lang, dir } = useI18n();
  const activeId = section || 'home';
  const profileCheck = profile ? checkProfileCompletion(profile) : null;
  const canAddTour = !profile || profile.role === 'traveler' || (profile.license_status === 'verified' && profileCheck?.completed);

  const NAV_LABELS = {
    home:        t('dashboard_nav_home'),
    'my-tours':  t('dashboard_nav_tours'),
    'add-tour':  t('dashboard_nav_add_tour'),
    requests:       t('dashboard_nav_requests'),
    notifications:  'Notifications',
    chat:           t('dashboard_nav_chat'),
    profile:     t('dashboard_nav_profile'),
    gallery:     t('dashboard_nav_gallery'),
    bookings:    t('dashboard_nav_bookings'),
    payment:     t('dashboard_nav_payment'),
    'my-reviews':t('dashboard_nav_reviews'),
    'articles':  t('article_section_title'),
    settings:    t('dashboard_nav_settings'),
  };

  const isActive = (id) => {
    if (id === 'home') return activeId === 'home';
    if (id === 'profile') return activeId === 'profile' || activeId === 'gallery';
    return activeId === id;
  };

  return (
    <aside className="w-[190px] flex-shrink-0 h-screen sticky top-0 bg-[hsl(222,55%,8%)] border-r border-white/[0.07] flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.07]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-[hsl(178,85%,32%)] flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm leading-tight">Iran Tour<br />
            <span className="text-[hsl(38,62%,58%)] font-normal text-[10px] tracking-wider uppercase">Dashboard</span>
          </span>
        </Link>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-white/[0.07]">
        <div className="w-9 h-9 rounded-xl bg-[hsl(178,85%,32%)] flex items-center justify-center mb-2">
          <span className="text-white text-sm font-bold">
            {userName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
          </span>
        </div>
        <p className="text-white text-xs font-medium leading-tight truncate">{userName || 'Guide'}</p>
        <p className="text-white/40 text-[10px] capitalize mt-0.5">{userRole || 'guide'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(item => {
          const isDisabled = item.id === 'add-tour' && !canAddTour;
          return (
          <div key={item.id}>
            <button
              onClick={() => {
                if (isDisabled) {
                  alert(item.id === 'add-tour' && profile?.role !== 'traveler' ? t('profile_completion_required_for_tour') : '');
                  return;
                }
                if (item.sub) setProfileExpanded(v => !v);
                else onNavigate(item.id);
              }}
              disabled={isDisabled}
              title={isDisabled ? t('profile_completion_required_for_tour') : ''}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-all duration-150 group ${
                isDisabled
                  ? 'text-white/25 cursor-not-allowed opacity-50'
                  : isActive(item.id)
                  ? 'bg-[hsl(178,85%,32%)]/20 text-[hsl(178,85%,50%)]'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <item.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {NAV_LABELS[item.id] || item.label}
              </span>
              {item.sub && (
                profileExpanded
                  ? <ChevronDown className="w-3 h-3 text-white/30" />
                  : <ChevronRight className="w-3 h-3 text-white/30" />
              )}
            </button>

            {/* Sub-items */}
            <AnimatePresence>
              {item.sub && profileExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {item.sub.map(sub => (
                    <button
                      key={sub.id + sub.label}
                      onClick={() => onNavigate(sub.id)}
                      className={`w-full flex items-center gap-2 ps-9 pe-3 py-1.5 text-xs rounded-xl transition-all duration-150 ${
                        activeId === sub.id
                          ? 'text-[hsl(178,85%,50%)]'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {NAV_LABELS[sub.id] || sub.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/[0.07] pt-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t('dashboard_sign_out')}
        </button>
      </div>
    </aside>
  );
}

// ─── LicenseCard ──────────────────────────────────────────────────────────────

function LicenseCard({ profile, onSave }) {
  const { t, lang } = useI18n();
  const fileRef = useRef(null);
  const userId = profile?.id;

  const [licensePath, setLicensePath] = useState(profile?.license_url || '');
  const [status, setStatus] = useState(profile?.license_status || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const openPicker = () => { if (!uploading) fileRef.current?.click(); };

  const handleUpload = async (file) => {
    if (!file || !userId) return;
    setError('');

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { setError(t('license_invalid_type')); return; }
    if (file.size > 5 * 1024 * 1024) { setError(t('license_too_large')); return; }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('licenses').upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ license_url: path, license_status: 'pending_review' })
        .eq('id', userId);
      if (dbErr) throw dbErr;

      setLicensePath(path);
      setStatus('pending_review');
      onSave?.({ ...profile, license_url: path, license_status: 'pending_review' });
      toast.success(t('dashboard_license_pending'));
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleView = async () => {
    if (!licensePath) return;
    const { data, error: signErr } = await supabase.storage
      .from('licenses').createSignedUrl(licensePath, 60);
    if (signErr) { setError(signErr.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const statusLabel =
    status === 'verified' ? t('dashboard_license_verified')
    : status === 'rejected' ? t('dashboard_license_rejected')
    : t('dashboard_license_pending');

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleUpload(event.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
      }}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col rounded-xl transition ${dragActive ? 'bg-[hsl(178,85%,32%)]/10 ring-2 ring-[hsl(178,85%,42%)]' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-[hsl(38,62%,58%)]" />
        <p className="text-white/70 text-xs font-medium">{t('dashboard_my_license')}</p>
      </div>

      {licensePath ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <div className="w-12 h-12 rounded-2xl bg-[hsl(178,85%,32%)]/15 border border-[hsl(178,85%,32%)]/30 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-[hsl(178,85%,45%)]" />
          </div>
          <p className="text-white/50 text-xs text-center mb-3">{statusLabel}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleView}
              className="px-3 py-1.5 rounded-xl border border-white/20 text-white/70 text-xs font-medium hover:border-[hsl(38,62%,58%)] hover:text-[hsl(38,62%,58%)] transition">
              {t('license_view')}
            </button>
            <button type="button" onClick={openPicker} disabled={uploading}
              className="px-3 py-1.5 rounded-xl border border-white/20 text-white/70 text-xs font-medium hover:border-[hsl(38,62%,58%)] hover:text-[hsl(38,62%,58%)] transition disabled:opacity-50">
              {uploading ? '...' : t('license_replace')}
            </button>
          </div>
        </div>
      ) : (
        <div onClick={openPicker}
          className="flex-1 flex flex-col items-center justify-center py-4 cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border-2 border-dashed border-white/15 flex items-center justify-center mb-3">
            {uploading
              ? <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
              : <Upload className="w-5 h-5 text-white/25" />}
          </div>
          <p className="text-white/40 text-xs text-center mb-1">{t('dashboard_license_missing')}</p>
          <p className="text-white/25 text-[10px] text-center mb-4">
            {lang === 'fa' ? 'فایل را اینجا رها کنید یا از دستگاه انتخاب کنید' : lang === 'ar' ? 'اسحب الملف هنا أو اختره من جهازك' : 'Drop a file here or choose from your device'}
          </p>
          <button type="button" onClick={(e) => { e.stopPropagation(); openPicker(); }} disabled={uploading}
            className="px-4 py-2 rounded-xl border border-white/20 text-white/60 text-xs font-medium hover:border-[hsl(38,62%,58%)] hover:text-[hsl(38,62%,58%)] transition disabled:opacity-50">
            {uploading ? t('dashboard_saving') : t('dashboard_upload_license')}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-[11px] text-center mt-2">{error}</p>}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
    </div>
  );
}

// ─── HomeView ─────────────────────────────────────────────────────────────────

function HomeView({ profile, tours, reviews, userId, lang, onNavigate, onOpenChat, onProfileSave }) {
  const { t, lang: i18nLang, dir } = useI18n();
  const [reqTab, setReqTab] = useState('new');
  const [latestChats, setLatestChats] = useState([]);
  const [latestChatsLoading, setLatestChatsLoading] = useState(true);
  const [tourRequests, setTourRequests] = useState([]);

  const upcomingTour = tours.find(tr => tr.status === 'published');
  const totalTours = tours.length;
  const publishedCount = tours.filter(tr => tr.status === 'published').length;
  const draftCount = tours.filter(tr => tr.status === 'draft').length;
  const totalReviews = reviews.length;
  const avgRating = totalReviews
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews).toFixed(1)
    : '—';

  const missingItems = [];
  if (!profile?.avatar_url && !profile?.profile_image) missingItems.push('profile photo');
  if (!profile?.bio && !profile?.description) missingItems.push('bio / description');
  if (!profile?.license_url && !profile?.license_verified) missingItems.push('license');
  const isProfileIncomplete = missingItems.length > 0;

  // Live: load the 3 most-recent conversations for this user (Latest Chat widget)
  // and any inbound traveller messages that look like a new request (Tour Requests).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(80);

      if (cancelled) return;
      if (error) {
        console.error('[Dashboard] latest messages fetch failed', error);
        setLatestChatsLoading(false);
        return;
      }

      // Group by the other participant; keep first (newest) message per conversation.
      const groups = new Map();
      (msgs || []).forEach((m) => {
        const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
        if (!otherId) return;
        if (!groups.has(otherId)) {
          groups.set(otherId, { otherId, last: m, unread: 0 });
        }
        if (m.receiver_id === userId && !m.is_read) {
          groups.get(otherId).unread += 1;
        }
      });

      const otherIds = [...groups.keys()];
      let profiles = [];
      if (otherIds.length > 0) {
        try {
          profiles = await fetchParticipantProfiles(otherIds);
        } catch (profileError) {
          console.error('[Dashboard] participant profiles fetch failed', profileError);
        }
      }

      const list = [...groups.values()].map((g) => ({
        ...g,
        profile: profiles.find((p) => p.id === g.otherId) || null,
      }));

      if (!cancelled) {
        setLatestChats(list.slice(0, 3));
        // Unread inbound messages double as "new" tour requests until a dedicated table exists.
        const inboundUnread = (msgs || [])
          .filter((m) => m.receiver_id === userId && !m.is_read)
          .slice(0, 5)
          .map((m) => ({
            ...m,
            sender: profiles.find((p) => p.id === m.sender_id) || null,
          }));
        setTourRequests(inboundUnread);
        setLatestChatsLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel(`home-messages-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const messagePreview = (m) => {
    if (!m) return '';
    const isMine = m.sender_id === userId;
    const prefix = isMine
      ? (lang === 'fa' ? 'شما: ' : lang === 'ar' ? 'أنت: ' : 'You: ')
      : '';
    return `${prefix}${m.content || ''}`;
  };

  const timeLabel = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  const cardBase = 'bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-5';

  return (
    <div className="space-y-5">

      {isProfileIncomplete && (
        <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 font-semibold text-sm mb-0.5">Complete your profile to receive tour requests</p>
            <p className="text-amber-200/60 text-xs">
              Missing: {missingItems.join(', ')}. Tourists and agencies can only find guides with complete profiles.
            </p>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
          >
            Fix Now
          </button>
        </div>
      )}

      {/* ── Row 1: Welcome / Upcoming Tour / License ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Welcome */}
        <div className={`${cardBase} flex flex-col`}>
          <div>
            <p className="text-white/40 text-xs mb-1">{t('dashboard_welcome')}</p>
            <h2 className="text-white font-bold text-lg leading-tight">
              {profile?.full_name?.split(' ')[0] || 'Guide'} 👋
            </h2>
            <p className="text-white/50 text-xs mt-2 leading-relaxed">
              {t('dashboard_nav_tours')}
            </p>
          </div>
          <button
            onClick={() => onNavigate('add-tour')}
            className="mt-4 flex-1 min-h-[140px] w-full rounded-xl bg-[hsl(178,85%,32%)]/[0.08] hover:bg-[hsl(178,85%,32%)]/[0.15] border-2 border-dashed border-[hsl(178,85%,32%)]/40 hover:border-[hsl(178,85%,45%)] flex flex-col items-center justify-center gap-2 text-[hsl(178,85%,50%)] transition group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[hsl(178,85%,32%)]/20 group-hover:bg-[hsl(178,85%,32%)] flex items-center justify-center transition">
              <Plus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-xs font-semibold">+ {t('dashboard_add_tour')}</span>
          </button>
        </div>

        {/* Upcoming Tour */}
        <div className={`${cardBase} flex flex-col`}>
          <p className="text-white/40 text-xs mb-3">{t('dashboard_upcoming_tour')}</p>
          {upcomingTour ? (
            <div>
              {upcomingTour.image_url && (
                <div className="w-full aspect-[16/7] rounded-xl overflow-hidden mb-3">
                  <img decoding="async" loading="lazy" src={upcomingTour.image_url} alt={upcomingTour.title} className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-white font-semibold text-sm leading-tight mb-1 line-clamp-2">
                {upcomingTour.title}
              </p>
              <div className="flex items-center gap-3 text-white/40 text-[11px]">
                {upcomingTour.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{upcomingTour.location}</span>
                )}
                {upcomingTour.duration && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{upcomingTour.duration}d</span>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('add-tour')}
              className="flex-1 min-h-[180px] w-full rounded-xl border-2 border-dashed border-white/15 hover:border-[hsl(178,85%,45%)] hover:bg-[hsl(178,85%,32%)]/[0.05] flex flex-col items-center justify-center gap-2 text-white/35 hover:text-[hsl(178,85%,50%)] transition group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.06] group-hover:bg-[hsl(178,85%,32%)]/20 flex items-center justify-center transition">
                <Plus className="w-6 h-6" />
              </div>
              <p className="font-medium text-sm">{t('dashboard_no_upcoming')}</p>
              <p className="text-[11px] text-white/30">{t('dashboard_add_tour')}</p>
            </button>
          )}
        </div>

        {/* License */}
        <div className={`${cardBase} flex flex-col`}>
          <LicenseCard profile={profile} onSave={onProfileSave} />
        </div>
      </div>

      {/* ── Row 2: Tour Requests / Latest Chat ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* Tour Requests */}
        <div className={`${cardBase} md:col-span-3`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[hsl(178,85%,50%)]" />
              <p className="text-white/70 text-sm font-semibold">{t('dashboard_tour_requests')}</p>
            </div>
            <div className="flex bg-white/[0.06] rounded-lg p-0.5">
              {['new', 'invitations'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setReqTab(tab)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all capitalize ${
                    reqTab === tab ? 'bg-[hsl(178,85%,32%)] text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {tab === 'new' ? t('dashboard_new_requests') : t('dashboard_invitations')}
                </button>
              ))}
            </div>
          </div>
          {reqTab === 'new' && tourRequests.length > 0 ? (
            <div className="space-y-2">
              {tourRequests.map((req) => (
                <button
                  key={req.id}
                  onClick={() => onOpenChat(req.sender_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-[hsl(178,85%,32%)]/40 transition text-left"
                >
                  <img decoding="async" loading="lazy"
                    src={avatarFor(req.sender)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-white text-xs font-semibold truncate">
                        {req.sender?.full_name || (lang === 'fa' ? 'مسافر' : lang === 'ar' ? 'مسافر' : 'Traveller')}
                      </p>
                      <span className="text-white/35 text-[10px] flex-shrink-0">{timeLabel(req.created_at)}</span>
                    </div>
                    <p className="text-white/55 text-[11px] truncate">{req.content}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[hsl(178,85%,45%)] flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              Icon={Bell}
              title={reqTab === 'new' ? t('dashboard_empty_requests') : t('dashboard_empty_chat')}
              desc={t('dashboard_no_requests')}
            />
          )}
        </div>

        {/* Latest Chat */}
        <div className={`${cardBase} md:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/70 text-sm font-semibold">{t('dashboard_latest_chat')}</p>
            {latestChats.length > 0 && (
              <button
                onClick={() => onNavigate('chat')}
                className="text-[hsl(178,85%,50%)] hover:text-[hsl(178,85%,60%)] text-[11px] font-medium transition"
              >
                {lang === 'fa' ? 'مشاهده همه' : lang === 'ar' ? 'عرض الكل' : 'View all'}
              </button>
            )}
          </div>
          {latestChatsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-[hsl(178,85%,45%)] animate-spin" />
            </div>
          ) : latestChats.length === 0 ? (
            <EmptyState
              Icon={MessageSquare}
              title={t('dashboard_no_messages')}
              desc={t('dashboard_empty_chat')}
            />
          ) : (
            <div className="space-y-2">
              {latestChats.map((c) => (
                <button
                  key={c.otherId}
                  onClick={() => onOpenChat(c.otherId)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition text-left"
                >
                  <img decoding="async" loading="lazy"
                    src={avatarFor(c.profile)}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-white text-xs font-semibold truncate">
                        {c.profile?.full_name || (lang === 'fa' ? 'کاربر' : lang === 'ar' ? 'مستخدم' : 'User')}
                      </p>
                      <span className="text-white/35 text-[10px] flex-shrink-0">{timeLabel(c.last?.created_at)}</span>
                    </div>
                    <p className={`text-[11px] truncate ${c.unread > 0 ? 'text-white/90 font-medium' : 'text-white/45'}`}>
                      {messagePreview(c.last)}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-[hsl(178,85%,32%)] text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Earnings Chart ── */}
      <div className={cardBase}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[hsl(178,85%,45%)]" />
            <p className="text-white/80 text-sm font-semibold">{t('dashboard_earnings_title')}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(178,85%,32%)]" />
              Actual Earnings: <span className="text-white font-medium">$0</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(38,62%,52%)]" />
              Future Earnings: <span className="text-white font-medium">$0</span>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={CHART_DATA} barSize={10} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(222,55%,12%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: 'white',
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="actual" name="Actual" fill="hsl(178,85%,32%)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="future" name="Future" fill="hsl(38,62%,52%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 4: Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('dashboard_stat_tours'), value: totalTours, color: 'text-white', Icon: Briefcase },
          { label: t('dashboard_published'), value: publishedCount, color: 'text-emerald-400', Icon: CheckCircle2 },
          { label: t('dashboard_draft'), value: draftCount, color: 'text-yellow-400', Icon: Package },
          { label: t('dashboard_recent_reviews'), value: totalReviews, extra: avgRating !== '—' ? `Avg ${avgRating}★` : null, color: 'text-[hsl(38,62%,58%)]', Icon: Star },
        ].map(stat => (
          <div key={stat.label} className={`${cardBase} flex items-center gap-3`}>
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <stat.Icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-white/40 text-[11px]">{stat.label}</p>
              {stat.extra && <p className="text-white/30 text-[10px]">{stat.extra}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 5: Recent Reviews ── */}
      <div className={cardBase}>
        <p className="text-white/70 text-sm font-semibold mb-4">{t('dashboard_recent_reviews')}</p>
        {reviews.length === 0 ? (
          <EmptyState
            Icon={Star}
            title={t('dashboard_no_reviews')}
            desc={t('dashboard_empty_reviews')}
          />
        ) : (
          <div className="space-y-4">
            {reviews.slice(0, 5).map(review => (
              <div key={review.id} className="flex items-start gap-3 pb-4 border-b border-white/[0.07] last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-[hsl(178,85%,32%)]/30 flex items-center justify-center flex-shrink-0 text-[hsl(178,85%,50%)] text-xs font-bold">
                  {(review.reviewer?.full_name || review.reviewer_name)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-white text-xs font-medium">{review.reviewer?.full_name || review.reviewer_name || 'Anonymous'}</p>
                    <StarRating rating={review.rating || 0} />
                  </div>
                  {review.review_text && (
                    <p className="text-white/45 text-[11px] leading-relaxed line-clamp-2">{review.review_text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MyToursView ──────────────────────────────────────────────────────────────

function MyToursView({ tours, onEdit, onDelete }) {
  const { t, lang, dir } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white font-bold text-lg">{t('dashboard_my_tours')}</h2>
        <span className="text-white/40 text-xs">{tours.length} tour{tours.length !== 1 ? 's' : ''}</span>
      </div>
      {tours.length === 0 ? (
        <div className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl">
          <EmptyState Icon={Briefcase} title={t('dashboard_no_tours')} desc={t('dashboard_no_tours_desc')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tours.map(tour => (
            <div key={tour.id} className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl overflow-hidden group hover:border-white/20 transition-all duration-200">
              {/* Image */}
              <div className="aspect-[16/9] bg-white/5 relative overflow-hidden">
                {tour.image_url ? (
                  <img decoding="async" loading="lazy" src={tour.image_url} alt={tour.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/15" />
                  </div>
                )}
                {/* Status badge */}
                {(() => {
                  const STATUS_CFG = {
                    pending:   { icon: '⏳', label: lang === 'fa' ? 'در انتظار تایید' : lang === 'ar' ? 'بانتظار الموافقة' : 'Awaiting Approval', wrap: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300' },
                    published: { icon: '✅', label: lang === 'fa' ? 'تایید شده' : lang === 'ar' ? 'موافق عليه' : 'Approved',                      wrap: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
                    active:    { icon: '✅', label: lang === 'fa' ? 'تایید شده' : lang === 'ar' ? 'موافق عليه' : 'Approved',                      wrap: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
                    inactive:  { icon: '⏸', label: lang === 'fa' ? 'غیرفعال'   : lang === 'ar' ? 'غير نشط'   : 'Inactive',                       wrap: 'bg-gray-500/20    border-gray-500/30    text-gray-300'    },
                    draft:     { icon: '📝', label: lang === 'fa' ? 'پیش‌نویس'   : lang === 'ar' ? 'مسودة'    : 'Draft',                          wrap: 'bg-gray-500/20    border-gray-500/30    text-gray-300'    },
                  };
                  const cfg = STATUS_CFG[tour.status] || STATUS_CFG.draft;
                  return (
                    <div className={`absolute top-2.5 end-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold backdrop-blur-sm border ${cfg.wrap}`}>
                      <span>{cfg.icon}</span>
                      {cfg.label}
                    </div>
                  );
                })()}
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="text-white font-semibold text-sm mb-2 line-clamp-2">{tour.title}</p>
                <div className="flex items-center gap-3 text-white/40 text-[11px] mb-3">
                  {tour.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tour.location}</span>}
                  {tour.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{tour.duration}d</span>}
                  {tour.price && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{Number(tour.price).toLocaleString()}</span>}
                </div>

                {/* Admin reason — only shown when an admin_note exists and tour isn't approved */}
                {tour.admin_note && tour.status !== 'published' && tour.status !== 'active' && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/20">
                    <p className="text-red-300/90 text-[10px] font-semibold uppercase tracking-wide mb-0.5">
                      {lang === 'fa' ? 'دلیل:' : lang === 'ar' ? 'السبب:' : 'Reason:'}
                    </p>
                    <p className="text-red-300/80 text-xs leading-snug">{tour.admin_note}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(tour)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white text-xs font-medium transition"
                  >
                    <Edit2 className="w-3 h-3" /> {t('dashboard_edit')}
                  </button>
                  {tour.slug && (
                    <Link
                      to={`/tours/${tour.slug}`}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white transition"
                      title="View on site"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  <button
                    onClick={() => onDelete(tour.id)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/[0.08] hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition"
                    title="Delete tour"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ProfileView ──────────────────────────────────────────────────────────────

function ProfileView({ profile, userId, onSave }) {
  const { t, lang, dir } = useI18n();
  const isAgency = profile?.role === 'agency';
  const initialTourTypes = Array.isArray(profile?.tour_types)
    ? profile.tour_types
    : Array.isArray(profile?.specialties)
      ? profile.specialties
      : profile?.specialty
        ? [profile.specialty]
        : [];
  const [form, setForm] = useState({
    full_name:  profile?.full_name || '',
    phone:      profile?.phone || '',
    cities:     parseProfileCities(profile),
    bio:        profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    languages:  parseLanguages(profile?.languages),
    tourTypes:  initialTourTypes,
    specialAbilities: normalizeProviderAbilities(profile?.special_abilities),
    hasVehicle: typeof profile?.has_vehicle === 'boolean' ? profile.has_vehicle : null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [otherLanguage, setOtherLanguage] = useState('');
  const [otherTourType, setOtherTourType] = useState('');
  const [otherSpecialAbility, setOtherSpecialAbility] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const avatarFileRef = useRef(null);

  const isGuideOrAgencyProfile = profile?.role === 'guide' || profile?.role === 'agency';
  const liveProfileCheck = isGuideOrAgencyProfile
    ? checkProfileCompletion({
        ...profile,
        ...form,
        city: form.cities.join(', '),
        languages: form.languages.join(', '),
        specialties: isAgency ? profile?.specialties : form.tourTypes,
        tour_types: isAgency ? form.tourTypes : profile?.tour_types,
        special_abilities: form.specialAbilities,
        has_vehicle: form.hasVehicle,
      })
    : null;
  const completionFields = PROFILE_FIELDS.filter(field => field !== 'languages' && field !== 'city');
  const completion = liveProfileCheck?.percentage ?? Math.round(
    [...completionFields.map(field => form[field]), form.cities.length].filter(value => value?.toString().trim()).length / (completionFields.length + 1) * 100
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleLanguage = (language) => {
    setForm(prev => {
      const exists = prev.languages.some(item => item.toLocaleLowerCase() === language.toLocaleLowerCase());
      return {
        ...prev,
        languages: exists
          ? prev.languages.filter(item => item.toLocaleLowerCase() !== language.toLocaleLowerCase())
          : [...prev.languages, language],
      };
    });
  };

  const addOtherLanguage = () => {
    const language = otherLanguage.trim();
    if (!language) return;
    setForm(prev => ({
      ...prev,
      languages: parseLanguages([...prev.languages, language]),
    }));
    setOtherLanguage('');
  };

  const toggleTourType = (tourType) => {
    setForm(prev => ({
      ...prev,
      tourTypes: prev.tourTypes.some(item => item.toLocaleLowerCase() === tourType.toLocaleLowerCase())
        ? prev.tourTypes.filter(item => item.toLocaleLowerCase() !== tourType.toLocaleLowerCase())
        : [...prev.tourTypes, tourType],
    }));
  };

  const addOtherTourType = () => {
    const tourType = otherTourType.trim();
    if (!tourType) return;
    setForm(prev => ({
      ...prev,
      tourTypes: prev.tourTypes.some(item => item.toLocaleLowerCase() === tourType.toLocaleLowerCase())
        ? prev.tourTypes
        : [...prev.tourTypes, tourType],
    }));
    setOtherTourType('');
  };

  const toggleSpecialAbility = (ability) => {
    setForm(prev => {
      const selected = prev.specialAbilities.some(
        item => item.toLocaleLowerCase() === ability.toLocaleLowerCase(),
      );
      return {
        ...prev,
        specialAbilities: selected
          ? prev.specialAbilities.filter(item => item.toLocaleLowerCase() !== ability.toLocaleLowerCase())
          : addProviderAbility(prev.specialAbilities, ability),
      };
    });
  };

  const addOtherSpecialAbility = () => {
    const ability = otherSpecialAbility.trim();
    if (!ability) return;
    setForm(prev => ({
      ...prev,
      specialAbilities: addProviderAbility(prev.specialAbilities, ability),
    }));
    setOtherSpecialAbility('');
  };

  const handleAvatarUpload = async (file) => {
    if (!file || !userId) return;
    setError('');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(lang === 'fa' ? 'فقط تصاویر JPG، PNG یا WEBP مجاز هستند.' : 'Only JPG, PNG or WEBP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(lang === 'fa' ? 'حجم تصویر باید کمتر از ۵ مگابایت باشد.' : 'Profile image must be smaller than 5 MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = data.publicUrl;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);
      if (profileError) throw profileError;

      setForm(prev => ({ ...prev, avatar_url: avatarUrl }));
      onSave({ ...profile, avatar_url: avatarUrl });
      toast.success(lang === 'fa' ? 'عکس پروفایل بارگذاری شد.' : 'Profile photo uploaded.');
    } catch (err) {
      setError(err.message || 'Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
      setAvatarDragActive(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { tourTypes, cities, specialAbilities, hasVehicle, ...profileFields } = form;
      const profilePayload = {
        ...profileFields,
        city: cities.join(', '),
        primary_city: cities[0] || null,
        other_cities: cities.length ? cities : null,
        languages: form.languages.join(', '),
        special_abilities: normalizeProviderAbilities(specialAbilities),
        has_vehicle: hasVehicle,
        ...(isAgency ? { tour_types: tourTypes } : { specialties: tourTypes }),
      };
      const { error: err } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', userId);
      if (err) {
        throw err;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSave({ ...profile, ...profilePayload });
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)] focus:ring-1 focus:ring-[hsl(178,85%,32%)]/50 transition';
  const labelClass = 'block text-white/50 text-xs mb-1.5 font-medium';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-lg">{t('dashboard_my_profile')}</h2>
          <p className="text-white/40 text-xs mt-0.5">{t('dashboard_save_profile')}</p>
        </div>
        {/* Completion */}
        <div className="text-right">
          <p className="text-white/40 text-xs mb-1.5">{t('dashboard_profile_completion')} {completion}%</p>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[hsl(178,85%,32%)] rounded-full transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      {/* License status is separate from user-completable profile fields. */}
      {isGuideOrAgencyProfile && profile?.license_status !== 'verified' && (
        <div className={`mb-4 p-4 rounded-xl border flex items-start gap-3 ${profile?.license_url && profile?.license_status !== 'rejected' ? 'bg-amber-500/10 border-amber-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${profile?.license_url && profile?.license_status !== 'rejected' ? 'text-amber-400' : 'text-red-400'}`} />
          <div>
            <p className={`font-semibold text-sm ${profile?.license_url && profile?.license_status !== 'rejected' ? 'text-amber-400' : 'text-red-400'}`}>
              {profile?.license_status === 'rejected' ? 'License Document Rejected' : profile?.license_url ? 'License Awaiting Admin Review' : 'License Document Required'}
            </p>
            <p className={`text-xs mt-1 ${profile?.license_url && profile?.license_status !== 'rejected' ? 'text-amber-400/70' : 'text-red-400/70'}`}>
              {profile?.license_status === 'rejected'
                ? 'Please upload a replacement license document for review.'
                : profile?.license_url
                  ? 'Your profile information is complete. An admin must verify your license before your profile becomes public or you can create tours.'
                  : 'Upload your license document below. Admin verification happens separately after upload.'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-6 space-y-5">

        {/* Avatar upload */}
        <div className="pb-5 border-b border-white/[0.07]">
          <label className={labelClass}>{lang === 'fa' ? 'عکس پروفایل' : lang === 'ar' ? 'صورة الملف الشخصي' : 'Profile Photo'}</label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploadingAvatar && avatarFileRef.current?.click()}
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && !uploadingAvatar) {
                event.preventDefault();
                avatarFileRef.current?.click();
              }
            }}
            onDragEnter={event => { event.preventDefault(); setAvatarDragActive(true); }}
            onDragOver={event => { event.preventDefault(); setAvatarDragActive(true); }}
            onDragLeave={event => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget)) setAvatarDragActive(false);
            }}
            onDrop={event => {
              event.preventDefault();
              setAvatarDragActive(false);
              handleAvatarUpload(event.dataTransfer.files?.[0]);
            }}
            className={`flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition ${avatarDragActive
              ? 'border-[hsl(178,85%,45%)] bg-[hsl(178,85%,32%)]/10'
              : 'border-white/15 bg-white/[0.02] hover:border-[hsl(178,85%,40%)]/60'
            }`}
          >
            <div className="w-20 h-20 rounded-2xl bg-[hsl(178,85%,32%)]/20 border border-[hsl(178,85%,32%)]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img decoding="async" src={avatarFor(form)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">
                {uploadingAvatar
                  ? (lang === 'fa' ? 'در حال بارگذاری…' : 'Uploading…')
                  : (lang === 'fa' ? 'عکس را اینجا رها کنید یا برای انتخاب کلیک کنید' : lang === 'ar' ? 'اسحب الصورة هنا أو انقر للاختيار' : 'Drop your photo here or click to choose')}
              </p>
              <p className="text-white/30 text-xs mt-1">JPG, PNG, WEBP · max 5 MB</p>
            </div>
            {uploadingAvatar ? <Loader2 className="w-5 h-5 text-teal-400 animate-spin" /> : <Upload className="w-5 h-5 text-white/35" />}
          </div>
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={event => handleAvatarUpload(event.target.files?.[0])}
          />
        </div>

        {/* Name + Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} className={inputClass} placeholder="Your name" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input name="phone" type="tel" value={form.phone} onChange={handleChange} className={inputClass} placeholder="+98 ..." dir="ltr" />
          </div>
        </div>

        {/* Service cities */}
        <div>
          <label className={labelClass}>{lang === 'fa' ? 'شهرهای فعالیت' : lang === 'ar' ? 'مدن النشاط' : 'Service Cities'}</label>
          <ProfileCityMultiSelect values={form.cities} onChange={cities => setForm(prev => ({ ...prev, cities }))} lang={lang} />
        </div>

        {/* Languages */}
        {(profile?.role === 'guide' || profile?.role === 'agency') && (
          <div>
            <label className={labelClass}>Languages Spoken</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {popularLanguages.map(language => {
                const selected = form.languages.some(item => item.toLocaleLowerCase() === language.toLocaleLowerCase());
                return (
                  <button
                    key={language}
                    type="button"
                    onClick={() => toggleLanguage(language)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${selected
                      ? 'bg-[hsl(178,85%,32%)]/20 border-[hsl(178,85%,32%)] text-teal-300'
                      : 'bg-white/[0.03] border-white/10 text-white/55 hover:border-white/25'
                    }`}
                  >
                    {selected && <span className="me-1">✓</span>}{language}
                  </button>
                );
              })}
            </div>

            {form.languages.filter(language => !popularLanguages.some(item => item.toLocaleLowerCase() === language.toLocaleLowerCase())).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.languages
                  .filter(language => !popularLanguages.some(item => item.toLocaleLowerCase() === language.toLocaleLowerCase()))
                  .map(language => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => toggleLanguage(language)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-[hsl(178,85%,32%)]/20 border border-[hsl(178,85%,32%)] text-teal-300"
                      title="Remove language"
                    >
                      {language}<X className="w-3 h-3" />
                    </button>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={otherLanguage}
                onChange={event => setOtherLanguage(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addOtherLanguage();
                  }
                }}
                className={inputClass}
                placeholder="Other language"
                maxLength={60}
              />
              <button
                type="button"
                onClick={addOtherLanguage}
                className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl bg-white/10 text-white/70 text-xs hover:bg-white/15"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        )}

        {/* Tour types / specialties */}
        {isGuideOrAgencyProfile && (
          <div>
            <label className={labelClass}>{isAgency ? 'Tour Types' : 'Tour Types / Specialties'}</label>
            <p className="text-white/35 text-xs mb-3">
              {lang === 'fa' ? 'حداقل یک نوع تور یا تخصص را انتخاب کنید.' : lang === 'ar' ? 'اختر نوع رحلة أو تخصصاً واحداً على الأقل.' : 'Choose at least one tour type or specialty.'}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROFILE_TOUR_TYPES.map(option => {
                const selected = form.tourTypes.some(item => item.toLocaleLowerCase() === option.value.toLocaleLowerCase());
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleTourType(option.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${selected
                      ? 'bg-[hsl(38,62%,58%)]/20 border-[hsl(38,62%,58%)] text-[hsl(38,62%,70%)]'
                      : 'bg-white/[0.03] border-white/10 text-white/55 hover:border-white/25'
                    }`}
                  >
                    {selected && <span className="me-1">✓</span>}{option[lang] || option.en}
                  </button>
                );
              })}
            </div>

            {form.tourTypes.filter(tourType => !PROFILE_TOUR_TYPES.some(option => option.value.toLocaleLowerCase() === tourType.toLocaleLowerCase())).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.tourTypes
                  .filter(tourType => !PROFILE_TOUR_TYPES.some(option => option.value.toLocaleLowerCase() === tourType.toLocaleLowerCase()))
                  .map(tourType => (
                    <button key={tourType} type="button" onClick={() => toggleTourType(tourType)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-[hsl(38,62%,58%)]/20 border border-[hsl(38,62%,58%)] text-[hsl(38,62%,70%)]" title="Remove tour type">
                      {tourType}<X className="w-3 h-3" />
                    </button>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={otherTourType}
                onChange={event => setOtherTourType(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addOtherTourType();
                  }
                }}
                className={inputClass}
                placeholder={lang === 'fa' ? 'نوع تور یا تخصص دیگر' : lang === 'ar' ? 'نوع رحلة أو تخصص آخر' : 'Other tour type or specialty'}
                maxLength={80}
              />
              <button type="button" onClick={addOtherTourType} className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl bg-white/10 text-white/70 text-xs hover:bg-white/15">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        )}

        {/* Provider abilities are distinct from tour types / specialties. */}
        {isGuideOrAgencyProfile && (
          <div className="border-t border-white/[0.07] pt-5">
            <label className={labelClass}>
              {lang === 'fa' ? 'توانایی‌های ویژه' : lang === 'ar' ? 'المهارات الخاصة' : 'Special Abilities'} *
            </label>
            <p className="text-white/35 text-xs mb-3">
              {lang === 'fa' ? 'حداقل یک توانایی را انتخاب یا اضافه کنید.' : lang === 'ar' ? 'اختر أو أضف مهارة واحدة على الأقل.' : 'Choose or add at least one ability.'}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROVIDER_SPECIAL_ABILITY_OPTIONS.map(option => {
                const selected = form.specialAbilities.some(
                  item => item.toLocaleLowerCase() === option.value.toLocaleLowerCase(),
                );
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSpecialAbility(option.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${selected
                      ? 'bg-violet-500/20 border-violet-400/60 text-violet-200'
                      : 'bg-white/[0.03] border-white/10 text-white/55 hover:border-white/25'
                    }`}
                  >
                    {selected && <span className="me-1">✓</span>}{option[lang] || option.en}
                  </button>
                );
              })}
            </div>

            {form.specialAbilities.filter(ability => !PROVIDER_SPECIAL_ABILITY_OPTIONS.some(
              option => option.value.toLocaleLowerCase() === ability.toLocaleLowerCase(),
            )).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.specialAbilities
                  .filter(ability => !PROVIDER_SPECIAL_ABILITY_OPTIONS.some(
                    option => option.value.toLocaleLowerCase() === ability.toLocaleLowerCase(),
                  ))
                  .map(ability => (
                    <button
                      key={ability}
                      type="button"
                      onClick={() => toggleSpecialAbility(ability)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-violet-500/20 border border-violet-400/60 text-violet-200"
                      title={lang === 'fa' ? 'حذف توانایی' : lang === 'ar' ? 'إزالة المهارة' : 'Remove ability'}
                    >
                      {ability}<X className="w-3 h-3" />
                    </button>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={otherSpecialAbility}
                onChange={event => setOtherSpecialAbility(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addOtherSpecialAbility();
                  }
                }}
                className={inputClass}
                placeholder={lang === 'fa' ? 'توانایی دیگر' : lang === 'ar' ? 'مهارة أخرى' : 'Custom ability'}
                maxLength={MAX_SPECIAL_ABILITY_LENGTH}
              />
              <button
                type="button"
                onClick={addOtherSpecialAbility}
                disabled={!otherSpecialAbility.trim()}
                className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl bg-white/10 text-white/70 text-xs hover:bg-white/15 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                {lang === 'fa' ? 'افزودن' : lang === 'ar' ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {isGuideOrAgencyProfile && (
          <fieldset>
            <legend className={labelClass}>
              {lang === 'fa'
                ? 'آیا وسیله نقلیه برای تورها در اختیار دارید؟'
                : lang === 'ar'
                  ? 'هل لديك مركبة متاحة للجولات؟'
                  : 'Do you have a vehicle available for tours?'} *
            </legend>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {[
                { value: true, label: lang === 'fa' ? 'بله' : lang === 'ar' ? 'نعم' : 'Yes' },
                { value: false, label: lang === 'fa' ? 'خیر' : lang === 'ar' ? 'لا' : 'No' },
              ].map(option => {
                const selected = form.hasVehicle === option.value;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm(prev => ({ ...prev, hasVehicle: option.value }))}
                    className={`px-4 py-2.5 rounded-xl text-sm border transition ${selected
                      ? 'bg-[hsl(178,85%,32%)]/20 border-[hsl(178,85%,40%)] text-teal-200'
                      : 'bg-white/[0.03] border-white/10 text-white/55 hover:border-white/25'
                    }`}
                  >
                    {selected && <span className="me-1.5">✓</span>}{option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Bio */}
        <div>
          <label className={labelClass}>Bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange} rows={4} className={`${inputClass} resize-none`} placeholder="Tell travelers about yourself, your expertise, and your passion for Iran..." />
        </div>

        {/* License Document Section */}
        {(profile?.role === 'guide' || profile?.role === 'agency') && (
          <div className="border-t border-white/[0.07] pt-5 min-h-52 flex flex-col">
            <LicenseCard profile={{ ...profile, id: userId }} onSave={onSave} />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> {t('dashboard_saved')}
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="ms-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[hsl(178,85%,32%)] text-white font-semibold text-sm hover:bg-[hsl(178,85%,28%)] disabled:opacity-60 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? t('dashboard_saving') : t('dashboard_save_profile')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── GalleryView ─────────────────────────────────────────────────────────────

function GalleryView({ profile, userId, onSave }) {
  const { t, lang } = useI18n();
  const [gallery, setGallery] = useState(profile?.gallery_images || []);
  const [showModal, setShowModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const galleryFileRef = useRef(null);

  const persistGallery = async (nextGallery) => {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ gallery_images: nextGallery })
      .eq('id', userId);
    if (updateErr) throw updateErr;
    setGallery(nextGallery);
    onSave({ ...profile, gallery_images: nextGallery });
  };

  const loadLatestGallery = async () => {
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('gallery_images')
      .eq('id', userId)
      .single();
    if (fetchErr) throw fetchErr;
    return Array.isArray(data.gallery_images) ? data.gallery_images : [];
  };

  const handleUploadPhotos = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || !userId) return;

    setError('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidType = files.find(file => !allowedTypes.includes(file.type));
    const oversized = files.find(file => file.size > 5 * 1024 * 1024);
    if (invalidType) {
      setError(lang === 'fa' ? 'فقط تصاویر JPG، PNG یا WEBP مجاز هستند.' : 'Only JPG, PNG or WEBP images are allowed.');
      return;
    }
    if (oversized) {
      setError(lang === 'fa' ? 'حجم هر تصویر باید کمتر از ۵ مگابایت باشد.' : 'Each image must be smaller than 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const currentGallery = await loadLatestGallery();
      const acceptedFiles = files.slice(0, Math.max(0, 20 - currentGallery.length));
      if (!acceptedFiles.length) throw new Error(lang === 'fa' ? 'حداکثر ۲۰ عکس مجاز است.' : 'Maximum of 20 photos allowed.');

      const urls = await Promise.all(acceptedFiles.map(async (file, index) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${userId}/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-gallery')
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('profile-gallery').getPublicUrl(path);
        return data.publicUrl;
      }));

      await persistGallery([...currentGallery, ...urls]);
      toast.success(lang === 'fa' ? 'عکس‌های گالری بارگذاری شدند.' : 'Gallery photos uploaded.');
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'Failed to upload gallery photos');
    } finally {
      setUploading(false);
      setDragActive(false);
      if (galleryFileRef.current) galleryFileRef.current.value = '';
    }
  };

  const handleAddPhoto = async () => {
    if (!newUrl.trim() || gallery.length >= 20) return;
    setAdding(true);
    setError('');
    try {
      const currentGallery = await loadLatestGallery();
      if (currentGallery.length >= 20) throw new Error(lang === 'fa' ? 'حداکثر ۲۰ عکس مجاز است.' : 'Maximum of 20 photos allowed.');
      await persistGallery([...currentGallery, newUrl.trim()]);
      setNewUrl('');
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePhoto = async (imageUrl) => {
    if (!window.confirm(t('gallery_delete_confirm'))) return;
    const filtered = gallery.filter(img => img !== imageUrl);
    try {
      await persistGallery(filtered);

      const marker = '/storage/v1/object/public/profile-gallery/';
      const markerIndex = imageUrl.indexOf(marker);
      if (markerIndex >= 0) {
        const objectPath = decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
        const { error: removeError } = await supabase.storage.from('profile-gallery').remove([objectPath]);
        if (removeError) console.error('Failed to remove gallery object:', removeError);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete gallery photo');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-lg">{t('gallery_title')}</h2>
          <p className="text-white/40 text-xs mt-0.5">
            {gallery.length}/20 {t('gallery_max')}
          </p>
        </div>
        {gallery.length < 20 && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(178,85%,32%)] text-white text-xs font-semibold hover:bg-[hsl(178,85%,28%)] transition"
          >
            <Plus className="w-4 h-4" />
            {t('gallery_add')}
          </button>
        )}
      </div>

      {gallery.length === 0 ? (
        <div className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl">
          <EmptyState Icon={ImageIcon} title={t('gallery_empty')} desc={t('gallery_max')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {gallery.map((img, i) => (
            <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden bg-white/[0.05] border border-white/[0.08]">
              <img decoding="async" loading="lazy" src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center">
                <button
                  onClick={() => handleDeletePhoto(img)}
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center text-white transition-all hover:bg-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Photo Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[hsl(222,55%,10%)] border border-white/10 rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold text-base">{t('gallery_add')}</h3>
                <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/50 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={() => !uploading && galleryFileRef.current?.click()}
                onKeyDown={event => {
                  if ((event.key === 'Enter' || event.key === ' ') && !uploading) {
                    event.preventDefault();
                    galleryFileRef.current?.click();
                  }
                }}
                onDragEnter={event => { event.preventDefault(); setDragActive(true); }}
                onDragOver={event => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={event => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
                }}
                onDrop={event => {
                  event.preventDefault();
                  setDragActive(false);
                  handleUploadPhotos(event.dataTransfer.files);
                }}
                className={`mb-5 p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition ${dragActive
                  ? 'border-teal-400 bg-teal-400/10'
                  : 'border-white/15 bg-white/[0.03] hover:border-teal-400/60'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 text-teal-300">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-sm">{lang === 'fa' ? 'در حال بارگذاری…' : 'Uploading…'}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-white/45">
                    <Upload className="w-7 h-7" />
                    <p className="text-sm">{lang === 'fa' ? 'عکس‌ها را اینجا رها کنید یا برای انتخاب کلیک کنید' : 'Drop photos here or click to choose'}</p>
                    <p className="text-[10px] text-white/25">JPG, PNG, WEBP · max 5 MB each · up to {20 - gallery.length}</p>
                  </div>
                )}
              </div>
              <input
                ref={galleryFileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={event => handleUploadPhotos(event.target.files)}
              />

              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-white/30 text-[10px] uppercase">{lang === 'fa' ? 'یا لینک عکس' : 'or image URL'}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <input
                type="url"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder={t('gallery_add_url')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)] focus:ring-1 focus:ring-[hsl(178,85%,32%)]/50 transition mb-4"
                onKeyDown={e => e.key === 'Enter' && handleAddPhoto()}
              />

              {newUrl && (
                <div className="w-full aspect-video rounded-xl overflow-hidden bg-white/5 mb-4">
                  <img decoding="async" loading="lazy" src={newUrl} alt="Preview" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/50 text-sm hover:text-white hover:border-white/30 transition"
                >
                  {t('dashboard_cancel')}
                </button>
                <button
                  onClick={handleAddPhoto}
                  disabled={!newUrl.trim() || adding || uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[hsl(178,85%,32%)] text-white text-sm font-semibold hover:bg-[hsl(178,85%,28%)] disabled:opacity-50 transition"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t('gallery_add')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00',
  'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:00',
  'UTC-02:00', 'UTC-01:00', 'UTC+00:00', 'UTC+01:00', 'UTC+02:00',
  'UTC+03:00', 'UTC+03:30', 'UTC+04:00', 'UTC+04:30', 'UTC+05:00',
  'UTC+05:30', 'UTC+05:45', 'UTC+06:00', 'UTC+06:30', 'UTC+07:00',
  'UTC+08:00', 'UTC+09:00', 'UTC+09:30', 'UTC+10:00', 'UTC+11:00',
  'UTC+12:00',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'IRR'];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
        checked ? 'bg-[hsl(178,85%,32%)]' : 'bg-white/15'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SettingsView({ profile, userId, onSave }) {
  const { t, lang, dir } = useI18n();
  const [tab, setTab] = useState('general');

  const [acceptBookings, setAcceptBookings] = useState(profile?.accept_bookings ?? true);
  const [currency, setCurrency] = useState(profile?.currency || 'USD');
  const [timezone, setTimezone] = useState(profile?.timezone || 'UTC+03:30');

  const [notifyRequests, setNotifyRequests] = useState(profile?.notify_requests ?? true);
  const [notifyArea, setNotifyArea] = useState(profile?.notify_area || 'nearby');
  const [notifyEmail, setNotifyEmail] = useState(profile?.notify_email ?? true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(profile?.notify_whatsapp ?? false);

  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let payload = {};
      if (tab === 'general') {
        payload = { accept_bookings: acceptBookings, currency, timezone };
      } else if (tab === 'notifications') {
        payload = { notify_requests: notifyRequests, notify_area: notifyArea, notify_email: notifyEmail, notify_whatsapp: notifyWhatsapp };
      } else {
        payload = { is_public: isPublic };
      }
      const { error: err } = await supabase.from('profiles').update(payload).eq('id', userId);
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSave({ ...profile, ...payload });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectClass = 'w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm focus:outline-none focus:border-[hsl(178,85%,32%)] transition appearance-none cursor-pointer';
  const labelClass = 'block text-white/50 text-xs mb-1.5 font-medium';
  const tabs = ['general', 'notifications', 'privacy'];

  return (
    <div>
      <h2 className="text-white font-bold text-lg mb-6">{t('dashboard_nav_settings')}</h2>

      {/* Tabs */}
      <div className="flex bg-white/[0.05] rounded-xl p-1 mb-6 w-fit gap-1">
        {tabs.map(tabId => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
              tab === tabId
                ? 'bg-[hsl(178,85%,32%)] text-white shadow'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {t(`settings_${tabId}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}

      <div className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-6 space-y-6">

        {/* ── General Tab ── */}
        {tab === 'general' && (
          <>
            {/* Accept bookings toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">{t('settings_accept_bookings')}</p>
              </div>
              <Toggle checked={acceptBookings} onChange={setAcceptBookings} />
            </div>

            {/* Currency */}
            <div>
              <label className={labelClass}>{t('settings_currency')}</label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className={`${selectClass} pr-8`}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className={labelClass}>{t('settings_timezone')}</label>
              <div className="relative">
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className={`${selectClass} pr-8`}
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>
            </div>
          </>
        )}

        {/* ── Notifications Tab ── */}
        {tab === 'notifications' && (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-white text-sm font-medium">{t('settings_notify_requests')}</p>
              <Toggle checked={notifyRequests} onChange={setNotifyRequests} />
            </div>

            <div>
              <p className="text-white/50 text-xs font-medium mb-3">{t('settings_notify_area')}</p>
              <div className="space-y-3">
                {[
                  { value: 'nearby', label: t('settings_notify_nearby') },
                  { value: 'mine', label: t('settings_notify_only_mine') },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      notifyArea === opt.value
                        ? 'border-[hsl(178,85%,45%)] bg-[hsl(178,85%,32%)]'
                        : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {notifyArea === opt.value && (
                        <div className="w-full h-full rounded-full bg-white/80 scale-[0.4]" />
                      )}
                    </div>
                    <span className="text-white/70 text-sm group-hover:text-white transition">{opt.label}</span>
                    <input
                      type="radio"
                      name="notifyArea"
                      value={opt.value}
                      checked={notifyArea === opt.value}
                      onChange={() => setNotifyArea(opt.value)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-5 pt-2 border-t border-white/[0.07]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-white text-sm">{t('settings_notify_email')}</p>
                <Toggle checked={notifyEmail} onChange={setNotifyEmail} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-white text-sm">{t('settings_notify_whatsapp')}</p>
                <Toggle checked={notifyWhatsapp} onChange={setNotifyWhatsapp} />
              </div>
            </div>
          </>
        )}

        {/* ── Privacy Tab ── */}
        {tab === 'privacy' && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">{t('settings_publish_profile')}</p>
                <p className="text-white/40 text-xs mt-0.5">{t('settings_publish_desc')}</p>
              </div>
              <Toggle checked={isPublic} onChange={setIsPublic} />
            </div>

            <div className="pt-4 border-t border-white/[0.07]">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                {t('settings_deactivate')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3 mt-5">
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> {t('dashboard_saved')}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[hsl(178,85%,32%)] text-white font-semibold text-sm hover:bg-[hsl(178,85%,28%)] disabled:opacity-60 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? t('dashboard_saving') : t('settings_save_all')}
        </button>
      </div>

      {/* Deactivate Confirmation Modal */}
      <AnimatePresence>
        {showDeactivateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={e => e.target === e.currentTarget && setShowDeactivateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[hsl(222,55%,10%)] border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">{t('settings_deactivate')}</h3>
                  <p className="text-white/40 text-xs mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/50 text-sm hover:text-white hover:border-white/30 transition"
                >
                  {t('dashboard_cancel')}
                </button>
                <button
                  className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-sm font-semibold hover:bg-red-500 transition"
                >
                  {t('settings_deactivate')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MessagesView (real-time conversations list) ─────────────────────────────

function MessagesView({ userId, onOpen }) {
  const { t, lang, dir } = useI18n();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        const { data: msgs, error: msgsErr } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (msgsErr) throw msgsErr;

        const groups = new Map();
        (msgs || []).forEach((m) => {
          const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
          if (!otherId) return;
          if (!groups.has(otherId)) {
            groups.set(otherId, { otherId, last: m, unread: 0 });
          }
          if (m.receiver_id === userId && !m.is_read) {
            groups.get(otherId).unread += 1;
          }
        });

        const otherIds = [...groups.keys()];
        let profiles = [];
        if (otherIds.length > 0) {
          profiles = await fetchParticipantProfiles(otherIds);
        }

        const list = [...groups.values()].map((g) => ({
          ...g,
          profile: profiles.find((p) => p.id === g.otherId) || null,
        }));

        if (!cancelled) {
          setConversations(list);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();

    const channel = supabase
      .channel(`messages-list-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const previewText = (m) => {
    if (!m) return '';
    const isMine = m.sender_id === userId;
    const prefix = isMine
      ? (lang === 'fa' ? 'شما: ' : lang === 'ar' ? 'أنت: ' : 'You: ')
      : '';
    return `${prefix}${m.content}`;
  };

  const timeLabel = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white font-bold text-2xl mb-1">{t('dashboard_nav_chat') || 'Messages'}</h1>
        <p className="text-white/40 text-sm">
          {lang === 'fa'
            ? 'تمام مکالمات شما با مسافران'
            : lang === 'ar'
            ? 'جميع محادثاتك مع المسافرين'
            : 'All your conversations with travellers'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[hsl(178,85%,45%)] animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          {error}
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
            <MessageCircle className="w-7 h-7 text-white/25" />
          </div>
          <p className="text-white/60 font-medium text-sm mb-1">
            {lang === 'fa'
              ? 'هنوز مکالمه‌ای ندارید'
              : lang === 'ar'
              ? 'لا توجد محادثات بعد'
              : 'No conversations yet'}
          </p>
          <p className="text-white/35 text-xs max-w-xs">
            {lang === 'fa'
              ? 'مسافران از طریق پروفایل شما می‌توانند پیام بفرستند'
              : lang === 'ar'
              ? 'يمكن للمسافرين إرسال رسائل عبر ملفك الشخصي'
              : 'Travellers can message you from your public profile'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <button
              key={c.otherId}
              onClick={() => onOpen(c.otherId)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[hsl(222,45%,14%)] border border-white/[0.06] hover:border-[hsl(178,85%,32%)]/40 hover:bg-[hsl(222,45%,16%)] transition text-left"
            >
              <img decoding="async" loading="lazy"
                src={avatarFor(c.profile)}
                alt=""
                className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-white font-semibold text-sm truncate">
                    {c.profile?.full_name || (lang === 'fa' ? 'کاربر' : lang === 'ar' ? 'مستخدم' : 'User')}
                  </p>
                  <span className="text-white/35 text-[11px] flex-shrink-0">{timeLabel(c.last?.created_at)}</span>
                </div>
                <p className={`text-xs truncate ${c.unread > 0 ? 'text-white/85 font-medium' : 'text-white/45'}`}>
                  {previewText(c.last)}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[hsl(178,85%,32%)] text-white text-[11px] font-bold flex items-center justify-center">
                  {c.unread > 99 ? '99+' : c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EmptySection ─────────────────────────────────────────────────────────────

const SECTION_ICONS = {
  requests:           Bell,
  'my-trip-requests': MapPin,
  chat:               MessageCircle,
  gallery:            ImageIcon,
  bookings:           CalendarDays,
  payment:            CreditCard,
  'my-reviews':       Star,
  settings:           Settings,
};

function EmptySection({ section }) {
  const { t, lang, dir } = useI18n();
  const Icon = SECTION_ICONS[section] || LayoutDashboard;

  const titleKey = `dashboard_nav_${section === 'my-reviews' ? 'reviews' : section}`;
  const descKey = `dashboard_empty_${section === 'my-reviews' ? 'reviews' : section}`;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-white/20" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">{t(titleKey)}</h2>
        <p className="text-white/40 text-sm max-w-xs">{t(descKey)}</p>
      </div>
    </div>
  );
}

// ─── MyTripRequestsView ───────────────────────────────────────────────────────

function MyTripRequestsView({ userId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('trip_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setRequests(data || []);
      setLoading(false);
    }
    load();
  }, [userId]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this trip request?')) return;
    try {
      await cancelTripRequest(id);
      setRequests(prev => prev.map(request => (
        request.id === id ? { ...request, status: 'cancelled' } : request
      )));
      toast.success('Trip request cancelled.');
    } catch (error) {
      toast.error(error?.message || 'Could not cancel this trip request.');
    }
  };

  const statusColor = (s) => {
    if (s === 'active')   return 'bg-green-500/15 text-green-400';
    if (s === 'inactive') return 'bg-yellow-500/15 text-yellow-400';
    return 'bg-white/10 text-white/40';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-xl">My Trip Requests</h2>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(178,85%,32%)] text-white text-sm font-medium hover:bg-[hsl(178,85%,28%)] transition"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
            <MapPin className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/60 font-medium mb-1">No trip requests yet</p>
          <p className="text-white/30 text-sm">Create your first request and local guides will reach out.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm truncate">
                    {Array.isArray(req.destination) ? req.destination.join(', ') : req.destination || 'No destination'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(req.status)}`}>
                    {req.status || 'active'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-white/40 text-xs">
                  {req.start_date && <span>{req.start_date} → {req.end_date}</span>}
                  {req.adults != null && <span>{req.adults} adult{req.adults !== 1 ? 's' : ''}</span>}
                </div>
                {req.requirements && (
                  <p className="text-white/40 text-xs line-clamp-2">{req.requirements}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {['open', 'active', 'pending', 'proposals_ready', 'confirmed', 'booked'].includes(req.status) &&
                  (!req.expires_at || new Date(req.expires_at).getTime() > Date.now()) && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    className="p-2 rounded-lg bg-white/[0.06] text-white/50 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TripRequestForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={async () => {
          const { data } = await supabase
            .from('trip_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          setRequests(data || []);
        }}
      />
    </div>
  );
}

// ─── Dashboard (main) ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { section = 'home' } = useParams();
  const { t: _t, lang, dir: _dir } = useI18n();

  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tours, setTours] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTour, setEditingTour] = useState(null);
  const [profileExpanded, setProfileExpanded] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const role = user.user_metadata?.role;
      if (role === 'traveler') { navigate('/'); return; }

      setAuthUser(user);

      const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const loadedProfile = profileRes.data || {};
      const [toursRes, reviewResult] = await Promise.all([
        supabase.from('tours').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
        loadedProfile.role === 'guide' || loadedProfile.role === 'agency'
          ? fetchProfileReviewsSafely(supabase, {
            targetType: loadedProfile.role,
            profileId: user.id,
          })
          : Promise.resolve({ reviews: [], error: null }),
      ]);

      setProfile(loadedProfile);
      setTours(toursRes.data || []);
      setReviews(reviewResult.reviews);
      if (reviewResult.error) toast.error('Reviews could not be loaded.');
      setLoading(false);
    }
    init();
  }, [navigate]);

  const isGuideOrAgency = profile?.role === 'guide' || profile?.role === 'agency';
  const profileCheck = profile ? checkProfileCompletion(profile) : null;
  const profileIncomplete = isGuideOrAgency && !profileCheck?.completed;

  const nav = (sec) => {
    setEditingTour(null);
    navigate(sec === 'home' ? '/dashboard' : `/dashboard/${sec}`);
  };

  const handleDeleteTour = async (id) => {
    if (!window.confirm('Delete this tour? This cannot be undone.')) return;
    const { error } = await supabase.from('tours').delete().eq('id', id);
    if (!error) setTours(prev => prev.filter(t => t.id !== id));
  };

  const handleTourSaved = (savedTour, isNew) => {
    if (isNew) {
      setTours(prev => [savedTour, ...prev]);
    } else {
      setTours(prev => prev.map(t => t.id === savedTour.id ? savedTour : t));
      setEditingTour(null);
      nav('my-tours');
    }
  };

  const handleProfileSaved = (updated) => {
    setProfile(updated);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const renderContent = () => {
    if (editingTour || section === 'add-tour') {
      return (
        <TourForm
          key={editingTour?.id || 'new'}
          editing={editingTour}
          onDone={handleTourSaved}
          onCancel={() => { setEditingTour(null); nav('my-tours'); }}
        />
      );
    }
    switch (section) {
      case 'home':
        return (
          <HomeView
            profile={profile}
            tours={tours}
            reviews={reviews}
            userId={authUser?.id}
            lang={lang}
            onNavigate={nav}
            onOpenChat={(otherId) => navigate(`/chat/${otherId}`)}
            onProfileSave={handleProfileSaved}
          />
        );
      case 'requests':
        return <GuideRequestsView userId={authUser?.id} />;
      case 'my-trip-requests':
        return <MyTripRequestsView userId={authUser?.id} />;
      case 'notifications':
        return <NotificationsView userId={authUser?.id} />;
      case 'bookings':
        return <BookingsView />;
      case 'payment':
        return <PaymentHistoryView />;
      case 'my-tours':
        return <MyToursView tours={tours} onEdit={setEditingTour} onDelete={handleDeleteTour} />;
      case 'profile':
        return <ProfileView profile={profile} userId={authUser?.id} onSave={handleProfileSaved} />;
      case 'gallery':
        return <GalleryView profile={profile} userId={authUser?.id} onSave={handleProfileSaved} />;
      case 'settings':
        return <SettingsView profile={profile} userId={authUser?.id} onSave={handleProfileSaved} />;
      case 'chat':
        return <MessagesView userId={authUser?.id} onOpen={(otherId) => navigate(`/chat/${otherId}`)} />;
      case 'articles':
        return <MyArticlesSection user={{ id: authUser?.id, profile }} />;
      default:
        return <EmptySection section={section} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(222,55%,8%)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[hsl(178,85%,45%)] animate-spin" />
          <p className="text-white/40 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(222,50%,10%)] flex" style={{ fontFamily: 'inherit' }}>
      <Sidebar
        section={section}
        onNavigate={nav}
        profileExpanded={profileExpanded}
        setProfileExpanded={setProfileExpanded}
        userName={profile?.full_name || authUser?.user_metadata?.full_name}
        userRole={profile?.role || authUser?.user_metadata?.role}
        onLogout={handleLogout}
        profile={profile}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Profile completion banner */}
          {profileIncomplete && (
            <div className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 font-semibold text-sm mb-0.5">{_t('profile_incomplete_banner')}</p>
                <p className="text-amber-200/60 text-xs">
                  {profileCheck.passed}/{profileCheck.total}
                  {lang === 'fa' ? ' فیلد تکمیل شده' : lang === 'ar' ? ' حقلاً مكتملة' : ' fields completed'}
                </p>
              </div>
              <button
                onClick={() => nav('profile')}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
              >
                {_t('profile_incomplete_banner_link')}
              </button>
            </div>
          )}

          {/* Uploading a license automatically places the profile in the admin review queue. */}
          {isGuideOrAgency && profileCheck?.completed && !profile?.is_approved && (
            <div className="mb-5 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-emerald-300 font-semibold text-sm mb-0.5">
                  {_t('profile_review_requested')}
                </p>
                <p className="text-emerald-200/60 text-xs">
                  {lang === 'fa' ? 'پروفایل و لایسنس شما به‌صورت خودکار برای ادمین ارسال شده است.' : lang === 'ar' ? 'تم إرسال ملفك ورخصتك تلقائياً إلى المسؤول للمراجعة.' : 'Your completed profile and uploaded license were automatically sent for admin review.'}
                </p>
              </div>
            </div>
          )}

          <motion.div
            key={section + (editingTour?.id || '')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
