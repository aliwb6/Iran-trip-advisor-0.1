import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Calendar, Users, Globe, FileText,
  Clock, RefreshCw, AlertCircle, CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import {
  fetchAvailableRequests,
  fetchMyAcceptedRequests,
  guideConfirmBooking,
  declinePackageTripRequest,
} from '@/api/tourRequestFlow';
import SubmitProposalModal from './SubmitProposalModal';
import { getPackageRequestKind } from '@/lib/packageTripRequest';

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const cityList = (d) => (Array.isArray(d) ? d : d ? [d] : []);

const SLOT_STATUS_LABEL = {
  accepted:  { text: 'Waiting for tourist',       color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  selected:  { text: 'You were chosen! 🎉',       color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  rejected:  { text: 'Rejected by traveler',      color: 'text-red-300',     bg: 'bg-red-500/10' },
  chatting:  { text: 'In discussion',             color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  finalized: { text: 'Booked',                    color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  closed:    { text: 'Closed',                    color: 'text-white/30',    bg: 'bg-white/[0.04]' },
};

const FILLED_SLOT_INFO = {
  text: 'Expired',
  color: 'text-white/55',
  bg: 'bg-white/[0.07]',
};

function Tag({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.07] text-white/60 text-[10px] font-medium">
      {children}
    </span>
  );
}

function ProposalCountPill({ count, max }) {
  const full = count >= max;
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
      full ? 'bg-red-500/10 text-red-400' : 'bg-white/10 text-white/70'
    }`}>
      {count}/{max} proposals
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-5 animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-40 bg-white/10 rounded-lg" />
            <div className="h-5 w-24 bg-white/10 rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-28 bg-white/10 rounded-md" />
            <div className="h-5 w-20 bg-white/10 rounded-md" />
          </div>
          <div className="h-8 w-full bg-white/10 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function AvailableCard({ req, guideId, commissionRate, onApplied, onSkip }) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [declining, setDeclining] = useState(false);

  const maxProposals = req.max_proposals || 5;
  const isFull = req.accepted_count >= maxProposals;
  const isExpiredForProvider = req.provider_request_state === 'expired';
  const mySlot = req.my_slot;
  const hasApplied = Boolean(mySlot);
  const slotInfo = mySlot ? (SLOT_STATUS_LABEL[mySlot.status] || SLOT_STATUS_LABEL.accepted) : null;
  const start = fmt(req.start_date);
  const end = fmt(req.end_date);
  const packageRequestKind = getPackageRequestKind(req);
  const sourceTour = req.source_tour;
  const sourceTourTitle = sourceTour?.title?.en || sourceTour?.title?.fa || sourceTour?.title || '';

  const handleProposalSuccess = () => {
    setModalOpen(false);
    onApplied();
  };

  const handleDecline = async () => {
    if (!window.confirm('Decline this private package request? The traveler will be notified.')) return;
    setDeclining(true);
    try {
      await declinePackageTripRequest(req.id);
      toast.success('Request declined. The traveler has been notified.');
      onApplied();
    } catch (err) {
      toast.error(err.message || 'Could not decline this request.');
    } finally {
      setDeclining(false);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className={`border rounded-2xl p-5 transition-all ${
          isExpiredForProvider
            ? 'bg-white/[0.035] border-white/[0.06] grayscale opacity-70'
            : 'bg-[hsl(222,45%,14%)] border-white/[0.08] hover:border-white/[0.15]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {packageRequestKind && (
              <span className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                packageRequestKind === 'package_booking'
                  ? 'border-amber-300/25 bg-amber-300/10 text-amber-200'
                  : 'border-teal-300/25 bg-teal-300/10 text-teal-200'
              }`}>
                {packageRequestKind === 'package_booking' ? 'Booking Request' : 'Private Tour Invitation'}
              </span>
            )}
            <h3 className="text-white font-semibold text-sm leading-snug">
              {packageRequestKind === 'package_booking' && sourceTourTitle
                ? sourceTourTitle
                : `Trip to ${cityList(req.destination).join(', ') || 'Iran'}`}
            </h3>
            <p className="text-white/40 text-[11px] mt-0.5">Submitted {fmt(req.created_at)}</p>
          </div>
          {isExpiredForProvider ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold bg-white/[0.08] text-white/55 border border-white/10">
              <Clock className="w-3 h-3" />
              Expired
            </span>
          ) : (
            <ProposalCountPill count={req.accepted_count} max={maxProposals} />
          )}
        </div>

        {packageRequestKind && sourceTour && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            {(sourceTour.image_url || sourceTour.gallery?.[0]) && (
              <img
                src={sourceTour.image_url || sourceTour.gallery[0]}
                alt=""
                className="h-12 w-16 rounded-lg object-cover"
              />
            )}
            <p className="min-w-0 text-xs leading-relaxed text-white/55">
              {packageRequestKind === 'package_booking'
                ? 'A traveler requested this exact package. Review the pre-filled offer before sending.'
                : 'The traveler selected you for a tour based on this reference package. You do not own the original tour.'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(start || end) && (
            <Tag><Calendar className="w-3 h-3 mr-1 inline-block" />{start}{start && end ? ' → ' : ''}{end}</Tag>
          )}
          {(req.adults || req.adult_count) && (
            <Tag>
              <Users className="w-3 h-3 mr-1 inline-block" />
              {(req.adults || req.adult_count || 1)} adult{((req.adults || req.adult_count) > 1) ? 's' : ''}
              {(req.children || req.child_count) > 0 ? `, ${req.children || req.child_count} child` : ''}
            </Tag>
          )}
          {req.guide_languages?.length > 0 && (
            <Tag><Globe className="w-3 h-3 mr-1 inline-block" />{req.guide_languages.join(', ')}</Tag>
          )}
          {req.tour_type && <Tag>{req.tour_type}</Tag>}
        </div>

        {req.requirements && (
          <p className="text-white/50 text-xs leading-relaxed mb-4 line-clamp-2">
            <FileText className="w-3 h-3 inline-block mr-1 text-white/30" />
            {req.requirements}
          </p>
        )}

        {isExpiredForProvider ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-white/45" />
            <div>
              <p className="text-xs font-semibold text-white/65">This request has expired for you.</p>
              <p className="text-[11px] leading-relaxed text-white/40 mt-0.5">
                The traveler selected another guide or agency, so this tour request is no longer available.
              </p>
            </div>
          </div>
        ) : hasApplied ? (
          <div className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium ${slotInfo.bg} ${slotInfo.color}`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {t('proposal_submitted')} ({mySlot.status})
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setModalOpen(true)}
              disabled={isFull}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isFull
                  ? 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                  : 'bg-[hsl(178,85%,32%)] hover:bg-[hsl(178,85%,28%)] text-white shadow-lg shadow-[hsl(178,85%,32%)]/20'
              }`}
            >
              {isFull ? (
                <><AlertCircle className="w-4 h-4" /> Request closed ({req.accepted_count}/{maxProposals})</>
              ) : (
                <><FileText className="w-4 h-4" /> {packageRequestKind === 'package_booking' ? 'Confirm & Send Offer' : packageRequestKind ? 'Create Proposal' : 'See Details'}</>
              )}
            </button>
            {!isFull && (
              packageRequestKind ? (
                <button
                  onClick={handleDecline}
                  disabled={declining}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-200/70 hover:bg-red-500/10 hover:text-red-200 transition-colors disabled:opacity-50"
                >
                  {declining ? 'Declining…' : 'Decline'}
                </button>
              ) : (
                <button
                  onClick={() => onSkip(req.id)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-colors"
                >
                  {t('skip')}
                </button>
              )
            )}
          </div>
        )}
      </motion.div>

      {!isExpiredForProvider && (
        <SubmitProposalModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          request={req}
          guideId={guideId}
          commissionRate={commissionRate}
          onSuccess={handleProposalSuccess}
        />
      )}
    </>
  );
}

function ProposalCard({ entry, onChanged }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const req = entry.request;
  const filledByAnother = Boolean(
    entry.status === 'rejected' &&
    req?.selected_guide_id &&
    ['confirmed', 'booked', 'completed'].includes(req?.status)
  );
  const explicitlyRejected = entry.status === 'rejected' && !filledByAnother;
  const slotInfo = filledByAnother
    ? FILLED_SLOT_INFO
    : (SLOT_STATUS_LABEL[entry.status] || { text: entry.status, color: 'text-white/40', bg: 'bg-white/[0.05]' });
  const start = fmt(req?.start_date);
  const end = fmt(req?.end_date);
  const dest = cityList(req?.destination).join(', ') || 'Iran';
  const canConfirmBooking = entry.status === 'selected' && req?.status === 'confirmed';

  const priceLabel = entry.price
    ? `$${Number(entry.price).toLocaleString()} ${
        entry.price_type === 'per_person' ? t('per_person') : t('entire_group')
      }, ${entry.price_period === 'per_day' ? t('per_day') : t('entire_trip')}`
    : null;

  const firstLineItinerary = entry.itinerary ? entry.itinerary.split('\n')[0].trim() : null;

  const handleConfirmBooking = async () => {
    setConfirming(true);
    try {
      await guideConfirmBooking(entry.trip_request_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trip_requests'] }),
        queryClient.invalidateQueries({ queryKey: ['trip_request', entry.trip_request_id] }),
        queryClient.invalidateQueries({ queryKey: ['trip_slots_proposals', entry.trip_request_id] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['booking', entry.trip_request_id] }),
      ]);
      toast.success('Booking confirmed. The traveler has been notified.');
      await onChanged();
    } catch (err) {
      toast.error(err.message || 'Could not confirm this booking.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={`border rounded-2xl p-5 transition-all ${
      entry.status === 'rejected'
        ? 'bg-white/[0.035] border-white/[0.06] grayscale opacity-75'
        : 'bg-[hsl(222,45%,14%)] border-white/[0.08]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-semibold text-sm">Trip to {dest}</h3>
          <p className="text-white/40 text-[11px] mt-0.5">
            {t('submitted_on').replace('{date}', fmt(entry.accepted_at) || '—')}
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${slotInfo.bg} ${slotInfo.color}`}>
          {slotInfo.text}
        </span>
      </div>

      {filledByAnother && (
        <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/10 px-3.5 py-3 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-white/45" />
          <p className="text-xs leading-relaxed text-white/50">
            Expired — the traveler selected another guide or agency. You can no longer act on this request.
          </p>
        </div>
      )}

      {explicitlyRejected && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-3.5 py-3 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300/80" />
          <p className="text-xs leading-relaxed text-red-100/70">
            The traveler rejected your proposal. This proposal is kept here for your records.
          </p>
        </div>
      )}

      {priceLabel && <p className="text-[hsl(178,85%,55%)] font-semibold text-sm mb-2">{priceLabel}</p>}

      {firstLineItinerary && (
        <p className="text-white/40 text-xs mb-2 line-clamp-1">
          <FileText className="w-3 h-3 inline-block mr-1 text-white/20" />
          {firstLineItinerary}
        </p>
      )}

      {(start || end) && (
        <p className="text-white/40 text-xs flex items-center gap-1 mb-3">
          <Calendar className="w-3 h-3" />
          {start}{start && end ? ' → ' : ''}{end}
        </p>
      )}

      {canConfirmBooking && (
        <button
          onClick={handleConfirmBooking}
          disabled={confirming}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20 text-sm font-semibold transition disabled:opacity-50"
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {confirming ? 'Confirming…' : 'Confirm booking'}
        </button>
      )}
    </div>
  );
}

export default function GuideRequestsView({ userId }) {
  const { t, dir } = useI18n();

  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [skipped, setSkipped] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commissionRate, setCommissionRate] = useState(0.15);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('commission_rate')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.commission_rate != null) setCommissionRate(Number(data.commission_rate));
      });
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [avail, acc] = await Promise.all([
        fetchAvailableRequests(userId),
        fetchMyAcceptedRequests(userId),
      ]);
      setAvailable(avail);
      setProposals(acc);
    } catch (err) {
      setError(err.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSkip = (id) => setSkipped(prev => new Set([...prev, id]));
  const visibleAvailable = available.filter(r => !skipped.has(r.id));

  const tabItems = [
    { id: 'available', label: 'Available', count: visibleAvailable.length },
    { id: 'proposals', label: t('my_proposals'), count: proposals.length },
  ];

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Tour Requests</h2>
          <p className="text-white/40 text-xs mt-0.5">
            Submit proposals to open requests and confirm bookings when a traveler selects you.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs transition disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex bg-white/[0.05] rounded-xl p-1 mb-6 w-fit gap-1">
        {tabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === item.id ? 'bg-[hsl(178,85%,32%)] text-white shadow' : 'text-white/50 hover:text-white'
            }`}
          >
            {item.label}
            {item.count > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                tab === item.id ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
              }`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      ) : loading ? (
        <LoadingState />
      ) : tab === 'available' ? (
        visibleAvailable.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/50 font-medium text-sm mb-1">No open trip requests</p>
            <p className="text-white/30 text-xs max-w-xs">New requests from travelers will appear here. Check back soon!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleAvailable.map(req => (
                <AvailableCard
                  key={req.id}
                  req={req}
                  guideId={userId}
                  commissionRate={commissionRate}
                  onApplied={load}
                  onSkip={handleSkip}
                />
              ))}
            </div>
          </AnimatePresence>
        )
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/50 font-medium text-sm mb-1">No proposals yet</p>
          <p className="text-white/30 text-xs max-w-xs">Requests you apply to will show here with their status.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(entry => (
            <ProposalCard key={entry.id} entry={entry} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
