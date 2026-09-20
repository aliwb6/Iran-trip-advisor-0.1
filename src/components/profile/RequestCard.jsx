import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Users, Baby, ArrowRight, ArrowLeft,
  Car, Hotel, Sparkles, Clock, ChevronDown, Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const [proposalsOpen, setProposalsOpen] = useState(() => slotCount > 0);

  useEffect(() => {
    if (slotCount > 0) setProposalsOpen(true);
  }, [slotCount]);

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
  const proposalsBtnLabel = proposalsOpen ? t('card_hide_proposals') : t('card_view_proposals');
  const dispatchedProviders = request.dispatchedProviders || [];
  const dispatchedLabel = lang === 'fa'
    ? 'درخواست برای این راهنماها/آژانس‌ها ارسال شده'
    : lang === 'ar'
      ? 'أُرسل الطلب إلى هؤلاء المرشدين/الوكالات'
      : 'Request sent to these guides & agencies';

  const requestDetails = (
    <>
      {/* Title */}
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
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

        <div className="flex flex-wrap gap-2 justify-end shrink-0">
          {request.adults != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/60 border border-border/40 text-xs text-foreground">
              <Users className="w-3 h-3 text-accent" />
              {request.adults} {labels.adults}
            </span>
          )}
          {(request.male_adults != null || request.female_adults != null) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/60 border border-border/40 text-xs text-foreground">
              <Users className="w-3 h-3 text-accent" /> {request.male_adults || 0} {lang === 'fa' ? 'آقا' : 'men'} · {request.female_adults || 0} {lang === 'fa' ? 'خانم' : 'women'}
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
      <div className="grid grid-cols-1 gap-2.5 mb-4">
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
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{request.requirements}</p>
        </div>
      )}

      {/* Only live invitations are passed here. Once a guide or agency sends a
          proposal their dispatch becomes responded, so this compact profile
          strip automatically disappears for that provider. */}
      {dispatchedProviders.length > 0 && (
        <section className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3.5" aria-label={dispatchedLabel}>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/15">
              <Send className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold">{dispatchedLabel}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {dispatchedProviders.map(provider => {
              const name = provider.full_name || (lang === 'fa' ? 'راهنمای محلی' : 'Local guide');
              const initials = name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
              const href = provider.role === 'agency' ? `/agencies/${provider.provider_id}` : `/guides/${provider.provider_id}`;
              return (
                <Link
                  key={provider.provider_id}
                  to={href}
                  className="group/provider inline-flex max-w-full items-center gap-2 rounded-full border border-border/50 bg-background/80 py-1.5 pl-1.5 pr-3 text-xs font-medium text-foreground transition hover:border-accent/50 hover:bg-accent/5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                    {provider.avatar_url ? <img src={provider.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
                  </span>
                  <span className="truncate group-hover/provider:text-accent">{name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer: status pill + guides-accepted pill + actions */}
      <footer className="flex items-center justify-between gap-3 pt-4 border-t border-border/30 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] || STATUS_STYLES.waiting}`}>
            {statusLabel}
          </span>

          <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-teal-500/10 text-teal-600 border-teal-400/30 dark:text-teal-400">
            {guidesAcceptedLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {slotCount > 0 && (
            <button
              onClick={() => setProposalsOpen(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition"
              aria-expanded={proposalsOpen}
            >
              {proposalsBtnLabel}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${proposalsOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}

          <button
            onClick={() => onOpen?.(request)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition group/btn"
          >
            {labels.seeDetails}
            <Arrow className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </footer>
    </>
  );

  const hasVisibleProposals = slotCount > 0 && proposalsOpen;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`group bg-card/60 backdrop-blur-md border border-border/40 rounded-3xl hover:border-amber-400/40 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all duration-500 ${
        hasVisibleProposals ? 'overflow-hidden p-0' : 'p-5 sm:p-6'
      }`}
    >
      {hasVisibleProposals ? (
        <div
          dir="ltr"
          className="lg:grid lg:grid-cols-[minmax(300px,38fr)_minmax(0,62fr)] lg:h-[min(72vh,760px)] lg:min-h-[560px]"
        >
          <section
            dir={dir}
            aria-label={lang === 'fa' ? 'جزئیات درخواست سفر' : lang === 'ar' ? 'تفاصيل طلب الرحلة' : 'Your request details'}
            className="p-5 sm:p-6 min-w-0 lg:overflow-y-auto lg:overscroll-contain lg:scrollbar-gutter-stable lg:border-r lg:border-border/30"
          >
            {requestDetails}
          </section>

          <section
            dir={dir}
            aria-label={lang === 'fa' ? 'پیشنهادهای راهنماها و آژانس‌ها' : lang === 'ar' ? 'عروض المرشدين والوكالات' : 'Guide and agency proposals'}
            className="min-w-0 border-t border-border/30 p-5 sm:p-6 lg:border-t-0 lg:overflow-y-auto lg:overscroll-contain lg:scrollbar-gutter-stable [&>div]:border-t-0 [&>div]:pt-0"
          >
            <ProposalsPanel
              requestId={request.id}
              proposalRound={request.proposalRound}
              requestStatus={request.canonicalStatus}
            />
          </section>
        </div>
      ) : (
        requestDetails
      )}
    </motion.article>
  );
}
