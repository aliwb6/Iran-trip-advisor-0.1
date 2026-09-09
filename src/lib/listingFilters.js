export function listValues(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(listValues);
  if (typeof value === 'object') return Object.values(value).flatMap(listValues);

  const text = String(value).trim();
  if (!text) return [];

  // Be tolerant of legacy/API values that arrive as JSON-encoded arrays or
  // objects instead of native arrays. This keeps listing filters reliable
  // across old and new profile rows without changing the stored data.
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      return listValues(JSON.parse(text));
    } catch {
      // Fall through to the normal delimited-string parser.
    }
  }

  return text
    .split(/[,;·]/)
    .map(item => item.trim())
    .filter(Boolean);
}

const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase();

const candidateMatches = (candidate, wanted) => {
  const normalizedCandidate = normalize(candidate);
  const normalizedWanted = normalize(wanted);
  if (!normalizedCandidate || !normalizedWanted) return false;
  return normalizedCandidate === normalizedWanted || normalizedCandidate.includes(normalizedWanted);
};

export function matchesAnySelection(values, selections) {
  if (!Array.isArray(selections) || selections.length === 0) return true;

  const candidates = values.flatMap(listValues).filter(Boolean);

  // destinationSelectionAliases() emits three consecutive aliases for every
  // selected destination: English, Persian and Arabic. Treat each triplet as
  // one selected city. A profile/tour must match EVERY selected city, while it
  // may match ANY language alias inside that city. This makes selecting a
  // second city narrow the results instead of broadening them.
  if (selections.length >= 3 && selections.length % 3 === 0) {
    const groups = [];
    for (let index = 0; index < selections.length; index += 3) {
      groups.push(selections.slice(index, index + 3));
    }

    return groups.every(group =>
      group.some(wanted => candidates.some(candidate => candidateMatches(candidate, wanted)))
    );
  }

  return selections.some(wanted =>
    candidates.some(candidate => candidateMatches(candidate, wanted))
  );
}

export function reviewCountOf(item) {
  if (Array.isArray(item?.reviews)) return item.reviews.length;
  return Number(item?.review_count ?? item?.reviews_count ?? item?.reviews ?? 0) || 0;
}

export function ratingOf(item) {
  if (Array.isArray(item?.reviews) && item.reviews.length > 0) {
    return item.reviews.reduce((sum, review) => sum + (Number(review?.rating) || 0), 0) / item.reviews.length;
  }
  return Number(item?.rating ?? item?.average_rating ?? 0) || 0;
}

export function recommendedComparator(a, b) {
  const ratingDifference = ratingOf(b) - ratingOf(a);
  if (ratingDifference) return ratingDifference;

  const positiveDifference = (Number(b?.positive_review_count) || 0) - (Number(a?.positive_review_count) || 0);
  if (positiveDifference) return positiveDifference;

  const reviewDifference = reviewCountOf(b) - reviewCountOf(a);
  if (reviewDifference) return reviewDifference;

  return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
}

export function newestComparator(a, b) {
  return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
}
