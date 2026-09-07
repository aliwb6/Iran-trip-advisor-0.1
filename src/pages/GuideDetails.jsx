import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { transformImage, imgPresets } from '@/lib/imageTransform';
import { motion } from 'framer-motion';
import {
  Star, MapPin, Globe, Calendar, BadgeCheck, ChevronLeft, ChevronRight,
  ArrowRight, Map, PenLine, Plus, Minus, ChevronDown, Copy, Lock, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { selectPublicProfiles } from '@/lib/publicProfiles';
import { avatarFor } from '@/lib/avatar';
import { useAuth } from '@/lib/AuthContext';
import TourCard from '@/components/tours/TourCard';
import { FALLBACK_IMAGE } from '@/hooks/useSupabase';
import { iranianDestinations } from '@/data/iranianCities';
import PublicProfileGallery from '@/components/profile/PublicProfileGallery';
import PublicLicenseCard from '@/components/profile/PublicLicenseCard';
import ProfileReviewDialog from '@/components/profile/ProfileReviewDialog';
import { fetchProfileReviewsSafely } from '@/lib/reviews';
import { selectPublicTours } from '@/lib/publicTours';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1589562784072-9ede7d082e5e?w=800&h=1000&fit=crop';

// TourCard expects a flat image as a separate prop; reuse the same fallback chain
// used on the Tours listing page.
const pickTourImage = (tour) =>
  tour.cover_image || tour.image_url || tour.image ||
  (Array.isArray(tour.gallery) && tour.gallery[0]) || FALLBACK_IMAGE;

function StarRow({ rating, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${sz} ${n <= Math.round(rating ?? 0) ? 'fill-gold text-gold' : 'fill-muted text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

// ── Booking Widget ─────────────────────────────────────────────────────────────

function BookingWidget({ guide, lang }) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const navigate = useNavigate();

  const guideName = guide?.full_name || 'Guide';

  const handleRequest = () => {
    if (!startDate || !endDate) {
      toast.error(lang === 'fa' ? 'لطفاً تاریخ شروع و پایان سفر را انتخاب کنید.' : lang === 'ar' ? 'يرجى اختيار تاريخ بداية الرحلة ونهايتها.' : 'Please select both the start and end dates.');
      return;
    }
    navigate(`/request-trip/${guide?.id}`, {
      state: { destination, startDate, endDate, adults, children, guide },
    });
  };

  return (
    <div className="p-6 rounded-2xl bg-card border border-border/50 shadow-md">
      <h3 className="font-heading text-xl font-semibold text-foreground mb-5">
        {lang === 'fa' ? 'درخواست سفر' : lang === 'ar' ? 'طلب رحلة' : 'Request A Trip'}
      </h3>

      <div className="space-y-4">
        {/* Destination */}
        <div>
          <label className="block font-body text-xs text-muted-foreground mb-1.5">
            {lang === 'fa' ? 'مقصد' : lang === 'ar' ? 'الوجهة' : 'Destination'}
          </label>
          <div className="relative">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 appearance-none cursor-pointer"
            >
              <option value="">{lang === 'fa' ? '-- مقصد را انتخاب کنید --' : '-- Select destination --'}</option>
              {iranianDestinations.map((c) => <option key={c.en} value={c.en}>{c[lang] || c.en}</option>)}
            </select>
            <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="block font-body text-xs text-muted-foreground mb-1.5">
            {lang === 'fa' ? 'تاریخ سفر' : lang === 'ar' ? 'تاريخ السفر' : 'Travel Date'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[10px] text-muted-foreground mb-1">{lang === 'fa' ? 'از' : lang === 'ar' ? 'من' : 'From'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartDate(next);
                  if (endDate && endDate < next) setEndDate('');
                }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-2.5 py-2.5 rounded-xl border border-border bg-background font-body text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground mb-1">{lang === 'fa' ? 'تا' : lang === 'ar' ? 'إلى' : 'To'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                className="w-full px-2.5 py-2.5 rounded-xl border border-border bg-background font-body text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
          </div>
        </div>

        {/* Adults */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
          <div>
            <p className="font-body text-sm font-medium text-foreground">{lang === 'fa' ? 'بزرگسال' : 'Adults'}</p>
            <p className="font-body text-xs text-muted-foreground">{lang === 'fa' ? 'سنین ۱۸ تا ۶۰' : 'Aged 18–60'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAdults(Math.max(1, adults - 1))}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gold/10 hover:border-gold/40 transition"
            >
              <Minus className="w-3.5 h-3.5 text-foreground" />
            </button>
            <span className="font-body text-sm font-semibold text-foreground w-5 text-center">{adults}</span>
            <button
              onClick={() => setAdults(adults + 1)}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gold/10 hover:border-gold/40 transition"
            >
              <Plus className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Children */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
          <div>
            <p className="font-body text-sm font-medium text-foreground">{lang === 'fa' ? 'کودک' : 'Children'}</p>
            <p className="font-body text-xs text-muted-foreground">{lang === 'fa' ? 'سنین ۱ تا ۱۰' : 'Aged 1–10'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setChildren(Math.max(0, children - 1))}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gold/10 hover:border-gold/40 transition"
            >
              <Minus className="w-3.5 h-3.5 text-foreground" />
            </button>
            <span className="font-body text-sm font-semibold text-foreground w-5 text-center">{children}</span>
            <button
              onClick={() => setChildren(children + 1)}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gold/10 hover:border-gold/40 transition"
            >
              <Plus className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>
        </div>

        <button
          onClick={handleRequest}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black font-body font-bold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all"
        >
          {lang === 'fa' ? 'درخواست سفر' : lang === 'ar' ? 'طلب رحلة' : 'Request A Trip'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Review Card ────────────────────────────────────────────────────────────────

function ReviewCard({ review }) {
  const [expanded, setExpanded] = useState(false);
  const text = review.review_text || review.body || review.comment || '';
  const reviewerName = review.reviewer?.full_name || review.reviewer_name || review.userName || 'Anonymous';
  const reviewDate = review.created_at
    ? new Date(review.created_at).toLocaleDateString()
    : review.date || '';
  const needsTruncate = text.length > 150;

  return (
    <div className="p-5 rounded-2xl bg-card border border-border/50">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
          <span className="font-heading text-sm font-bold text-gold">
            {reviewerName[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="font-body text-sm font-semibold text-foreground truncate">{reviewerName}</p>
            <p className="font-body text-xs text-muted-foreground flex-shrink-0 ms-2">{reviewDate}</p>
          </div>
          <StarRow rating={review.rating || 5} size="sm" />
        </div>
      </div>
      {review.title && (
        <p className="font-body text-sm font-semibold text-foreground mb-1">{review.title}</p>
      )}
      <p className="font-body text-sm text-foreground/70 leading-relaxed">
        {needsTruncate && !expanded ? text.slice(0, 150) + '…' : text}
      </p>
      {needsTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 font-body text-xs text-gold hover:text-gold/80 font-medium transition"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
      {review.admin_reply && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
          <p className="font-body text-xs font-semibold text-emerald-600 dark:text-emerald-400">Admin reply</p>
          <p className="mt-1 font-body text-xs leading-relaxed text-foreground/70">{review.admin_reply}</p>
        </div>
      )}
    </div>
  );
}

// ── Rating Breakdown ──────────────────────────────────────────────────────────

function RatingBreakdown({ reviewList = [] }) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviewList.filter((r) => Math.round(r.rating || 5) === star).length,
  }));
  const total = reviewList.length || 1;

  return (
    <div className="space-y-2">
      {counts.map(({ star, count }) => (
        <div key={star} className="flex items-center gap-3">
          <span className="font-body text-xs text-muted-foreground w-6 text-end">{star}★</span>
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-700"
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
          <span className="font-body text-xs text-muted-foreground w-8">{Math.round((count / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GuideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang, dir } = useI18n();

  const [guide, setGuide] = useState(null);
  const [tours, setTours] = useState([]);
  const [chatUnlocked, setChatUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewList, setReviewList] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);

    const run = async () => {
      try {
        // Part 1/2/3: profile + published tours (newest first).
        const [{ data: profileData, error: profileErr }, { data: tourData }, reviewResult] = await Promise.all([
          selectPublicProfiles(supabase).eq('id', id).single(),
          selectPublicTours(supabase)
            .or(`guide_id.eq.${id},agency_id.eq.${id}`)
            .order('created_at', { ascending: false }),
          fetchProfileReviewsSafely(supabase, { targetType: 'guide', profileId: id }),
        ]);
        if (profileErr) throw profileErr;

        // Part 4: unlock chat if the current tourist has a confirmed/finalized
        // trip with this guide/agency (proxy for a paid booking — no real
        // payment gateway is wired up yet).
        let unlocked = false;
        if (user?.id) {
          const { data: tripData } = await supabase
            .from('trip_requests')
            .select('id')
            .eq('selected_guide_id', id)
            .eq('user_id', user.id)
            .in('status', ['confirmed', 'booked', 'completed'])
            .limit(1);
          unlocked = Array.isArray(tripData) && tripData.length > 0;
        }

        if (mounted) {
          setGuide(profileData);
          setTours(tourData || []);
          setReviewList(reviewResult.reviews);
          setReviewError(reviewResult.error || '');
          setChatUnlocked(unlocked);
          setError(null);
        }
      } catch (err) {
        if (mounted) { setError(err.message); setGuide(null); }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [id, user?.id]);

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="font-body text-muted-foreground text-sm">
            {lang === 'fa' ? 'در حال بارگذاری...' : lang === 'ar' ? 'جار التحميل...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-3xl text-foreground mb-4">
            {lang === 'fa' ? 'راهنما یافت نشد' : lang === 'ar' ? 'المرشد غير موجود' : 'Guide Not Found'}
          </h1>
          {error && <p className="font-body text-sm text-destructive mb-4">{error}</p>}
          <Link to="/guides" className="text-gold hover:underline font-body">← Back to Guides</Link>
        </div>
      </div>
    );
  }

  const name = guide.full_name || '';
  const city = guide.city || '';
  const bio = guide.bio || '';
  const specialties = Array.isArray(guide.specialties) ? guide.specialties : (guide.specialty ? [guide.specialty] : []);
  const languages = Array.isArray(guide.languages) ? guide.languages : (guide.languages ? guide.languages.split(',').map((s) => s.trim()) : []);
  const rating = guide.rating ?? null;
  const reviewCount = guide.reviews ?? guide.review_count ?? 0;
  const otherCities = Array.isArray(guide.other_cities) ? guide.other_cities : [];
  const licenseVerified = guide.license_status === 'verified';
  const guideSince = guide.guide_since || guide.created_at?.slice(0, 4) || null;

  const avatar = avatarFor(guide);
  const isRtl = dir === 'rtl';

  const visibleReviews = showAllReviews ? reviewList : reviewList.slice(0, 3);

  const handleChat = () => {
    if (!chatUnlocked) {
      toast(lang === 'fa' ? 'برای چت، ابتدا یک تور پرداخت‌شده رزرو کنید.' : lang === 'ar' ? 'للدردشة، أكمل حجزاً مدفوعاً أولاً.' : 'Complete a paid booking to unlock chat.');
      return;
    }
    navigate(`/chat/${id}`);
  };

  const handleWriteReview = () => {
    if (!user) {
      toast.error(lang === 'fa' ? 'برای ثبت نظر وارد حساب خود شوید.' : lang === 'ar' ? 'سجّل الدخول لكتابة تقييم.' : 'Sign in to write a review.');
      navigate('/login');
      return;
    }
    setReviewOpen(true);
  };

  return (
    <div dir={dir} className="min-h-screen bg-background pb-20">
      {/* Top bar */}
      <div className="pt-20 pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm transition"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {lang === 'fa' ? 'بازگشت' : lang === 'ar' ? 'عودة' : 'Back'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── TOP SECTION: Photo + Info + Verified License ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)_280px] gap-8 mb-12"
        >
          {/* Photo */}
          <div className="w-full max-w-[400px] mx-auto lg:mx-0 lg:max-w-none aspect-[3/4] rounded-2xl overflow-hidden shadow-lg">
            <img decoding="async" loading="lazy"
              src={transformImage(avatar || FALLBACK_IMG, imgPresets.card)}
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info panel */}
          <div className="flex flex-col justify-center py-4">
            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground mb-2 leading-tight">
              {name}
            </h1>

            {/* Username */}
            {guide.username && (
              <div className="flex items-center gap-1.5 mb-4">
                <span className="font-body text-sm text-muted-foreground">@{guide.username}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(guide.username);
                    toast.success(t('username_copied'));
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-border/50 transition"
                  aria-label={t('username_copied')}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Rating badge */}
            {rating != null && (
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gold text-black font-body font-bold text-sm">
                  <Star className="w-4 h-4 fill-black" />
                  {Number(rating).toFixed(1)}
                </span>
                <StarRow rating={rating} size="md" />
                <span className="font-body text-sm text-muted-foreground">
                  {reviewCount} {lang === 'fa' ? 'نظر' : lang === 'ar' ? 'تقييم' : 'Reviews'}
                </span>
              </div>
            )}

            <div className="border-t border-border/50 my-4" />

            {/* Info rows */}
            <div className="space-y-3">
              {licenseVerified && (
                <div className="flex items-center gap-3">
                  <BadgeCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    {lang === 'fa' ? 'مجوز تأیید شده' : lang === 'ar' ? 'رخصة موثقة' : 'Verified'}
                  </span>
                </div>
              )}
              {guideSince && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gold flex-shrink-0" />
                  <span className="font-body text-sm text-foreground">
                    <span className="text-muted-foreground">
                      {lang === 'fa' ? 'راهنما از سال:' : lang === 'ar' ? 'مرشد منذ:' : 'Guide since:'}
                    </span>{' '}
                    {guideSince}
                  </span>
                </div>
              )}
              {languages.length > 0 && (
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                  <span className="font-body text-sm text-foreground">
                    <span className="text-muted-foreground">
                      {lang === 'fa' ? 'زبان‌ها:' : lang === 'ar' ? 'اللغات:' : 'Languages:'}
                    </span>{' '}
                    {languages.join(', ')}
                  </span>
                </div>
              )}
              {city && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gold flex-shrink-0" />
                  <span className="font-body text-sm text-foreground">
                    <span className="text-muted-foreground">
                      {lang === 'fa' ? 'شهر اصلی:' : lang === 'ar' ? 'المدينة الرئيسية:' : 'Primary city:'}
                    </span>{' '}
                    {city}
                  </span>
                </div>
              )}
              {otherCities.length > 0 && (
                <div className="flex items-start gap-3">
                  <Map className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                  <span className="font-body text-sm text-foreground">
                    <span className="text-muted-foreground">
                      {lang === 'fa' ? 'سایر شهرها:' : lang === 'ar' ? 'مدن أخرى:' : 'Also covers:'}
                    </span>{' '}
                    {otherCities.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => navigate(`/request-trip/${id}`, { state: { guide } })}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gold text-black font-body font-bold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all shadow-md"
              >
                {lang === 'fa' ? 'درخواست سفر' : lang === 'ar' ? 'طلب رحلة' : 'Request A Trip'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleChat()}
                disabled={!chatUnlocked}
                title={chatUnlocked ? '' : (lang === 'fa' ? 'پس از پرداخت تور در دسترس است' : lang === 'ar' ? 'متاح بعد الدفع' : 'Available after booking payment')}
                className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-body font-semibold text-sm active:scale-[0.98] transition-all ${
                  chatUnlocked
                    ? 'border-2 border-gold text-gold hover:bg-gold/5'
                    : 'border-2 border-border text-muted-foreground/60 cursor-not-allowed bg-muted/30'
                }`}
              >
                {chatUnlocked ? <MessageCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {lang === 'fa' ? 'چت' : lang === 'ar' ? 'محادثة' : 'Chat'}
              </button>
              <button
                type="button"
                onClick={handleWriteReview}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl border-2 border-gold text-gold font-body font-semibold text-sm hover:bg-gold/5 active:scale-[0.98] transition-all"
              >
                <PenLine className="w-4 h-4" />
                {lang === 'fa' ? 'نوشتن نظر' : lang === 'ar' ? 'كتابة تقييم' : 'Write A Review'}
              </button>
            </div>
          </div>

          {/* Verified license: full-width on tablet, compact third column on desktop. */}
          <PublicLicenseCard
            profile={guide}
            lang={lang}
            className="w-full max-w-sm justify-self-center lg:col-span-2 xl:col-span-1 xl:self-center xl:justify-self-stretch"
          />
        </motion.div>

        {/* ── BELOW: 70/30 grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">

          {/* LEFT COLUMN */}
          <div className="space-y-12">

            {/* About Me */}
            {bio && (
              <section>
                <h2 className="font-heading text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border/50">
                  {lang === 'fa' ? 'درباره من' : lang === 'ar' ? 'عني' : 'About Me'}
                </h2>
                <p className="font-body text-foreground/75 leading-relaxed text-base mb-5">{bio}</p>
                {specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s, i) => (
                      <span
                        key={i}
                        className="px-3.5 py-1.5 rounded-full text-sm font-body font-medium bg-gold/10 text-gold border border-gold/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Tours */}
            {tours.length > 0 ? (
              <section>
                <h2 className="font-heading text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border/50">
                  {lang === 'fa' ? `تورهای ${name.split(' ')[0]}` : lang === 'ar' ? `جولات ${name.split(' ')[0]}` : `Tours by ${name.split(' ')[0]}`}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
                  {tours.map((tour, i) => (
                    <TourCard
                      key={tour.id}
                      tour={tour}
                      image={pickTourImage(tour)}
                      index={i}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <section>
                <h2 className="font-heading text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border/50">
                  {lang === 'fa' ? `تورهای ${name.split(' ')[0]}` : lang === 'ar' ? `جولات ${name.split(' ')[0]}` : `Tours by ${name.split(' ')[0]}`}
                </h2>
                <p className="font-body text-muted-foreground text-sm py-6 text-center">
                  {lang === 'fa' ? 'هنوز توری ثبت نشده است' : lang === 'ar' ? 'لا توجد جولات بعد' : 'No tours yet'}
                </p>
              </section>
            )}

            {/* Reviews */}
            <section>
              <h2 className="font-heading text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border/50">
                {lang === 'fa' ? 'نظرات' : lang === 'ar' ? 'التقييمات' : 'Reviews'}
              </h2>

              {reviewError && (
                <p role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 font-body text-sm text-destructive">
                  {lang === 'fa' ? 'بارگذاری نظرات ممکن نشد.' : lang === 'ar' ? 'تعذر تحميل التقييمات.' : 'Reviews could not be loaded.'}
                </p>
              )}

              {!reviewError && rating != null && (
                <div className="flex items-start gap-8 mb-6 p-5 rounded-2xl bg-card border border-border/50">
                  <div className="text-center">
                    <p className="font-heading text-5xl font-bold text-foreground">{Number(rating).toFixed(1)}</p>
                    <StarRow rating={rating} size="md" />
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {reviewCount} {lang === 'fa' ? 'نظر' : 'reviews'}
                    </p>
                  </div>
                  <div className="flex-1">
                    <RatingBreakdown reviewList={reviewList} />
                  </div>
                </div>
              )}

              {!reviewError && reviewList.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {visibleReviews.map(review => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                  {reviewList.length > 3 && (
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="mt-4 w-full py-3 rounded-xl border-2 border-gold/30 text-gold font-body font-semibold text-sm hover:bg-gold/5 transition"
                    >
                      {showAllReviews
                        ? (lang === 'fa' ? 'نمایش کمتر' : 'Show Less')
                        : (lang === 'fa' ? `نمایش همه ${reviewList.length} نظر` : `Show all ${reviewList.length} reviews`)}
                    </button>
                  )}
                </>
              ) : !reviewError ? (
                <p className="font-body text-muted-foreground text-sm py-6 text-center">
                  {lang === 'fa' ? 'هنوز نظری ثبت نشده است' : lang === 'ar' ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
                </p>
              ) : null}
            </section>
          </div>

          {/* RIGHT COLUMN — Booking Widget */}
          <div className="lg:col-span-1 self-start space-y-6">
            <BookingWidget guide={guide} lang={lang} />
            <PublicProfileGallery images={guide.gallery_images} lang={lang} />
          </div>
        </div>
      </div>
      <ProfileReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        targetType="guide"
        profileId={guide.id}
        profileName={name}
        user={user}
        lang={lang}
      />
    </div>
  );
}
