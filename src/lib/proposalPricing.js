const asFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getTravelerCount(request = {}) {
  const partyTotal = asFiniteNumber(request.adults) + asFiniteNumber(request.children);
  const fallback = asFiniteNumber(request.num_people);
  return Math.max(1, partyTotal || fallback || 1);
}

export function getTripDurationDays(request = {}) {
  if (request.start_date && request.end_date) {
    const start = new Date(`${request.start_date}T00:00:00Z`);
    const end = new Date(`${request.end_date}T00:00:00Z`);
    const difference = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (Number.isFinite(difference) && difference !== 0) return Math.max(1, difference);
  }
  return Math.max(1, asFiniteNumber(request.duration, 1));
}

export function calculateProposalEstimate({
  unitPrice,
  priceType,
  pricePeriod,
  request,
  commissionRate,
}) {
  const quotedUnitPrice = Math.max(0, asFiniteNumber(unitPrice));
  const travelerCount = getTravelerCount(request);
  const tripDurationDays = getTripDurationDays(request);
  const peopleMultiplier = priceType === 'per_person' ? travelerCount : 1;
  const durationMultiplier = pricePeriod === 'per_day' ? tripDurationDays : 1;
  const totalEstimate = roundMoney(quotedUnitPrice * peopleMultiplier * durationMultiplier);
  const safeCommissionRate = Math.min(1, Math.max(0, asFiniteNumber(commissionRate)));
  const commissionEstimate = roundMoney(totalEstimate * safeCommissionRate);

  return {
    quotedUnitPrice,
    travelerCount,
    tripDurationDays,
    peopleMultiplier,
    durationMultiplier,
    totalEstimate,
    commissionEstimate,
    payoutEstimate: totalEstimate - commissionEstimate,
  };
}
