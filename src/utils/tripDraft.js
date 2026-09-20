const DRAFT_RE = /\[\[TRIP_DRAFT\]\]([\s\S]*?)\[\[\/TRIP_DRAFT\]\]/;
// Opening marker with no matching close (e.g. the model was cut off mid-block).
const OPEN_TO_END_RE = /\[\[TRIP_DRAFT\]\][\s\S]*$/;
// Any leftover opening/closing marker — the final safety net.
const STRAY_MARKER_RE = /\[\[\/?TRIP_DRAFT\]\]/g;

function tryParseDraft(text) {
  if (!text || typeof text !== 'string') return null;
  // `{3} matches three backticks without writing them literally.
  const cleaned = text.replace(/`{3}(?:json)?/gi, '').replace(/`{3}/g, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export function extractTripDraft(raw) {
  if (!raw || typeof raw !== 'string') return { content: raw, draft: null };

  let draft = null;
  let content = raw;

  const full = raw.match(DRAFT_RE);
  if (full) {
    // Well-formed block: parse what we can, but ALWAYS strip the whole block,
    // even if the JSON inside is malformed.
    draft = tryParseDraft(full[1]);
    content = raw.replace(DRAFT_RE, '');
  } else if (OPEN_TO_END_RE.test(raw)) {
    // Opening marker present but no closing marker: strip from marker to end.
    const open = raw.match(OPEN_TO_END_RE);
    draft = tryParseDraft(open[0]);
    content = raw.replace(OPEN_TO_END_RE, '');
  }

  // Guarantee no raw marker ever survives into the visible message.
  content = content.replace(STRAY_MARKER_RE, '').trim();

  return { content, draft };
}

// ── Canonical sets ────────────────────────────────────────────────────────────

const VALID_LANGUAGES    = ['English', 'Persian', 'Arabic', 'French', 'German', 'Chinese', 'Spanish'];
const VALID_ASSISTANCE   = ['Transportation', 'Accommodation'];
const VALID_HOLIDAY_TYPES = ['Active', 'Local Living', 'Nature', 'Offbeat', 'Relaxing'];
// TripRequestForm uses label-format IDs (not snake_case)
const VALID_SERVICES     = ['Air Tickets', 'Train Tickets', 'Attraction Tickets', 'Visa', 'Airport Transfer'];

const SERVICE_LABEL_MAP = {
  'air tickets':         'Air Tickets',
  'air_tickets':         'Air Tickets',
  'train tickets':       'Train Tickets',
  'train_tickets':       'Train Tickets',
  'attraction tickets':  'Attraction Tickets',
  'attraction_tickets':  'Attraction Tickets',
  'visa':                'Visa',
  'airport transfer':    'Airport Transfer',
  'airport_transfer':    'Airport Transfer',
};

const BUDGET_WORD_MAP = {
  budget: 1, economy: 2, standard: 3, premium: 4, luxury: 5,
};

// ── Time parser ───────────────────────────────────────────────────────────────

function snapMinute(m) {
  const options = [0, 15, 30, 45];
  return options.reduce((prev, cur) => Math.abs(cur - m) < Math.abs(prev - m) ? cur : prev);
}

function parseTime(str) {
  const DEFAULT = { hour: '09', minute: '00', period: 'AM' };
  if (!str || typeof str !== 'string') return DEFAULT;

  // Try "H:MM AM/PM" or "HH:MM AM/PM"
  const ampm = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    const h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const period = ampm[3].toUpperCase();
    if (h < 1 || h > 12) return DEFAULT;
    return {
      hour:   String(h).padStart(2, '0'),
      minute: String(snapMinute(m)).padStart(2, '0'),
      period,
    };
  }

  // Try 24h "H:MM" or "HH:MM"
  const h24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    let h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    if (h < 0 || h > 23) return DEFAULT;
    const period = h < 12 ? 'AM' : 'PM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return {
      hour:   String(h).padStart(2, '0'),
      minute: String(snapMinute(m)).padStart(2, '0'),
      period,
    };
  }

  return DEFAULT;
}

// ── Main mapper ───────────────────────────────────────────────────────────────

export function mapDraftToForm(draft) {
  if (!draft || typeof draft !== 'object') {
    return {
      destinations: [], start_date: '', end_date: '',
      arrival_hour: '09', arrival_minute: '00', arrival_period: 'AM',
      departure_hour: '09', departure_minute: '00', departure_period: 'AM',
      timings_flexible: false, adults: 1, children: 0,
      guide_languages: [], assistance: [], accommodation_stars: null,
      requirements: '', holiday_types: [], additional_services: [], tour_type: '',
    };
  }

  // Destinations — accept array, destinations_array, or comma-separated string
  let destinations = [];
  if (Array.isArray(draft.destinations) && draft.destinations.length) {
    destinations = draft.destinations.map(String).filter(Boolean);
  } else if (Array.isArray(draft.destinations_array) && draft.destinations_array.length) {
    destinations = draft.destinations_array.map(String).filter(Boolean);
  } else if (draft.destination) {
    destinations = String(draft.destination).split(',').map(s => s.trim()).filter(Boolean);
  }

  // Dates
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const start_date = typeof draft.start_date === 'string' && dateRe.test(draft.start_date) ? draft.start_date : '';
  const end_date   = typeof draft.end_date   === 'string' && dateRe.test(draft.end_date)   ? draft.end_date   : '';

  // Times
  const arrivalParsed   = parseTime(draft.arrival_time);
  const departureParsed = parseTime(draft.departure_time);

  const timings_flexible = Boolean(draft.timings_flexible);

  const adults   = Math.max(1, parseInt(draft.adults,   10) || 1);
  const children = Math.max(0, parseInt(draft.children, 10) || 0);

  // Guide languages — case-insensitive match, normalized to canonical casing
  const rawLangs = Array.isArray(draft.guide_languages) ? draft.guide_languages : [];
  const guide_languages = rawLangs
    .map(l => {
      const lower = String(l).toLowerCase();
      return VALID_LANGUAGES.find(v => v.toLowerCase() === lower) || null;
    })
    .filter(Boolean);

  // Assistance — accept synonyms
  const rawAssist = Array.isArray(draft.assistance) ? draft.assistance : [];
  const assistance = rawAssist
    .map(a => {
      const lower = String(a).toLowerCase();
      if (lower.includes('transport')) return 'Transportation';
      if (lower.includes('accommod') || lower.includes('hotel')) return 'Accommodation';
      return VALID_ASSISTANCE.find(v => v.toLowerCase() === lower) || null;
    })
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Accommodation stars
  let accommodation_stars = null;
  if (draft.accommodation_stars != null) {
    const n = parseInt(draft.accommodation_stars, 10);
    if (!isNaN(n)) {
      accommodation_stars = Math.min(5, Math.max(1, n));
    } else {
      const word = String(draft.accommodation_stars).toLowerCase().trim();
      accommodation_stars = BUDGET_WORD_MAP[word] ?? null;
    }
  }

  const requirements = String(draft.requirements || '').trim();

  // Holiday types — case-insensitive, normalized
  const rawHoliday = Array.isArray(draft.holiday_types) ? draft.holiday_types : [];
  const holiday_types = rawHoliday
    .map(h => {
      const lower = String(h).toLowerCase().trim();
      return VALID_HOLIDAY_TYPES.find(v => v.toLowerCase() === lower) || null;
    })
    .filter(Boolean);

  // Additional services — normalize to label form used by TripRequestForm
  const rawServices = Array.isArray(draft.additional_services) ? draft.additional_services : [];
  const additional_services = rawServices
    .map(s => {
      const lower = String(s).toLowerCase().trim();
      return SERVICE_LABEL_MAP[lower]
        || VALID_SERVICES.find(v => v.toLowerCase() === lower)
        || null;
    })
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Tour type
  let tour_type = '';
  if (draft.tour_type) {
    const lower = String(draft.tour_type).toLowerCase().trim();
    if (lower.includes('private')) tour_type = 'Private Tour';
    else if (lower.includes('group')) tour_type = 'Group Tour';
  }

  return {
    destinations,
    start_date,
    end_date,
    arrival_hour:     arrivalParsed.hour,
    arrival_minute:   arrivalParsed.minute,
    arrival_period:   arrivalParsed.period,
    departure_hour:   departureParsed.hour,
    departure_minute: departureParsed.minute,
    departure_period: departureParsed.period,
    timings_flexible,
    // TripRequestForm owns the gender split. In a conversational draft the
    // model usually only knows the total, so make that total visible to the
    // first step as maleAdults rather than silently falling back to one.
    adults,
    maleAdults: adults,
    femaleAdults: 0,
    children,
    guide_languages,
    assistance,
    accommodation_stars,
    requirements,
    holiday_types,
    additional_services,
    tour_type,
  };
}
