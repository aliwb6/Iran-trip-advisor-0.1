import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Calendar, Users, Globe, FileText,
  Clock, RefreshCw, AlertCircle, CheckCircle2,
  Send,
} from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import {
  fetchAvailableRequests,
  fetchMyAcceptedRequests,
} from '@/api/tourRequestFlow';
import SubmitProposalModal from './SubmitProposalModal';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// destination is a text[] column; tolerate legacy string values too
const cityList = (d) => (Array.isArray(d) ? d : d ? [d] : []);

const SLOT_STATUS_LABEL = {
  accepted:  { text: 'Waiting for tourist',  color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  selected:  { text: 'You were chosen! 🎉',  color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  rejected:  { text: 'Not selected',         color: 'text-white/40',    bg: 'bg-white/[0.05]'  },
  chatting:  { text: 'In discussion',        color: 'text-blue-400',    bg: 'bg-blue-400/10'   },
  finalized: { text: 'Finalized',            color: 'text-emerald-400', bg: 'bg-emerald-400/10'},
  closed:    { text: 'Closed',               color: 'text-white/30',    bg: 'bg-white/[0.04]'  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const { t, lang, dir } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);

  const maxProposals = req.max_proposals || 5;
  const isFull    = req.accepted_count >= maxProposals;
  const mySlot    = req.my_slot;
  const hasApplied = Boolean(mySlot);

  const slotInfo = mySlot ? (SLOT_STATUS_LABEL[mySlot.status] || SLOT_STATUS_LABEL.accepted) : null;

  const start = fmt(req.start_date);
  const end   = fmt(req.end_date);

  const handleProposalSuccess = () => {
    setModalOpen(false);
    onApplied();
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-5 hover:border-white/[0.15] transition-colors"
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-snug">
              Trip to {cityList(req.destination).join(', ') || 'Iran'}
            </h3>
            <p className="text-white/40 text-[11px] mt-0.5">
              Submitted {fmt(req.created_at)}
            </p>
          </div>
          <ProposalCountPill count={req.accepted_count} max={maxProposals} />
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(start || end) && (
            <Tag>
              <Calendar className="w-3 h-3 mr-1 inline-block" />
              {start}{start && end ? ' → ' : ''}{end}
            </Tag>
          )}
          {(req.adults || req.adult_count) && (
            <Tag>
              <Users className="w-3 h-3 mr-1 inline-block" />
              {(req.adults || req.adult_count || 1)} adult{((req.adults || req.adult_count) > 1) ? 's' : ''}
              {(req.children || req.child_count) > 0 ? `, ${req.children || req.child_count} child` : ''}
            </Tag>
          )}
          {req.guide_languages?.length > 0 && (
            <Tag>
              <Globe className="w-3 h-3 mr-1 inline-block" />
              {req.guide_languages.join(', ')}
            </Tag>
          )}
          {req.tour_type && <Tag>{req.tour_type}</Tag>}
        </div>

        {/* Requirements */}
        {req.requirements && (
          <p className="text-white/50 text-xs leading-relaxed mb-4 line-clamp-2">
            <FileText className="w-3 h-3 inline-block mr-1 text-white/30" />
            {req.requirements}
          </p>
        )}

        {/* Buttons / status */}
        {hasApplied ? (
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
                <><AlertCircle className="w-4 h-4" /> {t('request_closed_5_5')}</>
              ) : (
                <><Send className="w-4 h-4" /> {t('apply')}</>
              )}
            </button>
            {!isFull && (
              <button
                onClick={() => onSkip(req.id)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-colors"
              >
                {t('skip')}
              </button>
            )}
          </div>
        )}
      </motion.div>

      <SubmitProposalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        request={req}
        guideId={guideId}
        commissionRate={commissionRate}
        onSuccess={handleProposalSuccess}
      />
    </>
  );
}

function ProposalCard({ entry }) {
  const { t } = useI18n();
  const req      = entry.request;
  const slotInfo = SLOT_STATUS_LABEL[entry.status] || { text: entry.status, color: 'text-white/40', bg: 'bg-white/[0.05]' };
  const start = fmt(req?.start_date);
  const end   = fmt(req?.end_date);
  const dest  = cityList(req?.destination).join(', ') || 'Iran';

  const priceLabel = entry.price
    ? `$${Number(entry.price).toLocaleString()} ${
        entry.price_type === 'per_person' ? t('per_person') : t('entire_group')
      }, ${entry.price_period === 'per_day' ? t('per_day') : t('entire_trip')}`
    : null;

  const firstLineItinerary = entry.itinerary
    ? entry.itinerary.split('\n')[0].trim()
    : null;

  return (
    <div className="bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl p-5">
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

      {priceLabel && (
        <p className="text-[hsl(178,85%,55%)] font-semibold text-sm mb-2">{priceLabel}</p>
      )}

      {firstLineItinerary && (
        <p className="text-white/40 text-xs mb-2 line-clamp-1">
          <FileText className="w-3 h-3 inline-block mr-1 text-white/20" />
          {firstLineItinerary}
        </p>
      )}

      {(start || end) && (
        <p className="text-white/40 text-xs flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {start}{start && end ? ' → ' : ''}{end}
        </p>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GuideRequestsView({ userId }) {
  const { t, lang, dir } = useI18n();

  const [tab, setTab]               = useState('available');
  const [available, setAvailable]   = useState([]);
  const [proposals, setProposals]   = useState([]);
  const [skipped, setSkipped]       = useState(new Set());
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [commissionRate, setCommissionRate] = useState(0.15);

  // Fetch guide's commission_rate once
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
    { id: 'available', label: 'Available',          count: visibleAvailable.length },
    { id: 'proposals', label: t('my_proposals'),    count: proposals.length },
  ];

  return (
    <div dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Tour Requests</h2>
          <p className="text-white/40 text-xs mt-0.5">
            Be one of the first 5 guides to submit a proposal
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

      {/* Tabs */}
      <div className="flex bg-white/[0.05] rounded-xl p-1 mb-6 w-fit gap-1">
        {tabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === item.id
                ? 'bg-[hsl(178,85%,32%)] text-white shadow'
                : 'text-white/50 hover:text-white'
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

      {/* Content */}
      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      ) : loading ? (
        <LoadingState />
      ) : tab === 'available' ? (
        visibleAvailable.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/50 font-medium text-sm mb-1">No open trip requests</p>
            <p className="text-white/30 text-xs max-w-xs">
              New requests from travelers will appear here. Check back soon!
            </p>
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
      ) : (
        proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4">
              <Clock className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/50 font-medium text-sm mb-1">No proposals yet</p>
            <p className="text-white/30 text-xs max-w-xs">
              Requests you apply to will show here with their status.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map(entry => (
              <ProposalCard key={entry.id} entry={entry} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
