import test from 'node:test';
import assert from 'node:assert/strict';
import { detectContactSharing, containsContactSharing } from '../src/lib/contactSharing.js';

test('blocks phone numbers written as words, including the reported bypass', () => {
  const samples = [
    'ziro eight nine one one one two eleven',
    'zero nine one two three four five six seven eight',
    '۰ nine one two 3 four five 6 seven eight',
    'صفر نه یک دو سه چهار پنج شش هفت هشت',
    'zero nine double one two three four five six',
    'zeroeightnineoneoneonetwothreefour',
  ];

  for (const sample of samples) {
    assert.equal(containsContactSharing(sample), true, sample);
    assert.ok(detectContactSharing(sample).includes('Phone number'), sample);
  }
});

test('blocks spaced or disguised social identifiers', () => {
  const samples = [
    ['t e l e g r a m: ali_123', 'Telegram'],
    ['i n s t a g r a m = travel.guy', 'Instagram'],
    ['w h a t s a p p ali', 'WhatsApp'],
    ['my username is a l i 1 2 3', 'Social handle'],
    ['TG id: ali_123', 'Telegram'],
  ];

  for (const [sample, label] of samples) {
    assert.ok(detectContactSharing(sample).includes(label), sample);
  }
});

test('does not block ordinary itinerary quantities and prose', () => {
  const samples = [
    'I need one room for two adults and three nights.',
    'Meet at 8 and leave at 11.',
    'The tour is eleven days and includes three cities.',
    'We are four friends and need two rooms.',
  ];

  for (const sample of samples) {
    assert.equal(containsContactSharing(sample), false, sample);
  }
});
