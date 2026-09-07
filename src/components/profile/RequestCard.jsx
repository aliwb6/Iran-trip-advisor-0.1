import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Users, Baby, ArrowRight, ArrowLeft,
  Car, Hotel, Sparkles, Clock, ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import ProposalsPanel from './ProposalsPanel';

const STATUS_STYLES = {
  waiting:   'bg-amber-500/15 text-amber-500 border-amber-400/30',
  received:  'bg-accent/15 text-accent border-accent/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30',
  booked:    'bg-emerald-500/15 text-emerald-400 border-emerald-400/30',
  cancelled: 'bg-red-500/15 text-red-500 border-red-400/30',
  expired:   'bg-muted/40 text-muted-foreground border-border/40',
};

const STATUS_LABELS = {
  en: {
    waiting:   'Waiting For Proposals',
    received:  'Proposals Received',
    completed: 'Completed',
    confirmed: 'Guide Selected',
    booked:    'Booked',
    cancelled: 'Cancelled',
    expired:   'Expired',
  },
  fa: {
    waiting:   'در انتظار پیشنهاد',
    received:  'پیشنهاد دریافت شد',
    completed: 'انجام شده',
    confirmed: 'راهنما انتخاب شد',
    booked:    'رزرو شد',
    cancelled: 'لغو شد',
    expired:   'منقضی',
  },
  ar: {
    waiting:   'بانتظار العروض',
    received:  'تم استلام العروض',
    completed: 'مكتمل',
    confirmed: 'تم اختيار المرشد',
    booked:    'محجوز',
    cancelled: 'ملغى',
    expired:   'منتهي',
  },
};

function PrefCell({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-background/50 border border-border/30">
      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function RequestCard({ request, onOpen, slotCount = 0 }) {
  const { t, lang, dir } = useI18n();
  const [proposalsOpen, setProposalsOpen] = useState(false);

  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const status      = request.status || 'waiting';
  const statusLabel = (STATUS_LABELS[lang] || STATUS_LABELS.en)[status] || status;

  const cities = Array.isArray(request.destination)
    ? request.destination
    : request.destination ? [request.destination] : [];

  const labels = {
    transportation: lang === 'fa' ? 'حمل‌ونقل' : lang === 'ar' ? 'المواصلات' : 'Transportation',
    accommodation:  lang === 'fa' ? 'اقامت'    : lang === 'ar' ? 'الإقامة'   : 'Accommodation',
    tourType:       lang === 'fa' ? 'نوع تور'  : lang === 'ar' ? 'نوع الجولة' : 'Tour Type',
    requirements:   lang === 'fa' ? 'یادداشت‌ها' : lang === 'ar' ? 'الملاحظات' : 'Requirements',
    adults:         lang === 'fa' ? 'بزرگسال'  : lang === 'ar' ? 'بالغ'      : 'Adults',
    children:       lang === 'fa' ? 'کودک'     : lang === 'ar' ? 'طفل'       : 'Children',
    seeDetails:     lang === 'fa' ? 'مشاهده جزئیات' : lang === 'ar' ? 'عرض التفاصيل' : 'See Details',
  };

  const guidesAcceptedLabel = t('card_guides_accepted')
    .replace('{n}', slotCount)
    .replace('{max}', request.maxProposals);
  const proposalsBtnLabel   = proposalsOpen ? t('card_hide_proposals') : t('card_view_proposals');

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group bg-card/60 backdrop-blur-md border border-border/40 rounded-3xl p-5 sm:p-6 hover:border-amber-400/40 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all duration-500"
    >
      {/* Title */}
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-heading text-xl sm:text-2xl font-semibold text-foreground leading-tight">
            {request.title}
          </h3>
          {cities.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              {cities.map(city => (
                <span
                  key={city}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20"
                >
                  {city}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {request.adults != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/60 border border-border/40 text-xs text-foreground">
              <Users className="w-3 h-3 text-accent" />
              {request.adults} {labels.adults}
            </span>
          )}
          {request.children != null && request.children > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/60 border border-border/40 text-xs text-foreground">
              <Baby className="w-3 h-3 text-accent" />
              {request.children} {labels.children}
            </span>
          )}
        </div>
      </header>

      {/* Timeline */}
      {(request.startDate || request.endDate) && (
        <div className="my-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-end">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {lang === 'fa' ? 'شروع' : lang === 'ar' ? 'البداية' : 'Start'}
              </p>
              <p className="text-sm font-semibold text-foreground" dir="ltr">{request.startDate || '—'}</p>
              {request.startTime && <p className="text-[10px] text-muted-foreground" dir="ltr">{request.startTime}</p>}
            </div>
            <div className="relative flex-1 h-1.5 rounded-full bg-background overflow-hidden">
              <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-amber-400 via-accent to-amber-400 rounded-full" />
              <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 bg-background rounded-full p-0.5 border border-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {lang === 'fa' ? 'پایان' : lang === 'ar' ? 'النهاية' : 'End'}
              </p>
              <p className="text-sm font-semibold text-foreground" dir="ltr">{request.endDate || '—'}</p>
              {request.endTime && <p className="text-[10px] text-muted-foreground" dir="ltr">{request.endTime}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Preferences grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        <PrefCell icon={Car}      label={labels.transportation} value={request.transportation} />
        <PrefCell icon={Hotel}    label={labels.accommodation}  value={request.accommodation} />
        <PrefCell icon={Sparkles} label={labels.tourType}       value={request.tourType} />
      </div>

      {/* Requirements preview */}
      {request.requirements && (
        <div className="p-3.5 rounded-xl bg-background/40 border border-border/30 mb-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">
            {labels.requirements}
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{request.requirements}</p>
        </div>
      )}

      {/* Footer: status pill + guides-accepted pill + actions */}
      <footer className="flex items-center justify-between gap-3 pt-4 border-t border-border/30 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status pill */}
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] || STATUS_STYLES.waiting}`}>
            {statusLabel}
          </span>

          {/* Level 1 — guides-accepted counter pill */}
          <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-teal-500/10 text-teal-600 border-teal-400/30 dark:text-teal-400">
            {guidesAcceptedLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Proposals toggle — Level 2 */}
          <button
            onClick={() => setProposalsOpen(prev => !prev)}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            {proposalsBtnLabel}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-300 ${proposalsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Existing See Details */}
          <button
            onClick={() => onOpen?.(request)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition group/btn"
          >
            {labels.seeDetails}
            <Arrow className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </footer>

      {/* Level 2 — inline proposals panel (animated) */}
      <AnimatePresence initial={false}>
        {proposalsOpen && (
          <motion.div
            key="proposals-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-4">
              <ProposalsPanel
                requestId={request.id}
                proposalRound={request.proposalRound}
                requestStatus={request.canonicalStatus}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
