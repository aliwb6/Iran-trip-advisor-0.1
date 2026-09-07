import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProposalEstimate,
  getTravelerCount,
  getTripDurationDays,
} from '../src/lib/proposalPricing.js';

const request = {
  adults: 2,
  children: 1,
  num_people: 3,
  start_date: '2026-10-01',
  end_date: '2026-10-05',
};

const estimate = (priceType, pricePeriod) => calculateProposalEstimate({
  unitPrice: 100,
  priceType,
  pricePeriod,
  request,
  commissionRate: 0.15,
});

test('per-person per-day proposal estimate uses travelers and duration', () => {
  assert.deepEqual(
    estimate('per_person', 'per_day'),
    {
      quotedUnitPrice: 100,
      travelerCount: 3,
      tripDurationDays: 4,
      peopleMultiplier: 3,
      durationMultiplier: 4,
      totalEstimate: 1200,
      commissionEstimate: 180,
      payoutEstimate: 1020,
    }
  );
});

test('per-person entire-trip proposal estimate uses only traveler multiplier', () => {
  const result = estimate('per_person', 'entire_trip');
  assert.equal(result.totalEstimate, 300);
  assert.equal(result.commissionEstimate, 45);
  assert.equal(result.payoutEstimate, 255);
});

test('entire-group per-day proposal estimate uses only duration multiplier', () => {
  const result = estimate('entire_group', 'per_day');
  assert.equal(result.totalEstimate, 400);
  assert.equal(result.commissionEstimate, 60);
  assert.equal(result.payoutEstimate, 340);
});

test('entire-group entire-trip proposal estimate uses the unit quote', () => {
  const result = estimate('entire_group', 'entire_trip');
  assert.equal(result.totalEstimate, 100);
  assert.equal(result.commissionEstimate, 15);
  assert.equal(result.payoutEstimate, 85);
});

test('traveler and duration calculations have a minimum fallback of one', () => {
  const emptyRequest = { adults: 0, children: 0, num_people: 0, duration: 0 };
  assert.equal(getTravelerCount(emptyRequest), 1);
  assert.equal(getTripDurationDays(emptyRequest), 1);
  const result = calculateProposalEstimate({
    unitPrice: 25,
    priceType: 'per_person',
    pricePeriod: 'per_day',
    request: emptyRequest,
    commissionRate: 0.2,
  });
  assert.equal(result.totalEstimate, 25);
  assert.equal(result.commissionEstimate, 5);
  assert.equal(result.payoutEstimate, 20);
});

test('zero-day dates use canonical duration fallback', () => {
  assert.equal(getTripDurationDays({
    start_date: '2026-10-01',
    end_date: '2026-10-01',
    duration: 7,
  }), 7);
});
