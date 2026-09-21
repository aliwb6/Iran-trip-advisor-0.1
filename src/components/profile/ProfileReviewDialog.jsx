import {
  useState } from 'react';
import { Star } from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getReviewValidationError, submitProfileReview } from '@/lib/reviews';
import { supabase } from '@/supabaseClient';

const copy = {
  en: {
    title: 'Write a review',
    description: 'Share your experience with',
    rating: 'Rating',
    reviewTitle: 'Title (optional)',
    reviewTitlePlaceholder: 'Summarize your experience',
    review: 'Review',
    reviewPlaceholder: 'Tell other travelers about your experience…',
    cancel: 'Cancel',
    submit: 'Submit review',
    submitting: 'Submitting…',
    success: 'Your review has been submitted and is awaiting approval.',
  },
  fa: {
    title: 'نوشتن نظر',
    description: 'تجربه خود را به اشتراک بگذارید درباره',
    rating: 'امتیاز',
    reviewTitle: 'عنوان (اختیاری)',
    reviewTitlePlaceholder: 'خلاصه تجربه شما',
    review: 'نظر',
    reviewPlaceholder: 'تجربه خود را برای سایر مسافران بنویسید…',
    cancel: 'انصراف',
    submit: 'ارسال نظر',
    submitting: 'در حال ارسال…',
    success: 'نظر شما ارسال شد و در انتظار تأیید است.',
  },
  ar: {
    title: 'كتابة تقييم',
    description: 'شارك تجربتك مع',
    rating: 'التقييم',
    reviewTitle: 'العنوان (اختياري)',
    reviewTitlePlaceholder: 'لخّص تجربتك',
    review: 'التقييم',
    reviewPlaceholder: 'أخبر المسافرين الآخرين عن تجربتك…',
    cancel: 'إلغاء',
    submit: 'إرسال التقييم',
    submitting: 'جارٍ الإرسال…',
    success: 'تم إرسال تقييمك وهو بانتظار الموافقة.',
  },
};

export default function ProfileReviewDialog({
  open,
  onOpenChange,
  targetType,
  profileId,
  profileName,
  user,
  lang = 'en',
}) {
  const labels = copy[lang] || copy.en;
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (submitting) return;
    setRating(0);
    setTitle('');
    setReviewText('');
    setError('');
    onOpenChange(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = getReviewValidationError({ user, rating, reviewText });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await submitProfileReview(supabase, {
        user,
        targetType,
        profileId,
        rating,
        title,
        reviewText,
      });
      toast.success(labels.success);
      setRating(0);
      setTitle('');
      setReviewText('');
      setError('');
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError.message || 'The review could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg rounded-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-foreground">{labels.title}</DialogTitle>
          <DialogDescription className="font-body text-muted-foreground">
            {labels.description} {profileName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="mt-2 space-y-5">
          <fieldset>
            <legend className="mb-2 font-body text-sm font-medium text-foreground">{labels.rating}</legend>
            <div className="flex items-center gap-1" role="radiogroup" aria-label={labels.rating}>
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  onClick={() => setRating(value)}
                  className="rounded-lg p-1.5 transition hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-gold/40"
                >
                  <Star className={`h-7 w-7 ${value <= rating ? 'fill-gold text-gold' : 'text-muted-foreground/35'}`} />
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block font-body text-sm font-medium text-foreground">
            {labels.reviewTitle}
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder={labels.reviewTitlePlaceholder}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </label>

          <label className="block font-body text-sm font-medium text-foreground">
            {labels.review}
            <textarea
              rows={5}
              required
              value={reviewText}
              onChange={event => setReviewText(event.target.value)}
              placeholder={labels.reviewPlaceholder}
              className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-xl border border-border px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 font-body text-sm font-bold text-black hover:bg-gold/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? labels.submitting : labels.submit}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
