import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../src/components/home/TestimonialsSection.jsx', import.meta.url);

test('home testimonials use an accessible responsive stamp arc', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /function TestimonialStampArc/);
  assert.match(source, /type: 'spring'/);
  assert.match(source, /useReducedMotion/);
  assert.match(source, /useIsMobile/);
  assert.match(source, /onPointerEnter/);
  assert.match(source, /event\.pointerType !== 'mouse'/);
  assert.match(source, /onFocusCapture/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.doesNotMatch(source, /useScroll|useTransform|sticky top-/);
});
