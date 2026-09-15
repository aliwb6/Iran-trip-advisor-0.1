import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  MapPin,
  Star,
  XCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { toast } from 'sonner';
import { touristSelectGuide } from '@/api/tourRequestFlow';
import { fetchParticipantProfiles } from '@/api/participantProfiles';
import SharedImageLightbox from '@/components/ui/SharedImageLightbox';

const PROPOSAL_TONES = [
  {
    card: 'border-teal-300/80 bg-teal-50/70 dark:border-teal-500/35 dark:bg-teal-950/20',
    badge: 'border-teal-200 bg-teal-100 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300',
  },
  {
    card: 'border-amber-300/80 bg-amber-50/70 dark:border-amber-500/35 dark:bg-amber-950/20',
    badge: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  },
  {
    card: 'border-sky-300/80 bg-sky-50/70 dark:border-sky-500/35 dark:bg-sky-950/20',
    badge: 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300',
  },
  {
    card: 'border-violet-300/80 bg-violet-50/70 dark:border-violet-500/35 dark:bg-violet-950/20',
    badge: 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300',
  },
  {
    card: 'border-rose-300/80 bg-rose-50/70 dark:border-rose-500/35 dark:bg-rose-950/20',
    badge: 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
  },
];

function profilePath(guide) {
  return guide?.role === 'agency'
    ? `/agencies/${guide.id}`
    : `/guides/${guide.id}`;
}

function humanizeEnum(str) {
  return str ? str.replace(/_/g, ' ') : '';
}

function proposalImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Legacy records may contain one URL or one URL per line.
  }
  return raw.split(/\n|,/).map(item => item.trim()).filter(Boolean);
}

function formatPrice(slot, t) {
  if (slot.price == null) return t('proposal_no_price');
  const num = Number(slot.price).toLocaleString('en-US');
  const currency = slot.currency ? ` ${slot.currency}` : '';
  const type = slot.price_type ? ` · ${humanizeEnum(slot.price_type)}` : '';
  const period = slot.price_period ? ` · ${humanizeEnum(slot.price_period)}` : '';
  return `${num}${currency}${type}${period}`;
}

function hasSubmittedDetails(slot) {
  return (
    slot.price != null ||
    (slot.itinerary && slot.itinerary.trim()) ||
    slot.included?.length > 0 ||
    slot.excluded?.length > 0 ||
    (slot.message && slot.message.trim())
  );
}

function RoleBadge({ role, t }) {
  const isAgency = role === 'agency';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
      isAgency
        ? 'bg-amber-500/15 text-amber-500 border-amber-400/30'
        : 'bg-accent/15 text-accent border-accent/30'
    }`}>
      {isAgency ? t('proposals_agency') : t('proposals_guide')}
    </span>
  );
}

function GuideAvatar({ guide, size = 'md' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  if (guide?.avatar_url) {
    return (
      <img
        decoding="async"
        loading="lazy"
        src={guide.avatar_url}
        alt={guide.full_name}
        className={`${sz} rounded-full object-cover border border-border/40 shrink-0`}
      />
    );
  }
  return (
    <div className={`${sz} rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-semibold shrink-0`}>
      {guide?.full_name?.[0] || '?'}
    </div>
  );
}

function DetailBlock({ label, children }) {
  return (
    <div className="p-3.5 rounded-xl bg-background/40 border border-border/30">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function ProposalDetailContent({ slot }) {
  const { t, lang } = useI18n();
  const guide = slot.guide || {};
  const path = profilePath(guide);
  const submitted = hasSubmittedDetails(slot);
  const rejected = slot.traveler_decision === 'rejected' || slot.status === 'rejected';
  const pending = slot.traveler_decision === 'pending' && !rejected;
  const images = proposalImages(slot.images);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);

  return (
    <div className="space-y-4 pt-4">
      <p className="font-heading text-base font-semibold text-foreground">
        {t('proposal_detail_title')}
      </p>

      {rejected && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/60 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          {lang === 'fa'
            ? 'این پیشنهاد رد شده و فقط برای سابقه نگه‌داری می‌شود. رد کردن قابل بازگشت نیست.'
            : lang === 'ar'
            ? 'تم رفض هذا العرض نهائياً وهو محفوظ للرجوع إليه.'
            : 'This proposal was rejected permanently and is kept for your records.'}
        </div>
      )}

      {pending && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {lang === 'fa'
            ? 'این پیشنهاد در حالت Pending است. همچنان فعال می‌ماند و می‌توانید بعداً آن را تأیید کنید.'
            : lang === 'ar'
            ? 'هذا العرض في حالة Pending. يبقى فعالاً ويمكنك الموافقة عليه لاحقاً.'
            : 'This proposal is Pending. It stays active and you can approve it later.'}
        </div>
      )}

      <Link
        to={path}
        className="group flex items-center gap-3 w-fit max-w-full rounded-2xl border border-border/45 bg-background/45 px-3.5 py-3 hover:border-accent/40 hover:bg-accent/[0.04] transition-all"
      >
        <GuideAvatar guide={guide} size="lg" />
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground truncate group-hover:text-accent transition-colors">
            {guide.full_name}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <RoleBadge role={guide.role} t={t} />
            {guide.rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {guide.rating}
              </span>
            )}
            {guide.city && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {guide.city}
              </span>
            )}
          </div>
        </div>
      </Link>

      {!submitted ? (
        <p className="text-sm text-muted-foreground italic py-2">
          {t('slot_not_submitted')}
        </p>
      ) : (
        <>
          <DetailBlock label={t('proposal_price_label')}>
            <p className="text-sm font-semibold text-foreground">{formatPrice(slot, t)}</p>
          </DetailBlock>

          {slot.itinerary?.trim() && (
            <DetailBlock label={t('proposal_itinerary')}>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {slot.itinerary}
              </p>
            </DetailBlock>
          )}

          {slot.included?.length > 0 && (
            <DetailBlock label={t('proposal_included')}>
              <ul className="space-y-1.5">
                {slot.included.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </DetailBlock>
          )}

          {slot.excluded?.length > 0 && (
            <DetailBlock label={t('proposal_excluded')}>
              <ul className="space-y-1.5">
                {slot.excluded.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </DetailBlock>
          )}

          {slot.message?.trim() && (
            <DetailBlock label={t('proposal_message')}>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {slot.message}
              </p>
            </DetailBlock>
          )}

          {images.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">
                {t('proposal_images')}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImageIndex(i)}
                    className="overflow-hidden rounded-xl border border-border/30 text-start"
                  >
                    <motion.img
                      layoutId={`proposal-image-${slot.id}-${i}`}
                      decoding="async"
                      loading="lazy"
                      src={img}
                      alt=""
                      className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                    />
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selectedImageIndex != null && images[selectedImageIndex] && (
        <SharedImageLightbox
          image={images[selectedImageIndex]}
          layoutId={`proposal-image-${slot.id}-${selectedImageIndex}`}
          alt={t('proposal_images')}
          onClose={() => setSelectedImageIndex(null)}
        />
      )}
    </div>
  );
}

function ProposalRow({
  slot,
  index,
  onReject,
  onSelect,
  onTogglePending,
  rejecting,
  selecting,
  pendingBusy,
  canSelect,
}) {
  const { t, lang } = useI18n();
  const [showDetail, setShowDetail] = useState(false);
  const guide = slot.guide || {};
  const path = profilePath(guide);
  const rejected = slot.traveler_decision === 'rejected' || slot.status === 'rejected';
  const pending = slot.traveler_decision === 'pending' && !rejected;
  const approved = slot.traveler_decision === 'approved' || slot.status === 'selected';
  const actionable = ['accepted', 'chatting'].includes(slot.status) && !rejected && !approved;
  const tone = PROPOSAL_TONES[index % PROPOSAL_TONES.length];
  const proposalLabel = lang === 'fa'
    ? `پیشنهاد ${index + 1}`
    : lang === 'ar'
    ? `العرض ${index + 1}`
    : `Proposal ${index + 1}`;
  const detailsLabel = showDetail
    ? (lang === 'fa' ? 'بستن جزئیات' : lang === 'ar' ? 'إخفاء التفاصيل' : 'Hide Details')
    : t('proposal_see_details');
  const detailId = `proposal-details-${slot.id}`;

  const approveLabel = lang === 'fa' ? 'تأیید' : lang === 'ar' ? 'موافقة' : 'Approve';
  const pendingLabel = pending
    ? (lang === 'fa' ? 'خروج از Pending' : lang === 'ar' ? 'إلغاء Pending' : 'Remove Pending')
    : 'Pending';
  const rejectLabel = lang === 'fa' ? 'رد' : lang === 'ar' ? 'رفض' : 'Reject';

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all duration-300 ${
      rejected
        ? 'bg-gray-100/80 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 grayscale opacity-70'
        : pending
        ? 'border-amber-300/90 bg-amber-50/60 dark:border-amber-500/45 dark:bg-amber-950/20 shadow-sm'
        : `${tone.card} shadow-sm hover:shadow-md`
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to={path} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <GuideAvatar guide={guide} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-foreground truncate">{guide.full_name}</p>
              {!rejected && (
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${tone.badge}`}>
                  {proposalLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <RoleBadge role={guide.role} t={t} />
              {rejected && (
                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold">
                  {lang === 'fa' ? 'رد شده · نهایی' : lang === 'ar' ? 'مرفوض · نهائي' : 'Rejected · Final'}
                </span>
              )}
              {pending && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 text-[10px] font-bold">
                  <Clock3 className="w-3 h-3" /> Pending
                </span>
              )}
              {approved && !rejected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> {approveLabel}
                </span>
              )}
              {guide.rating > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {guide.rating}
                </span>
              )}
              {guide.city && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {guide.city}
                </span>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 flex-wrap sm:justify-end sm:shrink-0">
          <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-1.5 min-w-[92px]">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
              {t('proposal_price_label')}
            </p>
            <p className="text-sm font-bold text-foreground whitespace-nowrap">
              {slot.price != null
                ? `${Number(slot.price).toLocaleString('en-US')} ${slot.currency || ''}`
                : '—'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDetail(prev => !prev)}
            aria-expanded={showDetail}
            aria-controls={detailId}
            className="shrink-0 inline-flex items-center gap-1.5 justify-center rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-accent/20 hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/25 transition-all whitespace-nowrap"
          >
            {detailsLabel}
            <ChevronDown
              aria-hidden="true"
              className={`w-3.5 h-3.5 shrink-0 transform-gpu origin-center transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${showDetail ? '-scale-y-100' : 'scale-y-100'}`}
            />
          </button>

          {canSelect && actionable && (
            <button
              type="button"
              onClick={() => onSelect(slot)}
              disabled={selecting || rejecting || pendingBusy}
              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {selecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {selecting ? (lang === 'fa' ? 'در حال تأیید…' : 'Approving…') : approveLabel}
            </button>
          )}

          {canSelect && actionable && (
            <button
              type="button"
              onClick={() => onTogglePending(slot)}
              disabled={pendingBusy || rejecting || selecting}
              aria-pressed={pending}
              className={`shrink-0 inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 transition-colors ${
                pending
                  ? 'border-amber-500/50 bg-amber-500 text-white hover:bg-amber-600'
                  : 'border-amber-400/45 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
              }`}
            >
              {pendingBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
              {pendingBusy ? (lang === 'fa' ? 'در حال ذخیره…' : 'Saving…') : pendingLabel}
            </button>
          )}

          {actionable && (
            <button
              type="button"
              onClick={() => onReject(slot)}
              disabled={rejecting || selecting || pendingBusy}
              className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/15 hover:text-red-600 disabled:opacity-50 transition-colors"
            >
              {rejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {rejectLabel}
            </button>
          )}
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          showDetail ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          id={detailId}
          role="region"
          aria-hidden={!showDetail}
          className="min-h-0 overflow-hidden"
        >
          <div className={`mt-4 border-t border-border/30 transition-[opacity,filter] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:blur-0 ${
            showDetail ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px]'
          }`}>
            <ProposalDetailContent slot={slot} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProposalsPanel({ requestId, proposalRound = 1, requestStatus }) {
  const { t, lang, dir } = useI18n();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const canSelect = ['open', 'active', 'pending', 'proposals_ready'].includes(requestStatus);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['trip_slots_proposals', requestId, proposalRound],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_slots')
        .select('*')
        .eq('trip_request_id', requestId)
        .eq('proposal_round', proposalRound)
        .order('accepted_at', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });
      if (error) throw error;

      const rawSlots = data ?? [];
      if (rawSlots.length === 0) return rawSlots;

      const profiles = await fetchParticipantProfiles(rawSlots.map(slot => slot.guide_id));
      const profileById = new Map(profiles.map(profile => [profile.id, profile]));

      return rawSlots.map(slot => ({
        ...slot,
        guide: profileById.get(slot.guide_id) || {
          id: slot.guide_id,
          full_name: 'Provider',
          role: 'guide',
        },
      }));
    },
    enabled: !!requestId,
    staleTime: 30_000,
  });

  const refreshProposalState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['trip_slots_proposals', requestId] }),
      queryClient.invalidateQueries({ queryKey: ['trip_slots_counts'] }),
      queryClient.invalidateQueries({ queryKey: ['trip_requests'] }),
      queryClient.invalidateQueries({ queryKey: ['trip_request', requestId] }),
      queryClient.invalidateQueries({ queryKey: ['trip_request_detail', requestId] }),
    ]);
  };

  const rejectProposal = async (slot) => {
    const warning = lang === 'fa'
      ? 'آیا مطمئنی می‌خواهی این پروپوزال را رد کنی؟ این تصمیم نهایی است و بعد از رد کردن دیگر نمی‌توانی پروپوزال را برگردانی یا تأییدش کنی.'
      : lang === 'ar'
      ? 'هل أنت متأكد من رفض هذا العرض؟ هذا القرار نهائي، وبعد الرفض لن تتمكن من استعادة العرض أو الموافقة عليه لاحقاً.'
      : 'Are you sure you want to reject this proposal? This decision is final. Once rejected, you cannot restore or approve it later.';

    if (!window.confirm(warning)) return;

    setRejectingId(slot.id);
    try {
      const { data: rejected, error } = await supabase.rpc('reject_trip_proposal', {
        proposal_id: slot.id,
      });
      if (error || !rejected) {
        throw error || new Error('Could not reject the proposal.');
      }
      await refreshProposalState();
      toast.success(
        lang === 'fa'
          ? 'پروپوزال برای همیشه رد شد. اگر پیشنهادی در صف آماده باشد، حالا نمایش داده می‌شود.'
          : lang === 'ar'
          ? 'تم رفض العرض نهائياً. سيظهر العرض التالي إذا كان جاهزاً.'
          : 'Proposal rejected permanently. The next queued proposal is now available when ready.',
      );
    } catch (error) {
      toast.error(error?.message || 'Could not reject the proposal.');
    } finally {
      setRejectingId(null);
    }
  };

  const togglePending = async (slot) => {
    const moveToPending = slot.traveler_decision !== 'pending';
    setPendingId(slot.id);
    try {
      const { data, error } = await supabase.rpc('set_trip_proposal_pending', {
        proposal_id: slot.id,
        is_pending: moveToPending,
      });
      if (error || !data) {
        throw error || new Error('Could not update the proposal decision.');
      }
      await refreshProposalState();

      if (moveToPending) {
        toast.success(
          lang === 'fa'
            ? 'پروپوزال Pending شد. راهنما/آژانس با نوتیفیکیشن و ایمیل مطلع می‌شود و پیشنهاد بعدیِ آماده می‌تواند نمایش داده شود.'
            : lang === 'ar'
            ? 'تم وضع العرض في حالة Pending وإبلاغ مقدم الخدمة. يمكن الآن إظهار العرض التالي الجاهز.'
            : 'Proposal moved to Pending. The provider is notified, and the next ready proposal can now be shown.',
        );
      } else {
        toast.success(
          lang === 'fa'
            ? 'پروپوزال از Pending خارج شد و همچنان می‌توانید آن را تأیید یا رد کنید.'
            : lang === 'ar'
            ? 'تمت إزالة حالة Pending. لا يزال بإمكانك الموافقة على العرض أو رفضه.'
            : 'Pending removed. You can still approve or reject this proposal.',
        );
      }
    } catch (error) {
      toast.error(error?.message || 'Could not update the proposal decision.');
    } finally {
      setPendingId(null);
    }
  };

  const selectProposal = async (slot) => {
    const confirmation = lang === 'fa'
      ? 'این پروپوزال تأیید شود؟ با تأیید، این راهنما/آژانس برای سفر انتخاب می‌شود و مرحله پرداخت برای شما فعال خواهد شد.'
      : lang === 'ar'
      ? 'هل تريد الموافقة على هذا العرض؟ سيتم اختيار مقدم الخدمة وتفعيل مرحلة الدفع.'
      : 'Approve this proposal? This selects the guide or agency for your trip and enables the payment step.';

    if (!window.confirm(confirmation)) return;

    setSelectingId(slot.id);
    try {
      await touristSelectGuide(requestId, slot.guide_id);
      await refreshProposalState();
      toast.success(
        lang === 'fa'
          ? 'پروپوزال تأیید شد. پرداخت ۱۵٪ برای شما آماده است.'
          : lang === 'ar'
          ? 'تمت الموافقة على العرض. دفعة 15٪ جاهزة الآن.'
          : 'Proposal approved. Your 15% deposit is ready to pay.',
      );
    } catch (error) {
      toast.error(error?.message || 'Could not approve this proposal.');
    } finally {
      setSelectingId(null);
    }
  };

  const panelSubtitle = lang === 'fa'
    ? 'فقط پروپوزال‌های تأییدشده توسط ادمین نمایش داده می‌شوند. Pending به شما اجازه می‌دهد پیشنهاد را نگه دارید و گزینه بعدی را هم ببینید.'
    : lang === 'ar'
    ? 'تظهر فقط العروض المعتمدة من الإدارة. استخدم Pending للاحتفاظ بالعرض ومقارنته بالعرض التالي.'
    : 'Only admin-approved proposals appear here. Use Pending to keep an offer active while comparing the next available proposal.';

  return (
    <div className="pt-5 border-t border-border/30" dir={dir}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-heading text-base sm:text-lg font-bold text-foreground">
            {t('card_view_proposals')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            {panelSubtitle}
          </p>
        </div>
        {!isLoading && slots.length > 0 && (
          <span className="shrink-0 inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-full bg-accent/15 text-accent border border-accent/30 text-sm font-bold">
            {slots.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {t('proposals_no_proposals')}
        </p>
      ) : (
        <div className="space-y-3">
          {slots.map((slot, index) => (
            <ProposalRow
              key={slot.id}
              slot={slot}
              index={index}
              onReject={rejectProposal}
              onSelect={selectProposal}
              onTogglePending={togglePending}
              rejecting={rejectingId === slot.id}
              selecting={selectingId === slot.id}
              pendingBusy={pendingId === slot.id}
              canSelect={canSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
