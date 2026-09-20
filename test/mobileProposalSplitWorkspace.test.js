import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('guide proposal modal keeps a semantic two-pane mobile workspace', async () => {
  const [modal, styles] = await Promise.all([
    source('../src/components/dashboard/SubmitProposalModal.jsx'),
    source('../src/proposal-workspace.css'),
  ]);

  assert.match(modal, /proposal-workspace__body/);
  assert.match(modal, /proposal-trip-pane/);
  assert.match(modal, /proposal-workspace__footer/);
  assert.match(styles, /@media \(max-width: 959px\)[\s\S]*\.proposal-trip-pane[\s\S]*float: right/);
  assert.match(styles, /\.proposal-workspace__body > div:not\(:first-child\)[\s\S]*margin-right: calc\(var\(--proposal-request-pane\)/);
});

test('traveler proposal review is split into offers-left and request-right on mobile', async () => {
  const card = await source('../src/components/profile/RequestCard.jsx');
  assert.match(card, /grid-cols-\[minmax\(0,58fr\)_minmax\(0,42fr\)\]/);
  assert.match(card, /proposal-review-request-pane order-2/);
  assert.match(card, /proposal-review-offers-pane order-1/);
  assert.match(card, /lg:order-1[\s\S]*lg:border-r/);
  assert.match(card, /lg:order-2/);
});
