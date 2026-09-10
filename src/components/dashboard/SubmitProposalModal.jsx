import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, DollarSign, AlertTriangle,
  MapPin, CalendarDays, Clock, Users, Globe, Sparkles,
  Briefcase, Plus, User, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n.jsx';
import { guideSubmitProposal } from '@/api/tourRequestFlow';
import { calculateProposalEstimate } from '@/lib/proposalPricing';

// ── helpers ───────────────────────────────────────────────────────────────────

const cityList = (d) => (Array.isArray(d) ? d : d ? [d] : []);

const parseLines = (text) =>
  text.split('\n').map(s => s.trim()).filter(Boolean);

const cap = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

function fmtDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b) - new Date(a);
  return ms > 0 ? Math.round(ms / 86400000) : null;
}

function hasValue(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

// ── TripDetailsPanel ──────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-teal-400/70 shrink-0" />
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
          {label}
        </span>
      </div>
      <div className="text-sm text-white pl-5">{children}</div>
    </div>
  );
}

function TripDetailsPanel({ request, t }) {
  const cities    = cityList(request?.destination);
  const startFmt  = fmtDate(request?.start_date);
  const endFmt    = fmtDate(request?.end_date);
  const duration  = daysBetween(request?.start_date, request?.end_date);
  const adults    = request?.adults ?? 0;
  const children  = request?.children ?? 0;

  const travelersStr = [
    adults > 0   ? `${adults} ${t('adults')}`   : null,
    children > 0 ? `${children} ${t('children')}` : null,
  ].filter(Boolean).join(', ');

  const assistanceWithStars = (() => {
    const arr = request?.assistance || [];
    if (arr.length === 0) return null;
    const base = arr.join(', ');
    if (arr.includes('Accommodation') && request?.accommodation_stars > 0) {
      return `${base} (${request.accommodation_stars}⭐ hotels)`;
    }
    return base;
  })();

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 mb-6">
      <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-4">
        {t('traveler_request_details')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ROW 1 — Destination */}
        {hasValue(cities) && (
          <DetailRow icon={MapPin} label={t('destinations')}>
            {cities.join(', ')}
          </DetailRow>
        )}

        {/* ROW 2 — Travel dates */}
        {(startFmt || endFmt) && (
          <DetailRow icon={CalendarDays} label={t('travel_dates')}>
            <span>
              {startFmt}{startFmt && endFmt ? ' → ' : ''}{endFmt}
              {duration && (
                <span className="ml-2 text-white/50">({duration} days)</span>
              )}
            </span>
          </DetailRow>
        )}

        {/* ROW 3 — Arrival / departure times */}
        {(request?.timings_flexible || hasValue(request?.arrival_time) || hasValue(request?.departure_time)) && (
          <DetailRow icon={Clock} label={t('arrival_departure')}>
            {request?.timings_flexible
              ? <span className="text-white/60 italic">{t('flexible_timings')}</span>
              : `${request?.arrival_time || '—'} → ${request?.departure_time || '—'}`
            }
          </DetailRow>
        )}

        {/* ROW 4 — Travelers */}
        {hasValue(travelersStr) && (
          <DetailRow icon={Users} label={t('travelers')}>
            {travelersStr}
          </DetailRow>
        )}

        {/* ROW 5 — Languages */}
        {hasValue(request?.guide_languages) && (
          <DetailRow icon={Globe} label={t('languages_needed')}>
            {request.guide_languages.map(cap).join(', ')}
          </DetailRow>
        )}

        {/* ROW 6 — Holiday types */}
        {hasValue(request?.holiday_types) && (
          <DetailRow icon={Sparkles} label={t('holiday_types_label')}>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {request.holiday_types.map(h => (
                <span
                  key={h}
                  className="bg-teal-400/15 text-teal-400 px-2.5 py-0.5 rounded-full text-xs"
                >
                  {cap(h)}
                </span>
              ))}
            </div>
          </DetailRow>
        )}

        {/* ROW 7 — Assistance */}
        {hasValue(assistanceWithStars) && (
          <DetailRow icon={Briefcase} label={t('assistance_needed')}>
            {assistanceWithStars}
          </DetailRow>
        )}

        {/* ROW 8 — Additional services */}
        {hasValue(request?.additional_services) && (
          <DetailRow icon={Plus} label={t('additional_services_label')}>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {request.additional_services.map(s => (
                <span
                  key={s}
                  className="bg-white/[0.08] text-white/70 px-2.5 py-0.5 rounded-full text-xs"
                >
                  {cap(s)}
                </span>
              ))}
            </div>
          </DetailRow>
        )}

        {/* ROW 9 — Tour type */}
        {hasValue(request?.tour_type) && (
          <DetailRow icon={request?.tour_type?.toLowerCase().includes('group') ? Users : User} label={t('tour_type_label')}>
            {cap(request.tour_type)}
          </DetailRow>
        )}

        {/* ROW 10 — Requirements (full width) */}
        {hasValue(request?.requirements) && (
          <div className="col-span-1 md:col-span-2">
            <DetailRow icon={MessageSquare} label={t('travelers_requirements')}>
              <div className="bg-white/[0.03] rounded-lg p-3 mt-1">
                <p className="text-white/80 italic text-sm leading-relaxed">
                  {request.requirements}
                </p>
              </div>
            </DetailRow>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Form sub-components ───────────────────────────────────────────────────────

function SegmentedToggle({ options, value, onChange }) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            value === opt.value
              ? 'bg-[hsl(178,85%,32%)] text-white shadow'
              : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.1]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, optional }) {
  return (
    <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
      {children}
      {optional && (
        <span className="ml-1 text-white/30 normal-case tracking-normal font-normal">
          (optional)
        </span>
      )}
    </p>
  );
}

function InlineError({ show, message: msg }) {
  if (!show) return null;
  return (
    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3 shrink-0" />
      {msg}
    </p>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SubmitProposalModal({
  open,
  onClose,
  request,
  guideId,
  commissionRate = 0.15,
  onSuccess,
}) {
  const { t, lang, dir } = useI18n();

  const [price, setPrice]               = useState('');
  const [priceType, setPriceType]       = useState('per_person');
  const [pricePeriod, setPricePeriod]   = useState('entire_trip');
  const [itinerary, setItinerary]       = useState('');
  const [includedText, setIncludedText] = useState('');
  const [excludedText, setExcludedText] = useState('');
  const [message, setMessage]           = useState('');
  const [imagesText, setImagesText]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [attempted, setAttempted]       = useState(false);
  const [hasTransportation, setHasTransportation] = useState(false);
  const [transportationItems, setTransportationItems] = useState([]);
  const [customTransport, setCustomTransport] = useState('');

  const TRANSPORT_OPTIONS = [
    'Private car',
    'Minibus / Van',
    'Coach bus',
    'Motorcycle',
    'Bicycle',
    'Boat',
    'Train',
    'Domestic flight',
  ];

  const toggleTransport = (v) =>
    setTransportationItems(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );

  const addCustomTransport = () => {
    const v = customTransport.trim();
    if (v && !transportationItems.includes(v)) {
      setTransportationItems(prev => [...prev, v]);
    }
    setCustomTransport('');
  };

  const priceNum = parseFloat(price) || 0;
  const estimate = calculateProposalEstimate({
    unitPrice: priceNum,
    priceType,
    pricePeriod,
    request,
    commissionRate,
  });
  const pctDisplay = Math.round(commissionRate * 100);

  const priceValid     = priceNum > 0;
  const itineraryValid = itinerary.trim().length > 0;
  const messageValid   = message.trim().length > 0;
  const isValid        = priceValid && itineraryValid && messageValid;

  // ── Subtitle: "Kish, Sari • 7 days • 3 travelers"
  const destStr     = cityList(request?.destination).join(', ');
  const duration    = daysBetween(request?.start_date, request?.end_date);
  const totalPeople = (request?.adults ?? 0) + (request?.children ?? 0);
  const maxProposals = Math.max(1, Number(request?.max_proposals) || 5);
  const subtitleParts = [
    destStr || null,
    duration ? `${duration} days` : null,
    totalPeople > 0 ? `${totalPeople} traveler${totalPeople !== 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' • ') || destStr || 'Custom Trip';

  const priceTypeOptions = [
    { value: 'per_person',   label: t('per_person') },
    { value: 'entire_group', label: t('entire_group') },
  ];
  const pricePeriodOptions = [
    { value: 'per_day',     label: t('per_day') },
    { value: 'entire_trip', label: t('entire_trip') },
  ];

  const inputCls =
    'w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[hsl(178,85%,50%)] transition-colors resize-none';

  const handleSubmit = async () => {
    setAttempted(true);
    if (!isValid) return;

    try {
      setSubmitting(true);
      await guideSubmitProposal(guideId, request.id, {
        price: priceNum,
        currency: 'USD',
        price_type: priceType,
        price_period: pricePeriod,
        itinerary,
        included: parseLines(includedText),
        excluded: parseLines(excludedText),
        message,
        images: parseLines(imagesText),
        transportation: hasTransportation ? transportationItems : [],
      });
      toast.success(t('proposal_sent'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || t('proposal_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        dir={dir}
        className="max-w-2xl p-0 border-0 bg-transparent shadow-none overflow-hidden"
        style={{ maxHeight: '92vh' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: 'hsl(222,55%,8%)',
            border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '92vh',
          }}
        >
          {/* ── Header ── */}
          <div
            className="shrink-0 px-6 pt-6 pb-5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold">
                {t('submit_proposal')}
              </DialogTitle>
            </DialogHeader>
            <p className="text-white/50 text-sm mt-1">{subtitle}</p>
            <span className="inline-block mt-2 text-[10px] font-medium text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1">
              Request closes when {maxProposals} guide{maxProposals === 1 ? '' : 's'} apply
            </span>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* TRIP DETAILS PANEL */}
            <TripDetailsPanel request={request} t={t} />

            {/* PRICING */}
            <div className="rounded-xl p-4 space-y-4" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <FieldLabel>{t('pricing')}</FieldLabel>

              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} pl-9 text-2xl font-semibold`}
                />
              </div>
              <InlineError show={attempted && !priceValid} message={t('invalid_price')} />

              <SegmentedToggle
                options={priceTypeOptions}
                value={priceType}
                onChange={setPriceType}
              />

              <SegmentedToggle
                options={pricePeriodOptions}
                value={pricePeriod}
                onChange={setPricePeriod}
              />

              <div className="rounded-lg bg-white/[0.04] p-3 text-xs text-white/50 space-y-1">
                <p>
                  Estimated booking total: <span className="font-semibold text-white">${estimate.totalEstimate.toFixed(2)}</span>
                  {' '}(${estimate.quotedUnitPrice.toFixed(2)} × {estimate.peopleMultiplier} traveler multiplier × {estimate.durationMultiplier} duration multiplier)
                </p>
                <p>
                  Estimated commission ({pctDisplay}%): ${estimate.commissionEstimate.toFixed(2)}
                </p>
                <p>
                  Estimated payout: <span className="font-semibold text-[hsl(178,85%,55%)]">${estimate.payoutEstimate.toFixed(2)}</span>
                </p>
                <p className="pt-1 text-[10px] text-white/35">
                  Estimate only. The server calculates and snapshots the authoritative booking total.
                </p>
              </div>
            </div>

            {/* ITINERARY */}
            <div>
              <FieldLabel>{t('day_by_day_itinerary')}</FieldLabel>
              <textarea
                rows={6}
                value={itinerary}
                onChange={e => setItinerary(e.target.value)}
                placeholder={`Day 1: Arrival in Tehran. Pick-up from IKA airport...\nDay 2: Morning visit to Golestan Palace...`}
                className={inputCls}
              />
              <InlineError show={attempted && !itineraryValid} message={t('itinerary_required')} />
            </div>

            {/* INCLUDED / EXCLUDED */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>{t('whats_included')}</FieldLabel>
                <textarea
                  rows={5}
                  value={includedText}
                  onChange={e => setIncludedText(e.target.value)}
                  placeholder={`English-speaking guide\nHotel pickup\nEntrance tickets`}
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>{t('whats_not_included')}</FieldLabel>
                <textarea
                  rows={5}
                  value={excludedText}
                  onChange={e => setExcludedText(e.target.value)}
                  placeholder={`International flights\nMeals not specified\nPersonal expenses`}
                  className={inputCls}
                />
              </div>
            </div>

            {/* ── Transportation ── */}
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Transportation
              </p>

              {/* Toggle: included or not */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setHasTransportation(true); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    hasTransportation
                      ? 'bg-[hsl(178,85%,32%)]/20 border-[hsl(178,85%,45%)] text-[hsl(178,85%,70%)]'
                      : 'bg-white/[0.04] border-white/15 text-white/50 hover:border-white/30'
                  }`}
                >
                  ✓ Included
                </button>
                <button
                  type="button"
                  onClick={() => { setHasTransportation(false); setTransportationItems([]); setCustomTransport(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    !hasTransportation
                      ? 'bg-red-500/10 border-red-400/40 text-red-300'
                      : 'bg-white/[0.04] border-white/15 text-white/50 hover:border-white/30'
                  }`}
                >
                  ✕ Not included
                </button>
              </div>

              {/* Vehicle type chips — only visible when hasTransportation is true */}
              {hasTransportation && (
                <div>
                  <p className="text-[11px] text-white/35 mb-2">Select vehicle type(s):</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {TRANSPORT_OPTIONS.map(opt => {
                      const active = transportationItems.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleTransport(opt)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                            active
                              ? 'bg-[hsl(178,85%,32%)]/25 border-[hsl(178,85%,45%)] text-white'
                              : 'bg-white/[0.04] border-white/15 text-white/50 hover:border-white/30 hover:text-white/80'
                          }`}
                        >
                          {active ? '✓ ' : ''}{opt}
                        </button>
                      );
                    })}
                    {/* Custom entries added by the guide */}
                    {transportationItems
                      .filter(v => !TRANSPORT_OPTIONS.includes(v))
                      .map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleTransport(v)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium border bg-[hsl(178,85%,32%)]/25 border-[hsl(178,85%,45%)] text-white"
                        >
                          {v} ✕
                        </button>
                      ))}
                  </div>

                  {/* Custom transport input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTransport}
                      onChange={e => setCustomTransport(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTransport(); } }}
                      placeholder="Add other transport..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,45%)] transition"
                    />
                    <button
                      type="button"
                      onClick={addCustomTransport}
                      className="px-4 py-2 rounded-xl border border-white/20 text-white/60 text-sm hover:border-[hsl(178,85%,45%)] hover:text-white transition whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* MESSAGE */}
            <div>
              <FieldLabel>{t('personal_message')}</FieldLabel>
              <textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Hi! I'd love to guide you through Iran..."
                className={inputCls}
              />
              <InlineError show={attempted && !messageValid} message={t('message_required')} />
              <div className="flex items-start gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400/80">{t('do_not_share_contact')}</p>
              </div>
            </div>

            {/* IMAGES */}
            <div>
              <FieldLabel optional>{t('image_urls_optional')}</FieldLabel>
              <p className="text-[11px] text-white/30 mb-2">Paste one image URL per line</p>
              <textarea
                rows={3}
                value={imagesText}
                onChange={e => setImagesText(e.target.value)}
                placeholder="https://example.com/photo1.jpg"
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className="shrink-0 px-6 py-4 flex items-center gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || (attempted && !isValid)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(178,85%,32%), hsl(178,85%,28%))' }}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              ) : (
                t('apply')
              )}
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
