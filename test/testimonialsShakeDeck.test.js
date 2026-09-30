import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('home integrates the installed Shake Testimonial without changing deferred loading or content', async () => {
  const [section, deck, home, i18n] = await Promise.all([
    read('src/components/home/TestimonialsSection.jsx'),
    read('src/components/shake-testimonial-card.jsx'),
    read('src/pages/Home.jsx'),
    read('src/lib/i18n.jsx'),
  ]);
  assert.match(section, /<ShakeTestimonial testimonials={testimonials} lang={lang} t={t}/);
  for (const name of ['Sarah Mitchell', 'Khaled Al-Rashid', 'Yuki Tanaka']) assert.ok(section.includes(name));
  for (const field of ['origin', 'text', 'tour']) {
    assert.match(deck, new RegExp(`review\\.${field}\\[lang\\] \\|\\| review\\.${field}\\.en`));
  }
  for (const key of ['testimonials_eyebrow', 'testimonials_title', 'testimonials_subtitle']) assert.ok(section.includes(key));
  assert.match(section, /<section dir={dir}/);
  assert.match(home, /const TestimonialsSection = lazy/);
  assert.match(home, /<DeferredSection><TestimonialsSection \/><\/DeferredSection>/);
  assert.doesNotMatch(section + deck, /TestimonialStampArc|isExpanded|expandedTransform|stackedTransform|onPointerEnter|onPointerLeave|onPointerUp/);
  assert.doesNotMatch(section + deck, /Marcus Thorne|Elena Rodriguez|Sarah Jenkins|TechNova|David Kim|memoji|line-clamp/);
  for (const key of ['testimonials_next', 'testimonials_pause', 'testimonials_resume', 'testimonials_rating']) {
    assert.equal(i18n.match(new RegExp(`${key}:`, 'g')).length, 3);
  }
});

test('shake deck preserves useLayouts motion and safely manages autoplay and manual navigation', async () => {
  const deck = await read('src/components/shake-testimonial-card.jsx');
  assert.match(deck, /from 'motion\/react'/);
  assert.match(deck, /<AnimatePresence mode="popLayout">/);
  assert.match(deck, /const handleNext = useCallback/);
  assert.match(deck, /if \(animationLock.current\) return/);
  assert.match(deck, /animationLock.current = true/);
  assert.match(deck, /return \[\.\.\.rest, first\]/);
  assert.match(deck, /\[0, -12, 12, -12, 12, 0, 0\]/);
  assert.match(deck, /\[0, 0, 0, 0, 0, 0, -300\]/);
  assert.match(deck, /type: 'spring', stiffness: 400, damping: 30, mass: 0.6/);
  assert.match(deck, /setInterval/);
  assert.match(deck, /clearInterval\(interval\)/);
  assert.match(deck, /return \(\) => clearTimeout\(animationTimeout.current\)/);
  assert.match(deck, /Date.now\(\) - lastAdvance.current >= AUTOPLAY_MS/);
  assert.match(deck, /useReducedMotion\(\)/);
  assert.match(deck, /media.addEventListener\('change', updatePreference\)/);
  assert.match(deck, /media.removeEventListener\('change', updatePreference\)/);
  assert.match(deck, /if \(reduceMotion\) \{\s*reorder\(\);\s*return;/);
  assert.match(deck, /if \(reduceMotion \|\| isPaused \|\| hasFocus\) return/);
  // A native button supplies Enter/Space activation; hidden layers contain no controls.
  assert.match(deck, /<button\s+type="button"\s+onClick={handleNext}/);
  assert.match(deck, /aria-hidden={!isTop}/);
  assert.match(deck, /aria-describedby="review-0-name review-0-text"/);
});
