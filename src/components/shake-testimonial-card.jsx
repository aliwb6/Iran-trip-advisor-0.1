import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const AUTOPLAY_MS = 6500;
const TOSS_MS = 600;
const SETTLE_MS = 450;

// Adapted from the locally installed useLayouts Shake Testimonial Card.
// Keep its shake keyframes, upward toss, and spring depth movement.
export default function ShakeTestimonial({ testimonials, lang, t }) {
  const [cards, setCards] = useState(testimonials);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const initialReducedMotion = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(initialReducedMotion);
  const animationLock = useRef(false);
  const animationTimeout = useRef(null);
  const lastAdvance = useRef(0);

  useEffect(() => {
    // Motion's installed hook snapshots the preference at mount. Subscribe too
    // so enabling reduced motion in an open page stops autoplay immediately.
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  const handleNext = useCallback(() => {
    if (animationLock.current) return;
    lastAdvance.current = Date.now();
    const reorder = () => setCards((previous) => {
      const [first, ...rest] = previous;
      return [...rest, first];
    });
    if (reduceMotion) {
      reorder();
      return;
    }
    // The ref locks synchronously, including clicks before React re-renders.
    animationLock.current = true;
    setIsAnimating(true);
    animationTimeout.current = setTimeout(() => {
      reorder();
      setIsAnimating(false);
      // Allow the tossed card to settle at the back before another toss.
      animationTimeout.current = setTimeout(() => {
        animationLock.current = false;
        animationTimeout.current = null;
      }, SETTLE_MS);
    }, TOSS_MS);
  }, [reduceMotion]);

  useEffect(() => {
    // Cancel pending motion when the preference changes, and on unmount.
    clearTimeout(animationTimeout.current);
    animationLock.current = false;
    setIsAnimating(false);
    return () => clearTimeout(animationTimeout.current);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || isPaused || hasFocus) return undefined;
    lastAdvance.current = Date.now();
    const interval = setInterval(() => {
      if (!document.hidden && Date.now() - lastAdvance.current >= AUTOPLAY_MS) handleNext();
    }, AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [handleNext, reduceMotion, isPaused, hasFocus]);

  return (
    <div
      className="mx-auto w-full max-w-[28rem]"
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      <div className="relative isolate grid" style={{ perspective: '1200px' }}>
        <AnimatePresence mode="popLayout">
          {cards.map((review, index) => {
            const isTop = index === 0;
            const tossing = isTop && isAnimating && !reduceMotion;
            return (
              <motion.article
                key={review.name}
                layout={!reduceMotion}
                aria-hidden={!isTop}
                initial={false}
                style={{ gridArea: '1 / 1', zIndex: cards.length - index, transformOrigin: 'center center' }}
                animate={{
                  scale: reduceMotion ? 1 : tossing ? [1, 1.05, 1, 1.05, 1, 1, 0.9] : 1 - index * 0.05,
                  y: reduceMotion ? 0 : tossing ? [0, 0, 0, 0, 0, 0, -300] : index * 15,
                  rotateX: reduceMotion ? 0 : tossing ? [0, 0, 0, 0, 0, 0, 15] : -index * 2,
                  x: tossing ? [0, -12, 12, -12, 12, 0, 0] : 0,
                  rotate: tossing ? [0, -2, 2, -2, 2, 0, -5] : 0,
                }}
                transition={reduceMotion ? { duration: 0 } : tossing ? {
                  duration: TOSS_MS / 1000,
                  times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
                  ease: 'easeOut',
                } : { type: 'spring', stiffness: 400, damping: 30, mass: 0.6 }}
                className={cn(
                  'pointer-events-none flex min-w-0 flex-col gap-5 rounded-[2rem] border border-border p-6 text-foreground shadow-warm sm:rounded-[3rem] sm:p-8',
                  // All cards share an intrinsic grid row: the longest review sets
                  // a stable height without clipping text or measuring hidden copies.
                  review === testimonials[0] ? 'bg-card' : review === testimonials[1] ? 'bg-sand' : 'bg-background',
                )}
              >
                <header className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/15 bg-accent/10 font-heading font-semibold text-accent">
                    {review.name.split(/\s+/).map((part) => part[0]).join('')}
                  </span>
                  <div className="min-w-0">
                    <h3 id={`review-${index}-name`} className="font-heading text-lg font-semibold"><bdi>{review.name}</bdi></h3>
                    <p className="font-body text-xs text-muted-foreground sm:text-sm">{review.origin[lang] || review.origin.en}</p>
                  </div>
                </header>
                <div className="flex gap-0.5" role="img" aria-label={t('testimonials_rating', { rating: review.rating })}>
                  {Array.from({ length: review.rating }, (_, starIndex) => (
                    <Star key={starIndex} className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                  ))}
                </div>
                <blockquote id={`review-${index}-text`} className="flex-1 break-words font-body text-base italic leading-relaxed text-foreground/75">
                  “{review.text[lang] || review.text.en}”
                </blockquote>
                <footer className="border-t border-accent/15 pt-4 font-body text-xs text-accent sm:text-sm">
                  {review.tour[lang] || review.tour.en}
                </footer>
              </motion.article>
            );
          })}
        </AnimatePresence>
        {/* A stationary native button preserves keyboard focus as cards reorder. */}
        <button
          type="button"
          onClick={handleNext}
          aria-label={t('testimonials_next')}
          aria-describedby="review-0-name review-0-text"
          aria-disabled={isAnimating}
          className="absolute inset-0 z-10 cursor-pointer rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 sm:rounded-[3rem]"
        />
      </div>
      <div className="mt-14 flex justify-center">
        {!reduceMotion && (
          <button type="button" onClick={() => setIsPaused((paused) => !paused)} aria-pressed={isPaused} className="rounded-lg px-3 py-2 font-body text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {t(isPaused ? 'testimonials_resume' : 'testimonials_pause')}
          </button>
        )}
      </div>
    </div>
  );
}
