import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Inbox, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { supabase } from '@/supabaseClient';
import RequestCard from '@/components/profile/RequestCard';
import TripRequestForm from '@/components/profile/TripRequestForm';



const HOLIDAY_TYPE_LABELS = {
  active:       'Active',
  local_living: 'Local Living',
  nature:       'Nature',
  offbeat:      'Offbeat',
  relaxing:     'Relaxing',
};

export default function RequestsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { lang, dir } = useI18n();

  const [filter, setFilter]   = useState('active');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate('/login');
  }, [isLoadingAuth, isAuthenticated, navigate]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['trip_requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Gracefully fall back to tour_requests if trip_requests doesn't exist yet
        const fallback = await supabase
          .from('tour_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (fallback.error) return [];
        return fallback.data ?? [];
      }
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const isOverdue = (r) => Boolean(
    r.expires_at &&
    ['open', 'active', 'pending', 'proposals_ready'].includes(r.status) &&
    new Date(r.expires_at).getTime() <= Date.now()
  );

  const isActiveRequest = (r) =>
    !isOverdue(r) &&
    (['open', 'active', 'pending', 'proposals_ready', 'confirmed', 'booked', 'waiting', 'received'].includes(r.status) || r.status == null);

  const filtered = useMemo(() => {
    return requests
      .filter(r => filter === 'active' ? isActiveRequest(r) : !isActiveRequest(r))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [requests, filter]);

  const mapToCard = (r) => {
    // destination is a text[] column; tolerate legacy string values too
    const cities = Array.isArray(r.destination) ? r.destination : r.destination ? [r.destination] : [];
    const hasTransport = r.assistance?.includes('Transportation') || Boolean(r.transportation);
    const hasAccomm    = r.assistance?.includes('Accommodation')  || Boolean(r.accommodation);
    const holidayLabel = HOLIDAY_TYPE_LABELS[r.holiday_type] || r.holiday_type;
    const tourLabel    = r.tour_type === 'private' ? 'Private Tour'
                       : r.tour_type === 'group'   ? 'Group Tour'
                       : r.tour_type;
    const displayType  = holidayLabel
      ? (tourLabel ? `${holidayLabel} · ${tourLabel}` : holidayLabel)
      : tourLabel;

    const effectiveStatus = isOverdue(r) ? 'expired' : r.status;

    return {
      id:            r.id,
      title:         r.title
        || (cities.length
          ? `${lang === 'fa' ? 'سفر به' : lang === 'ar' ? 'رحلة إلى' : 'Trip to'} ${cities.join(', ')}`
          : (lang === 'fa' ? 'درخواست سفر' : lang === 'ar' ? 'طلب رحلة' : 'Trip Request')),
      destination:   cities,
      adults:        r.adults   ?? 1,
      children:      r.children ?? 0,
      startDate:     r.start_date,
      startTime:     r.arrival_time   || r.start_time,
      endDate:       r.end_date,
      endTime:       r.departure_time || r.end_time,
      transportation: hasTransport ? (lang === 'fa' ? 'بله' : lang === 'ar' ? 'نعم' : 'Yes') : null,
      accommodation:  hasAccomm    ? (lang === 'fa' ? 'بله' : lang === 'ar' ? 'نعم' : 'Yes') : null,
      tourType:       displayType  || null,
      requirements:  r.requirements || r.notes,
      status:        (['open', 'active', 'pending', 'waiting'].includes(effectiveStatus))
        ? 'waiting'
        : effectiveStatus === 'proposals_ready' ? 'received' : (effectiveStatus || 'waiting'),
      canonicalStatus: effectiveStatus || 'active',
      proposalRound: Math.max(1, Number(r.proposal_round) || 1),
      maxProposals: Math.max(1, Number(r.max_proposals) || 5),
    };
  };

  const tx = {
    title:    lang === 'fa' ? 'درخواست‌های سفر من' : lang === 'ar' ? 'طلبات سفري' : 'My Travel Requests',
    subtitle: lang === 'fa'
      ? 'پیشنهادهای راهنماها را اینجا ببین و مدیریت کن'
      : lang === 'ar'
      ? 'تابع وأدر العروض من المرشدين هنا'
      : 'Track proposals from local guides and manage your trip plans',
    active:   lang === 'fa' ? 'فعال'    : lang === 'ar' ? 'نشط'    : 'Active',
    past:     lang === 'fa' ? 'گذشته'   : lang === 'ar' ? 'سابق'   : 'Past',
    newBtn:   lang === 'fa' ? 'درخواست جدید' : lang === 'ar' ? 'طلب جديد' : '+ New Trip Request',
    emptyTitle: filter === 'active'
      ? (lang === 'fa' ? 'هنوز درخواست فعالی نداری'  : lang === 'ar' ? 'لا توجد طلبات نشطة بعد' : 'No active trip requests yet')
      : (lang === 'fa' ? 'هنوز درخواست گذشته‌ای نداری' : lang === 'ar' ? 'لا توجد طلبات سابقة'    : 'No past trip requests'),
    emptyDesc: filter === 'active'
      ? (lang === 'fa'
          ? 'روی دکمه «درخواست جدید» کلیک کن تا یک درخواست سفر سفارشی بسازی و پیشنهادهای راهنماهای محلی را دریافت کنی.'
          : lang === 'ar'
          ? 'انقر على «طلب جديد» لإنشاء طلب رحلة مخصص وتلقي عروض من المرشدين المحليين.'
          : 'Click "+ New Trip Request" above to create a custom trip and start receiving proposals from local guides.')
      : (lang === 'fa' ? 'سفرهای کامل‌شده یا منقضی‌شده اینجا ظاهر می‌شوند.'
          : lang === 'ar' ? 'ستظهر هنا الرحلات المكتملة أو المنتهية.'
          : 'Completed or expired trip requests will appear here.'),
    back: lang === 'fa' ? 'بازگشت' : lang === 'ar' ? 'رجوع' : 'Back',
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 mb-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all text-gray-700 dark:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {tx.back}
        </button>

        {/* Header row */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-foreground">
              {tx.title}
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-2 max-w-xl">
              {tx.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-end shrink-0">
            {/* Active / Past tabs */}
            <div className="inline-flex bg-card/60 backdrop-blur-md border border-border/40 rounded-full p-1">
              {['active', 'past'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === f
                      ? 'bg-accent text-white shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'active' ? tx.active : tx.past}
                </button>
              ))}
            </div>

            {/* New request button — only shown when at least one request already exists */}
            {requests.length > 0 && (
              <button
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/25 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Trip Request</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        {isLoading ? (
          <div className="bg-card/60 border border-border/40 rounded-3xl p-16 text-center">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl p-12 sm:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 carpet-texture opacity-15 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-accent" />
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground mt-6">
                {tx.emptyTitle}
              </h2>
              <p className="font-body text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
                {tx.emptyDesc}
              </p>
              {filter === 'active' && (
                <button
                  onClick={() => setFormOpen(true)}
                  className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition shadow-lg shadow-accent/20"
                >
                  <Plus className="w-4 h-4" />
                  New Trip Request
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {filtered.map(r => (
              <RequestCard
                key={r.id}
                request={mapToCard(r)}
                slotCount={Number(r.proposals_count) || 0}
                onOpen={req => navigate(`/profile/requests/${req.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Multi-step form modal */}
      <TripRequestForm isOpen={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
