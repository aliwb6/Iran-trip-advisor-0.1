import IconSwap from '@/components/ui/IconSwap';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Calendar, Users, Wallet, ChevronDown, ChevronUp,
  Briefcase, RefreshCw, Search, X,
} from 'lucide-react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../supabaseClient';
import { getAvailableTripRequests } from '../api/tripRequests';
import SubmitProposalModal from '@/components/dashboard/SubmitProposalModal';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n.jsx';
import { localize, localizeTripOption } from '@/lib/localize';
import { iranianDestinations } from '@/data/iranianCities';

const INTEREST_COLORS = {
  Architecture: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  History:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Nature:       'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Food:         'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Photography:  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Desert:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Luxury:       'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  Culture:      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Research:     'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  Art:          'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

const ALL_INTERESTS = Object.keys(INTEREST_COLORS);
const BUDGET_OPTIONS = ['', 'Budget', 'Mid-range', 'Luxury'];

const cityLabels = Object.fromEntries(iranianDestinations.map(city => [city.en, city]));
const destinationLabel = (destination, lang = 'en') => {
  const values = Array.isArray(destination) ? destination.filter(Boolean) : destination ? [destination] : [];
  return values.length ? values.map(city => cityLabels[city]?.[lang] || city).join(lang === 'en' ? ', ' : '، ') : localize(lang, 'Iran', 'ایران', 'إيران');
};

const requestInterests = (trip) => (
  Array.isArray(trip.goals) ? trip.goals : Array.isArray(trip.holiday_types) ? trip.holiday_types : []
);

const requestPeople = (trip) => {
  const adults = Number(trip.adults || 0);
  const children = Number(trip.children || 0);
  const total = adults + children;
  return total > 0 ? total : Number(trip.num_people || 1);
};

function SlotIndicator({ proposalsCount, maxProposals }) {
  const { lang } = useI18n();
  const max = Math.max(1, Number(maxProposals) || 5);
  const taken = Math.max(0, Math.min(Number(proposalsCount) || 0, max));
  const available = Math.max(0, max - taken);
  const percent = Math.round((taken / max) * 100);
  const nearlyFull = available === 1;

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-border/50 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className={`font-body text-xs font-medium whitespace-nowrap ${
        nearlyFull ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'
      }`}>
        {localize(lang, `${available} spot${available !== 1 ? 's' : ''} left`, `${available} جای خالی`, `المقاعد المتبقية: ${available}`)}
      </span>
    </div>
  );
}

function TripRequestCard({ trip, guideId, onAccepted }) {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const startDate = trip.start_date
    ? new Date(trip.start_date).toLocaleDateString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric' })
    : null;
  const endDate = trip.end_date
    ? new Date(trip.end_date).toLocaleDateString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const dateLabel = startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate || l('Dates flexible', 'تاریخ‌ها انعطاف‌پذیرند', 'المواعيد مرنة');
  const interests = requestInterests(trip);
  const people = requestPeople(trip);
  const maxProposals = Math.max(1, Number(trip.max_proposals) || 5);
  const proposalsCount = Math.max(0, Number(trip.proposals_count) || 0);
  const isFull = proposalsCount >= maxProposals;

  const travelerName = trip.traveler?.full_name?.split(' ')[0] || l('Traveler', 'مسافر', 'مسافر');
  const avatarUrl = trip.traveler?.avatar_url;
  const initials = (trip.traveler?.full_name || 'T')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground leading-snug truncate">
              {trip.title || l('Custom trip request', 'درخواست سفر اختصاصی', 'طلب رحلة مخصّصة')}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-gold" />
              <span className="font-body text-sm truncate">{destinationLabel(trip.destination, lang)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-accent/20 border border-border/50 flex items-center justify-center">
              {avatarUrl ? (
                <img decoding="async" loading="lazy" src={avatarUrl} alt={travelerName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-body text-xs font-bold text-accent">{initials}</span>
              )}
            </div>
            <span className="font-body text-sm text-muted-foreground">{travelerName}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3 text-sm font-body text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {dateLabel}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {l(`${people} ${people === 1 ? 'person' : 'people'}`, `${people} نفر`, `عدد المسافرين: ${people}`)}
          </span>
          {trip.budget_tier && (
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              {localizeTripOption(trip.budget_tier, lang)}
            </span>
          )}
        </div>

        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {interests.map(interest => (
              <span
                key={interest}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-body ${
                  INTEREST_COLORS[interest] || 'bg-muted text-muted-foreground'
                }`}
              >
                {localizeTripOption(interest, lang)}
              </span>
            ))}
          </div>
        )}

        <div className="mb-4">
          <SlotIndicator proposalsCount={proposalsCount} maxProposals={maxProposals} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            disabled={isFull}
            className="flex-1 bg-accent hover:bg-accent/90 text-white font-body font-semibold rounded-xl h-9 disabled:opacity-50"
          >
            {isFull ? l('Proposal limit reached', 'ظرفیت پیشنهادها تکمیل شده است', 'اكتمل عدد العروض') : l('Accept & Propose', 'پذیرش و ارسال پیشنهاد', 'قبول الطلب وتقديم عرض')}
          </Button>

          {trip.requirements && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExpanded(value => !value)}
              className="font-body text-xs rounded-xl h-9 border-border/60"
            >
              {l('View Details', 'مشاهدهٔ جزئیات', 'عرض التفاصيل')}
              {<IconSwap active={expanded} a={<ChevronDown className="w-3.5 h-3.5 ml-1" />} b={<ChevronUp className="w-3.5 h-3.5 ml-1" />} />}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && trip.requirements && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 pt-0 border-t border-border/30">
              <p className="font-body text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 pt-4">
                {l('Special Requirements', 'درخواست‌های ویژه', 'متطلبات خاصة')}
              </p>
              <p className="font-body text-sm text-foreground/80 leading-relaxed">
                {trip.requirements}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SubmitProposalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        request={trip}
        guideId={guideId}
        onSuccess={() => { setModalOpen(false); onAccepted(); }}
      />
    </motion.div>
  );
}

function LoadingSkeleton() {
  const { lang } = useI18n();
  return (
    <div className="flex min-h-[18rem] items-center justify-center">
      <BreathingGlow label={localize(lang, 'Loading jobs', 'در حال بارگذاری درخواست‌ها', 'جارٍ تحميل الطلبات')} />
    </div>
  );
}

export default function FindJobs() {
  const { lang, dir } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const { user, profile, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [destFilter, setDestFilter] = useState('');
  const [interestFilter, setInterestFilter] = useState([]);
  const [budgetFilter, setBudgetFilter] = useState('');

  const role = profile?.role || user?.user_metadata?.role;

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && role && role !== 'guide' && role !== 'agency') {
      navigate('/');
    }
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoadingAuth, isAuthenticated, role, navigate]);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      setError(null);
      const data = await getAvailableTripRequests(user.id);
      setTrips(data || []);
    } catch (err) {
      setError(l('Failed to load trip requests.', 'بارگذاری درخواست‌های سفر ممکن نشد.', 'تعذّر تحميل طلبات الرحلات.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, lang]);

  useEffect(() => {
    if (!user?.id) return;
    loadRequests();

    const channel = supabase
      .channel(`find_jobs_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_request_dispatches', filter: `provider_id=eq.${user.id}` },
        loadRequests
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_requests' }, loadRequests)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadRequests]);

  const filtered = trips.filter(trip => {
    const destinations = [destinationLabel(trip.destination, 'en'), destinationLabel(trip.destination, 'fa'), destinationLabel(trip.destination, 'ar')].join(' ').toLowerCase();
    const interests = requestInterests(trip);
    if (destFilter && !destinations.includes(destFilter.toLowerCase())) return false;
    if (interestFilter.length > 0 && !interestFilter.every(item => interests.includes(item))) return false;
    if (budgetFilter && trip.budget_tier !== budgetFilter) return false;
    return true;
  });

  const toggleInterestFilter = (interest) => {
    setInterestFilter(previous =>
      previous.includes(interest)
        ? previous.filter(item => item !== interest)
        : [...previous, interest]
    );
  };

  const clearFilters = () => {
    setDestFilter('');
    setInterestFilter([]);
    setBudgetFilter('');
  };

  const hasFilters = Boolean(destFilter || interestFilter.length > 0 || budgetFilter);

  if (isLoadingAuth || (isAuthenticated && !role)) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <BreathingGlow className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-accent" />
            </div>
            <p className="font-body text-xs uppercase tracking-widest text-gold">{l('Guide Portal', 'پنل راهنما', 'بوابة المرشدين')}</p>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">{l('Find Jobs', 'یافتن درخواست‌های سفر', 'ابحث عن طلبات الرحلات')}</h1>
          <p className="font-body text-muted-foreground mt-1.5">
            {l('Review trip requests that have been matched to your services. Each request closes when its proposal limit is reached.', 'درخواست‌های سفری را ببینید که با خدمات شما هماهنگ‌اند. هر درخواست پس از تکمیل ظرفیت پیشنهادها بسته می‌شود.', 'اطّلع على طلبات الرحلات المناسبة لخدماتك. يُغلق كل طلب عند اكتمال عدد العروض المسموح به.')}
          </p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-4 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={l('Filter by destination…', 'جست‌وجو بر اساس مقصد…', 'البحث حسب الوجهة…')}
                value={destFilter}
                onChange={event => setDestFilter(event.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition"
              />
            </div>

            <select
              value={budgetFilter}
              onChange={event => setBudgetFilter(event.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/60 bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition min-w-[140px]"
            >
              {BUDGET_OPTIONS.map(option => (
                <option key={option} value={option}>{option ? localizeTripOption(option, lang) : l('Any budget', 'هر بودجه‌ای', 'أي ميزانية')}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/60 bg-background font-body text-sm text-muted-foreground hover:text-foreground hover:border-border transition"
              >
                <X className="w-3.5 h-3.5" />
                {l('Clear', 'پاک کردن', 'مسح')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ALL_INTERESTS.map(interest => (
              <button
                key={interest}
                onClick={() => toggleInterestFilter(interest)}
                className={`px-3 py-1 rounded-full text-xs font-medium font-body border transition-all ${
                  interestFilter.includes(interest)
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground'
                }`}
              >
                {localizeTripOption(interest, lang)}
              </button>
            ))}
          </div>
        </div>

        {!loading && (
          <p className="font-body text-sm text-muted-foreground mb-4">
            {filtered.length === 0
              ? l('No trip requests found', 'درخواست سفری پیدا نشد', 'لم يُعثر على طلبات رحلات')
              : l(`${filtered.length} trip request${filtered.length !== 1 ? 's' : ''} available`, `${filtered.length} درخواست سفر در دسترس است`, `الطلبات المتاحة: ${filtered.length}`)}
            {hasFilters && l(' (filtered)', ' (فیلترشده)', ' (بعد التصفية)')}
          </p>
        )}

        {error ? (
          <div className="text-center py-16">
            <p className="font-body text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={loadRequests} className="font-body">
              <RefreshCw className="w-4 h-4 mr-2" />
              {l('Try Again', 'تلاش دوباره', 'حاول مجدداً')}
            </Button>
          </div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
              {hasFilters ? l('No matches found', 'موردی با این فیلترها پیدا نشد', 'لا توجد نتائج مطابقة') : l('No open requests right now', 'اکنون درخواست بازی وجود ندارد', 'لا توجد طلبات متاحة الآن')}
            </h3>
            <p className="font-body text-sm text-muted-foreground max-w-sm mx-auto">
              {hasFilters
                ? l('Try adjusting your filters to see more results.', 'فیلترها را تغییر دهید تا نتایج بیشتری ببینید.', 'جرّب تعديل عوامل التصفية لرؤية نتائج أكثر.')
                : l('New trip requests from travelers will appear here. Check back soon!', 'درخواست‌های جدید مسافران اینجا نمایش داده می‌شوند. بعداً دوباره سر بزنید.', 'ستظهر هنا طلبات المسافرين الجديدة. عُد لاحقاً للاطلاع عليها.')}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 font-body text-sm text-accent hover:text-accent/80 transition"
              >
                {l('Clear all filters', 'پاک کردن همهٔ فیلترها', 'مسح جميع عوامل التصفية')}
              </button>
            )}
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filtered.map(trip => (
                <TripRequestCard
                  key={trip.id}
                  trip={trip}
                  guideId={user.id}
                  onAccepted={loadRequests}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
