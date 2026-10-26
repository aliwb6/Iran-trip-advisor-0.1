import IconSwap from '@/components/ui/IconSwap';
import {
  useState,
  useEffect,
  useCallback } from 'react';
import { motion,
  AnimatePresence } from 'framer-motion';
import {
  Bell,
  Calendar,
  Users,
  Globe,
  FileText,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
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
import { localize, localizeBookingStatus, localizeTripOption } from '@/lib/localize';
import { iranianDestinations } from '@/data/iranianCities';

function fmt(dateStr, lang = 'en') {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const cityList = (d) => (Array.isArray(d) ? d : d ? [d] : []);
const cityLabels = Object.fromEntries(iranianDestinations.map(city => [city.en, city]));
const cityName = (city, lang) => cityLabels[city]?.[lang] || city;

const SLOT_STATUS_LABEL = {
  accepted:  { text: 'Waiting for tourist',       color: 'text-yellow-700',  bg: 'bg-yellow-400/10' },
  selected:  { text: 'You were chosen! 🎉',       color: 'text-emerald-700', bg: 'bg-emerald-400/10' },
  rejected:  { text: 'Rejected by traveler',      color: 'text-red-700',     bg: 'bg-red-500/10' },
  chatting:  { text: 'In discussion',             color: 'text-blue-700',    bg: 'bg-blue-400/10' },
  finalized: { text: 'Booked',                    color: 'text-emerald-700', bg: 'bg-emerald-400/10' },
  closed:    { text: 'Closed',                    color: 'text-muted-foreground',    bg: 'bg-card' },
};

const FILLED_SLOT_INFO = {
  text: 'Expired',
  color: 'text-muted-foreground',
  bg: 'bg-muted',
};

function Tag({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium">
      {children}
    </span>
  );
}

function ProposalCountPill({ count, max }) {
  const { lang } = useI18n();
  const full = count >= max;
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
      full ? 'bg-red-500/10 text-red-700' : 'bg-muted text-foreground/80'
    }`}>
      {count}/{max} {localize(lang, 'proposals', 'پیشنهاد', 'عروض')}
    </span>
  );
}

function LoadingState() {
  const { lang } = useI18n();
  return (
    <div className="flex min-h-[18rem] items-center justify-center">
      <Loader2 className="w-12 h-12" label={localize(lang, 'Loading requests', 'در حال بارگذاری درخواست‌ها', 'جارٍ تحميل الطلبات')} />
    </div>
  );
}

function AvailableCard({ req, guideId, commissionRate, onApplied, onSkip }) {
  const { t, lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const [modalOpen, setModalOpen] = useState(false);
  const [declining, setDeclining] = useState(false);

  const maxProposals = req.max_proposals || 5;
  const isFull = req.accepted_count >= maxProposals;
  const isExpiredForProvider = req.provider_request_state === 'expired';
  const mySlot = req.my_slot;
  const hasApplied = Boolean(mySlot);
  const slotInfo = mySlot ? (SLOT_STATUS_LABEL[mySlot.status] || SLOT_STATUS_LABEL.accepted) : null;
  const start = fmt(req.start_date, lang);
  const end = fmt(req.end_date, lang);
  const packageRequestKind = getPackageRequestKind(req);
  const sourceTour = req.source_tour;
  const sourceTourTitle = sourceTour?.title?.en || sourceTour?.title?.fa || sourceTour?.title || '';

  const handleProposalSuccess = () => {
    setModalOpen(false);
    onApplied();
  };

  const handleDecline = async () => {
    if (!window.confirm(l('Decline this private package request? The traveler will be notified.', 'این درخواست تور خصوصی را رد می‌کنید؟ به مسافر اطلاع داده می‌شود.', 'هل تريد رفض طلب الجولة الخاصة هذا؟ سيُبلَّغ المسافر.'))) return;
    setDeclining(true);
    try {
      await declinePackageTripRequest(req.id);
      toast.success(l('Request declined. The traveler has been notified.', 'درخواست رد شد و به مسافر اطلاع داده شد.', 'رُفض الطلب وأُبلغ المسافر.'));
      onApplied();
    } catch (err) {
      toast.error(l('Could not decline this request.', 'رد کردن درخواست ممکن نشد.', 'تعذّر رفض الطلب.'));
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
            ? 'bg-card border-border grayscale opacity-70'
            : 'bg-card border-border hover:border-accent/30'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {packageRequestKind && (
              <span className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                packageRequestKind === 'package_booking'
                  ? 'border-amber-300/25 bg-amber-300/10 text-amber-700'
                  : 'border-teal-300/25 bg-teal-300/10 text-teal-700'
              }`}>
                {packageRequestKind === 'package_booking' ? l('Booking Request', 'درخواست رزرو', 'طلب حجز') : l('Private Tour Invitation', 'دعوت به تور خصوصی', 'دعوة لجولة خاصة')}
              </span>
            )}
            <h3 className="text-foreground font-semibold text-sm leading-snug">
              {packageRequestKind === 'package_booking' && sourceTourTitle
                ? sourceTourTitle
                : l(`Trip to ${cityList(req.destination).join(', ') || 'Iran'}`, `سفر به ${cityList(req.destination).map(city => cityName(city, lang)).join('، ') || 'ایران'}`, `رحلة إلى ${cityList(req.destination).map(city => cityName(city, lang)).join('، ') || 'إيران'}`)}
            </h3>
            <p className="text-muted-foreground text-[11px] mt-0.5">{l(`Submitted ${fmt(req.created_at)}`, `ثبت‌شده در ${fmt(req.created_at, lang)}`, `قُدّم في ${fmt(req.created_at, lang)}`)}</p>
          </div>
          {isExpiredForProvider ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
              <Clock className="w-3 h-3" />
              {l('Expired', 'منقضی‌شده', 'منتهٍ')}
            </span>
          ) : (
            <ProposalCountPill count={req.accepted_count} max={maxProposals} />
          )}
        </div>

        {packageRequestKind && sourceTour && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            {(sourceTour.image_url || sourceTour.gallery?.[0]) && (
              <img
                src={sourceTour.image_url || sourceTour.gallery[0]}
                alt=""
                className="h-12 w-16 rounded-lg object-cover"
              />
            )}
            <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
              {packageRequestKind === 'package_booking'
                ? l('A traveler requested this exact package. Review the pre-filled offer before sending.', 'مسافر همین بستهٔ سفر را درخواست کرده است. پیشنهاد آماده‌شده را پیش از ارسال بررسی کنید.', 'طلب المسافر هذه الباقة بعينها. راجع العرض المُعدّ مسبقاً قبل إرساله.')
                : l('The traveler selected you for a tour based on this reference package. You do not own the original tour.', 'مسافر بر اساس این بستهٔ نمونه شما را برای اجرای تور انتخاب کرده است. تور اصلی متعلق به شما نیست.', 'اختارك المسافر لتنظيم جولة استناداً إلى هذه الباقة المرجعية. الجولة الأصلية ليست ملكاً لك.')}
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
              {l(`${(req.adults || req.adult_count || 1)} adult${((req.adults || req.adult_count) > 1) ? 's' : ''}`, `${req.adults || req.adult_count || 1} بزرگسال`, `${req.adults || req.adult_count || 1} بالغ`)}
              {(req.children || req.child_count) > 0 ? l(`, ${req.children || req.child_count} child`, `، ${req.children || req.child_count} کودک`, `، ${req.children || req.child_count} طفل`) : ''}
            </Tag>
          )}
          {((req.male_adults != null) || (req.female_adults != null)) && (
            <Tag><Users className="w-3 h-3 mr-1 inline-block" />{l(`${req.male_adults || 0} men · ${req.female_adults || 0} women`, `${req.male_adults || 0} مرد · ${req.female_adults || 0} زن`, `${req.male_adults || 0} رجال · ${req.female_adults || 0} نساء`)}</Tag>
          )}
          {req.guide_languages?.length > 0 && (
            <Tag><Globe className="w-3 h-3 mr-1 inline-block" />{req.guide_languages.join(', ')}</Tag>
          )}
          {req.tour_type && <Tag>{localizeTripOption(req.tour_type, lang)}</Tag>}
        </div>

        {req.requirements && (
          <p className="text-muted-foreground text-xs leading-relaxed mb-4 line-clamp-2">
            <FileText className="w-3 h-3 inline-block mr-1 text-muted-foreground" />
            {req.requirements}
          </p>
        )}

        {isExpiredForProvider ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{l('This request has expired for you.', 'مهلت پاسخ به این درخواست برای شما به پایان رسیده است.', 'انتهت مهلة الردّ على هذا الطلب بالنسبة إليك.')}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                {l('The traveler selected another guide or agency, so this tour request is no longer available.', 'مسافر راهنما یا آژانس دیگری را انتخاب کرده است و این درخواست دیگر در دسترس نیست.', 'اختار المسافر مرشداً أو وكالة أخرى، ولم يعد هذا الطلب متاحاً.')}
              </p>
            </div>
          </div>
        ) : hasApplied ? (
          <div className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium ${slotInfo.bg} ${slotInfo.color}`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {t('proposal_submitted')} ({l(slotInfo.text, ({ accepted: 'در انتظار مسافر', selected: 'شما انتخاب شدید! 🎉', rejected: 'ردشده توسط مسافر', chatting: 'در حال گفت‌وگو', finalized: 'رزروشده', closed: 'بسته‌شده' })[mySlot.status] || localizeBookingStatus(mySlot.status, lang), ({ accepted: 'بانتظار المسافر', selected: 'لقد اختارك المسافر! 🎉', rejected: 'رفضه المسافر', chatting: 'قيد النقاش', finalized: 'محجوز', closed: 'مغلق' })[mySlot.status] || localizeBookingStatus(mySlot.status, lang))})
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setModalOpen(true)}
              disabled={isFull}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isFull
                  ? 'bg-card text-muted-foreground cursor-not-allowed'
                  : 'bg-[hsl(178,85%,32%)] hover:bg-[hsl(178,85%,28%)] text-white shadow-lg shadow-[hsl(178,85%,32%)]/20'
              }`}
            >
              {isFull ? (
                <><AlertCircle className="w-4 h-4" /> {l('Request closed', 'درخواست بسته شد', 'أُغلق الطلب')} ({req.accepted_count}/{maxProposals})</>
              ) : (
                <><FileText className="w-4 h-4" /> {packageRequestKind === 'package_booking' ? l('Confirm & Send Offer', 'تأیید و ارسال پیشنهاد', 'تأكيد العرض وإرساله') : packageRequestKind ? l('Create Proposal', 'ثبت پیشنهاد', 'إنشاء عرض') : l('See Details', 'مشاهدهٔ جزئیات', 'عرض التفاصيل')}</>
              )}
            </button>
            {!isFull && (
              packageRequestKind ? (
                <button
                  onClick={handleDecline}
                  disabled={declining}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700/70 hover:bg-red-500/10 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  {declining ? l('Declining…', 'در حال رد کردن…', 'جارٍ الرفض…') : l('Decline', 'رد کردن', 'رفض')}
                </button>
              ) : (
                <button
                  onClick={() => onSkip(req.id)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
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
  const { t, lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
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
    : (SLOT_STATUS_LABEL[entry.status] || { text: entry.status, color: 'text-muted-foreground', bg: 'bg-card' });
  const start = fmt(req?.start_date, lang);
  const end = fmt(req?.end_date, lang);
  const dest = cityList(req?.destination).map(city => cityName(city, lang)).join(lang === 'en' ? ', ' : '، ') || l('Iran', 'ایران', 'إيران');
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
      toast.success(l('Booking confirmed. The traveler has been notified.', 'رزرو تأیید شد و به مسافر اطلاع داده شد.', 'تأكّد الحجز وأُبلغ المسافر.'));
      await onChanged();
    } catch (err) {
      toast.error(l('Could not confirm this booking.', 'تأیید رزرو ممکن نشد.', 'تعذّر تأكيد الحجز.'));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={`border rounded-2xl p-5 transition-all ${
      entry.status === 'rejected'
        ? 'bg-card border-border grayscale opacity-75'
        : 'bg-card border-border'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground font-semibold text-sm">{l(`Trip to ${dest}`, `سفر به ${dest}`, `رحلة إلى ${dest}`)}</h3>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            {t('submitted_on').replace('{date}', fmt(entry.accepted_at, lang) || '—')}
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${slotInfo.bg} ${slotInfo.color}`}>
          {filledByAnother ? l('Expired', 'منقضی‌شده', 'منتهٍ') : ({ accepted: l('Waiting for tourist', 'در انتظار مسافر', 'بانتظار المسافر'), selected: l('You were chosen! 🎉', 'شما انتخاب شدید! 🎉', 'لقد اختارك المسافر! 🎉'), rejected: l('Rejected by traveler', 'ردشده توسط مسافر', 'رفضه المسافر'), chatting: l('In discussion', 'در حال گفت‌وگو', 'قيد النقاش'), finalized: l('Booked', 'رزروشده', 'محجوز'), closed: l('Closed', 'بسته‌شده', 'مغلق') })[entry.status] || localizeBookingStatus(entry.status, lang)}
        </span>
      </div>

      {filledByAnother && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-3.5 py-3 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {l('Expired — the traveler selected another guide or agency. You can no longer act on this request.', 'این درخواست منقضی شده است؛ مسافر راهنما یا آژانس دیگری را انتخاب کرده و دیگر نمی‌توانید برای آن اقدام کنید.', 'انتهت صلاحية هذا الطلب؛ اختار المسافر مرشداً أو وكالة أخرى، ولم يعد بإمكانك اتخاذ إجراء بشأنه.')}
          </p>
        </div>
      )}

      {explicitlyRejected && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-3.5 py-3 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700/80" />
          <p className="text-xs leading-relaxed text-red-700/70">
            {l('The traveler rejected your proposal. This proposal is kept here for your records.', 'مسافر پیشنهاد شما را رد کرد. این پیشنهاد برای سوابق شما در اینجا باقی می‌ماند.', 'رفض المسافر عرضك. سيبقى العرض هنا للرجوع إليه.')}
          </p>
        </div>
      )}

      {priceLabel && <p className="text-accent font-semibold text-sm mb-2">{priceLabel}</p>}

      {firstLineItinerary && (
        <p className="text-muted-foreground text-xs mb-2 line-clamp-1">
          <FileText className="w-3 h-3 inline-block mr-1 text-muted-foreground" />
          {firstLineItinerary}
        </p>
      )}

      {(start || end) && (
        <p className="text-muted-foreground text-xs flex items-center gap-1 mb-3">
          <Calendar className="w-3 h-3" />
          {start}{start && end ? ' → ' : ''}{end}
        </p>
      )}

      {canConfirmBooking && (
        <button
          onClick={handleConfirmBooking}
          disabled={confirming}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-700 hover:bg-emerald-500/20 text-sm font-semibold transition disabled:opacity-50"
        >
          {<IconSwap active={confirming} a={<CheckCircle2 className="w-4 h-4" />} b={<Loader2 className="w-4 h-4 animate-spin" />} keepMounted={false} />}
          {confirming ? l('Confirming…', 'در حال تأیید…', 'جارٍ التأكيد…') : l('Confirm booking', 'تأیید رزرو', 'تأكيد الحجز')}
        </button>
      )}
    </div>
  );
}

export default function GuideRequestsView({ userId }) {
  const { t, dir, lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);

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
      setError(l('Failed to load requests.', 'بارگذاری درخواست‌ها ممکن نشد.', 'تعذّر تحميل الطلبات.'));
    } finally {
      setLoading(false);
    }
  }, [userId, lang]);

  useEffect(() => { load(); }, [load]);

  const handleSkip = (id) => setSkipped(prev => new Set([...prev, id]));
  const visibleAvailable = available.filter(r => !skipped.has(r.id));

  const tabItems = [
    { id: 'available', label: l('Available', 'در دسترس', 'متاحة'), count: visibleAvailable.length },
    { id: 'proposals', label: t('my_proposals'), count: proposals.length },
  ];

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-foreground font-bold text-xl">{l('Tour Requests', 'درخواست‌های سفر', 'طلبات الرحلات')}</h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {l('Submit proposals to open requests and confirm bookings when a traveler selects you.', 'برای درخواست‌های باز پیشنهاد بفرستید و وقتی مسافر شما را انتخاب کرد، رزرو را تأیید کنید.', 'قدّم عروضاً للطلبات المتاحة، وأكّد الحجز عندما يختارك المسافر.')}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 text-xs transition disabled:opacity-40"
        >
          {<IconSwap active={loading} a={<RefreshCw className="w-3 h-3" />} b={<Loader2 className="w-3 h-3" label={l('Refreshing requests', 'در حال تازه‌سازی درخواست‌ها', 'جارٍ تحديث الطلبات')} />} keepMounted={false} />}
          {l('Refresh', 'تازه‌سازی', 'تحديث')}
        </button>
      </div>

      <div className="flex bg-card rounded-xl p-1 mb-6 w-fit gap-1">
        {tabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === item.id ? 'bg-[hsl(178,85%,32%)] text-white shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
            {item.count > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                tab === item.id ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-sm">{error}</div>
      ) : loading ? (
        <LoadingState />
      ) : tab === 'available' ? (
        visibleAvailable.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium text-sm mb-1">{l('No open trip requests', 'درخواست سفر بازی وجود ندارد', 'لا توجد طلبات رحلات متاحة')}</p>
            <p className="text-muted-foreground text-xs max-w-xs">{l('New requests from travelers will appear here. Check back soon!', 'درخواست‌های جدید مسافران اینجا نمایش داده می‌شوند. بعداً دوباره سر بزنید.', 'ستظهر هنا طلبات المسافرين الجديدة. عُد لاحقاً للاطلاع عليها.')}</p>
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
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium text-sm mb-1">{l('No proposals yet', 'هنوز پیشنهادی ثبت نکرده‌اید', 'لم تقدّم أي عروض بعد')}</p>
          <p className="text-muted-foreground text-xs max-w-xs">{l('Requests you apply to will show here with their status.', 'درخواست‌هایی که برایشان پیشنهاد می‌فرستید همراه با وضعیتشان اینجا نمایش داده می‌شوند.', 'ستظهر هنا الطلبات التي تقدّم لها عروضاً مع حالتها.')}</p>
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
