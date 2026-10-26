import {
  useEffect,
  useMemo,
  useState } from 'react';
import { Link,
  useNavigate,
  useParams,
  useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  PackageOpen,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import SubmitProposalModal from '@/components/dashboard/SubmitProposalModal';
import { getPackageRequestKind } from '@/lib/packageTripRequest';
import { localize, localizeBookingStatus } from '@/lib/localize';
import { iranianDestinations } from '@/data/iranianCities';
import { toLanguageOptions } from '@/data/languages';

const OPEN_STATUSES = new Set(['open', 'active', 'pending']);

const cityLabels = Object.fromEntries(iranianDestinations.map(city => [city.en, city]));
const localeFor = lang => lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ar' ? 'ar-u-ca-gregory' : 'en-GB';

function formatDate(value, lang) {
  if (!value) return localize(lang, 'Not specified', 'مشخص نشده', 'غير محدّد');
  return new Date(value).toLocaleDateString(localeFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDeadline(value, lang) {
  if (!value) return null;
  return new Date(value).toLocaleString(localeFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Detail({ icon: Icon, label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        <Icon className="h-3.5 w-3.5 text-teal-400" />
        {label}
      </div>
      <div className="text-sm leading-relaxed text-white/85">{children}</div>
    </div>
  );
}

export default function GuideRequestEmailPage() {
  const { requestId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, isLoadingAuth } = useAuth();
  const { dir, lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);

  const [request, setRequest] = useState(null);
  const [mySlot, setMySlot] = useState(null);
  const [commissionRate, setCommissionRate] = useState(0.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proposalOpen, setProposalOpen] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/login', {
        replace: true,
        state: { from: `/dashboard/requests/${requestId}?action=proposal` },
      });
    }
  }, [isAuthenticated, isLoadingAuth, navigate, requestId]);

  useEffect(() => {
    if (!requestId || !user?.id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const { data: requestData, error: requestError } = await supabase
          .from('trip_requests')
          .select('*, source_tour:tours!source_tour_id(id, slug, title, description, itinerary, duration, price, cities, city, location, included, image_url, gallery, tour_type, status)')
          .eq('id', requestId)
          .single();

        if (requestError || !requestData) {
          throw new Error(l('This trip request is no longer available or you do not have access to it.', 'این درخواست سفر دیگر در دسترس نیست یا شما به آن دسترسی ندارید.', 'لم يعد طلب الرحلة هذا متاحاً أو ليس لديك إذن بالوصول إليه.'));
        }

        const round = Math.max(1, Number(requestData.proposal_round) || 1);
        const [{ data: slotData, error: slotError }, { data: profileData }] = await Promise.all([
          supabase
            .from('trip_slots')
            .select('id, status, price, currency, accepted_at, proposal_round')
            .eq('trip_request_id', requestId)
            .eq('guide_id', user.id)
            .eq('proposal_round', round)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('commission_rate')
            .eq('id', user.id)
            .maybeSingle(),
        ]);

        if (slotError) throw slotError;
        if (cancelled) return;

        setRequest(requestData);
        setMySlot(slotData || null);
        if (profileData?.commission_rate != null) {
          setCommissionRate(Number(profileData.commission_rate));
        }
      } catch (err) {
        if (!cancelled) setError(l('Could not load this trip request.', 'بارگذاری این درخواست سفر ممکن نشد.', 'تعذّر تحميل طلب الرحلة هذا.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [requestId, user?.id, lang]);

  const destination = useMemo(() => {
    if (!request?.destination) return l('Iran', 'ایران', 'إيران');
    const cities = Array.isArray(request.destination) ? request.destination : [request.destination];
    return cities.map(city => cityLabels[city]?.[lang] || city).join(lang === 'en' ? ', ' : '، ');
  }, [request?.destination, lang]);

  const expired = Boolean(request?.expires_at && new Date(request.expires_at).getTime() <= Date.now());
  const maxProposals = Math.max(1, Number(request?.max_proposals) || 5);
  const proposalCount = Math.max(0, Number(request?.proposals_count) || 0);
  const full = proposalCount >= maxProposals;
  const packageAdminAllowed = Boolean(
    request?.source_tour_id
      && request?.direct_provider_id === user?.id
      && (profile?.is_admin || profile?.role === 'admin')
  );
  const roleAllowed = ['guide', 'agency'].includes(profile?.role) || packageAdminAllowed;
  const canSubmit = Boolean(
    request
      && roleAllowed
      && !mySlot
      && !expired
      && !full
      && OPEN_STATUSES.has(request.status)
  );

  const exclusiveToMe = Boolean(
    request?.request_channel === 'direct_profile'
      && request?.direct_provider_id === user?.id
      && !request?.direct_escalated_at
      && request?.direct_response_deadline
      && new Date(request.direct_response_deadline).getTime() > Date.now()
  );
  const packageRequestKind = getPackageRequestKind(request);
  const sourceTourTitle = request?.source_tour?.title?.en
    || request?.source_tour?.title?.fa
    || request?.source_tour?.title;

  useEffect(() => {
    if (!loading && canSubmit && searchParams.get('action') === 'proposal') {
      setProposalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [canSubmit, loading, searchParams, setSearchParams]);

  const handleProposalSuccess = async () => {
    const round = Math.max(1, Number(request?.proposal_round) || 1);
    const { data } = await supabase
      .from('trip_slots')
      .select('id, status, price, currency, accepted_at, proposal_round')
      .eq('trip_request_id', requestId)
      .eq('guide_id', user.id)
      .eq('proposal_round', round)
      .maybeSingle();
    setMySlot(data || { status: 'accepted' });
  };

  if (isLoadingAuth || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(222,55%,8%)]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-[hsl(222,55%,8%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requests')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {l('Back to Requests', 'بازگشت به درخواست‌ها', 'العودة إلى الطلبات')}
          </button>
          <Link to="/" className="text-sm font-semibold text-teal-300 hover:text-teal-200">
            Iran Trip Advisor
          </Link>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/requests')}
              className="mt-5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              {l('Open Requests Dashboard', 'باز کردن بخش درخواست‌ها', 'فتح لوحة الطلبات')}
            </button>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[hsl(222,45%,14%)] shadow-2xl shadow-black/20">
              <div className="border-b border-white/[0.07] bg-gradient-to-r from-teal-500/15 to-amber-400/10 px-5 py-6 sm:px-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
                      {packageRequestKind === 'package_booking'
                        ? l('Booking Request', 'درخواست رزرو', 'طلب حجز')
                        : packageRequestKind === 'package_private'
                          ? l('Private Tour Invitation', 'دعوت به تور خصوصی', 'دعوة لجولة خاصة')
                          : l('Trip request', 'درخواست سفر', 'طلب رحلة')}
                    </p>
                    <h1 className="text-2xl font-bold text-white sm:text-3xl">
                      {packageRequestKind === 'package_booking' && sourceTourTitle ? sourceTourTitle : l(`Trip to ${destination}`, `سفر به ${destination}`, `رحلة إلى ${destination}`)}
                    </h1>
                    <p className="mt-2 text-sm text-white/45">
                      {l('Review the traveler’s request before sending your proposal.', 'پیش از ارسال پیشنهاد، درخواست مسافر را بررسی کنید.', 'راجع طلب المسافر قبل إرسال عرضك.')}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70">
                    {proposalCount}/{maxProposals} {l('proposals', 'پیشنهاد', 'عروض')}
                  </span>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-7">
                {exclusiveToMe && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                    <div>
                      <p className="text-sm font-semibold text-amber-100">{l('Exclusive direct request', 'درخواست مستقیم اختصاصی', 'طلب مباشر حصري')}</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                        {l(`This traveler selected you directly. Your exclusive response window ends at ${formatDeadline(request.direct_response_deadline, lang)}.`, `این مسافر مستقیماً شما را انتخاب کرده است. مهلت اختصاصی پاسخ‌گویی شما تا ${formatDeadline(request.direct_response_deadline, lang)} است.`, `اختارك هذا المسافر مباشرةً. تنتهي مهلة ردّك الحصرية في ${formatDeadline(request.direct_response_deadline, lang)}.`)}
                      </p>
                    </div>
                  </div>
                )}

                {request.source_tour && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/[0.07] p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <PackageOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/65">
                          {l('Based on a Tour Package', 'بر اساس یک بستهٔ سفر', 'استناداً إلى باقة سياحية')}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">
                          {typeof request.source_tour.title === 'object'
                            ? request.source_tour.title[lang] || request.source_tour.title.en || Object.values(request.source_tour.title)[0]
                            : request.source_tour.title}
                        </p>
                        {packageRequestKind === 'package_private' && (
                          <p className="mt-1 text-xs leading-relaxed text-teal-100/65">
                            {l('This package is a reference only. Your proposal can be fully customized.', 'این بسته فقط نمونه‌ای برای راهنمایی است. می‌توانید پیشنهادتان را کاملاً شخصی‌سازی کنید.', 'هذه الباقة مرجع فقط. يمكنك تخصيص عرضك بالكامل.')}
                          </p>
                        )}
                      </div>
                    </div>
                    {request.source_tour.slug && (
                      <Link
                        to={`/tours/${request.source_tour.slug}`}
                        className="shrink-0 rounded-xl border border-teal-200/20 px-3 py-2 text-xs font-semibold text-teal-200 transition hover:bg-teal-200/10"
                      >
                        {l('View original tour', 'مشاهدهٔ تور اصلی', 'عرض الجولة الأصلية')}
                      </Link>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Detail icon={MapPin} label={l('Destination', 'مقصد', 'الوجهة')}>{destination}</Detail>
                  <Detail icon={CalendarDays} label={l('Travel dates', 'تاریخ‌های سفر', 'تواريخ السفر')}>
                    {formatDate(request.start_date, lang)} → {formatDate(request.end_date, lang)}
                  </Detail>
                  <Detail icon={Users} label={l('Travelers', 'مسافران', 'المسافرون')}>
                    {l(`${Number(request.adults) || 0} adult${Number(request.adults) === 1 ? '' : 's'}`, `${Number(request.adults) || 0} بزرگسال`, `البالغون: ${Number(request.adults) || 0}`)}
                    {Number(request.children) > 0 ? l(`, ${request.children} child${Number(request.children) === 1 ? '' : 'ren'}`, `، ${request.children} کودک`, `، الأطفال: ${request.children}`) : ''}
                  </Detail>
                  <Detail icon={Globe} label={l('Guide languages', 'زبان‌های راهنما', 'لغات المرشد')}>
                    {request.guide_languages?.length ? toLanguageOptions(request.guide_languages).map(option => option[lang]).join(lang === 'en' ? ', ' : '، ') : l('Not specified', 'مشخص نشده', 'غير محدّد')}
                  </Detail>
                  {(request.arrival_time || request.departure_time || request.timings_flexible) && (
                    <Detail icon={Clock} label={l('Timing', 'زمان‌بندی', 'التوقيت')}>
                      {request.timings_flexible
                        ? l('Flexible timings', 'زمان‌بندی انعطاف‌پذیر', 'مواعيد مرنة')
                        : `${request.arrival_time || '—'} → ${request.departure_time || '—'}`}
                    </Detail>
                  )}
                </div>

                {request.requirements && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">{l('Traveler requirements', 'درخواست‌های مسافر', 'متطلبات المسافر')}</p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-white/75">{request.requirements}</p>
                  </div>
                )}

                {mySlot ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">{l('Proposal already submitted', 'پیشنهاد قبلاً ارسال شده است', 'أُرسل العرض مسبقاً')}</p>
                      <p className="mt-1 text-xs text-emerald-100/65">
                        {l(`Your proposal status is ${mySlot.status || 'accepted'}. You can follow its progress from your Requests dashboard.`, `وضعیت پیشنهاد شما «${localizeBookingStatus(mySlot.status || 'accepted', lang)}» است. می‌توانید روند آن را در بخش درخواست‌ها پیگیری کنید.`, `حالة عرضك «${localizeBookingStatus(mySlot.status || 'accepted', lang)}». يمكنك متابعة تقدّمه من لوحة الطلبات.`)}
                      </p>
                    </div>
                  </div>
                ) : canSubmit ? (
                  <button
                    type="button"
                    onClick={() => setProposalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[hsl(178,85%,32%)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-950/30 transition hover:bg-[hsl(178,85%,28%)]"
                  >
                    <Send className="h-4 w-4" />
                    {packageRequestKind === 'package_booking' ? l('Confirm & Send Offer', 'تأیید و ارسال پیشنهاد', 'تأكيد العرض وإرساله') : l('Send Proposal', 'ارسال پیشنهاد', 'إرسال العرض')}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 text-sm text-white/55">
                    {expired
                      ? l('This request has expired.', 'مهلت این درخواست به پایان رسیده است.', 'انتهت صلاحية هذا الطلب.')
                      : full
                        ? l('This request has reached its proposal limit.', 'ظرفیت دریافت پیشنهاد برای این درخواست تکمیل شده است.', 'اكتمل عدد العروض المسموح به لهذا الطلب.')
                        : !roleAllowed
                          ? l('Only the selected guide, agency, or platform administrator can submit a proposal.', 'فقط راهنما یا آژانس انتخاب‌شده یا مدیر سامانه می‌تواند پیشنهاد ثبت کند.', 'لا يمكن تقديم عرض إلا من المرشد أو الوكالة المختارة أو مسؤول المنصة.')
                          : l('This request is no longer accepting proposals.', 'این درخواست دیگر پیشنهاد جدید نمی‌پذیرد.', 'لم يعد هذا الطلب يقبل عروضاً جديدة.')}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {request && (
        <SubmitProposalModal
          open={proposalOpen}
          onClose={() => setProposalOpen(false)}
          request={request}
          guideId={user?.id}
          commissionRate={commissionRate}
          onSuccess={handleProposalSuccess}
        />
      )}
    </div>
  );
}
