import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('guide proposal modal uses readable full-width mobile tabs', async () => {
  const [modal, styles] = await Promise.all([
    source('../src/components/dashboard/SubmitProposalModal.jsx'),
    source('../src/proposal-workspace.css'),
  ]);

  assert.match(modal, /proposal-workspace__body/);
  assert.match(modal, /proposal-trip-pane/);
  assert.match(modal, /proposal-workspace__footer/);
  assert.match(modal, /proposal-workspace__mobile-tabs/);
  assert.match(modal, /data-mobile-pane=\{mobilePane\}/);
  assert.match(styles, /\.proposal-workspace__body\[data-mobile-pane="proposal"\] > \.proposal-trip-pane/);
  assert.match(styles, /\.proposal-workspace__body\[data-mobile-pane="request"\] > div:not\(\.proposal-trip-pane\)/);
  assert.doesNotMatch(styles, /@media \(max-width: 959px\)[\s\S]*float: right/);
});

test('traveler proposal review uses full-width mobile tabs and keeps desktop split', async () => {
  const [card, styles] = await Promise.all([
    source('../src/components/profile/RequestCard.jsx'),
    source('../src/proposal-workspace.css'),
  ]);
  assert.match(card, /proposal-review-mobile-tabs/);
  assert.match(card, /data-mobile-pane=\{mobileReviewPane\}/);
  assert.match(card, /grid-cols-1[\s\S]*lg:grid-cols-\[minmax\(300px,38fr\)_minmax\(0,62fr\)\]/);
  assert.match(styles, /\.proposal-review-grid\[data-mobile-pane="offers"\] > \.proposal-review-request-pane/);
  assert.match(styles, /\.proposal-review-grid\[data-mobile-pane="request"\] > \.proposal-review-offers-pane/);
});
