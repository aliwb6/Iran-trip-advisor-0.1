const asLocalizedText = (value, lang = 'en') => {
  if (value == null) return '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    return String(value[lang] || value.en || value.fa || value.ar || '').trim();
  }
  return String(value).trim();
};

const asList = (value, lang = 'en') => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof value === 'object') return asList(value[lang] || value.en, lang);

  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean);
    } catch {
      // Legacy tour values may look array-like without being valid JSON.
    }
  }

  return text
    .replace(/^\{?|\}?$/g, '')
    .split(/[,،·;|]/)
    .map(item => item.replace(/^['"]|['"]$/g, '').trim())
    .filter(item => item && !/^iran$/i.test(item));
};

const normalizeTourType = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('private')) return 'Private Tour';
  if (normalized.includes('group')) return 'Group Tour';
  return '';
};

const buildRequirements = (tour, lang) => {
  const title = asLocalizedText(tour?.title, lang) || 'this tour package';
  const description = asLocalizedText(tour?.desc ?? tour?.description, lang);

  const prefix = lang === 'fa'
    ? `می‌خواهم پکیج تور «${title}» را درخواست کنم. لطفاً برنامه سفر و خدمات اصلی همین تور حفظ شود، مگر تغییراتی که در این فرم مشخص می‌کنم.`
    : lang === 'ar'
      ? `أرغب في طلب باقة «${title}». يرجى الحفاظ على مسار الرحلة والخدمات الأصلية ما لم أحدد تغييرات في هذا النموذج.`
      : `I would like to request the “${title}” tour package. Please keep its original itinerary and services unless I specify changes in this form.`;

  return description ? `${prefix}\n\n${description}` : prefix;
};

export function normalizeProviderCode(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{6,12}$/.test(text)) return null;
  const code = Number(text);
  return Number.isSafeInteger(code) ? code : null;
}

export function buildPackageTripRequestInitialData(tour, lang = 'en') {
  const destinations = [
    asList(tour?.cities, lang),
    asList(tour?.city, lang),
    asList(tour?.location, lang),
  ].find(list => list.length > 0) || [];

  const included = asList(tour?.included, lang).map(item => item.toLowerCase());
  const themes = asList(tour?.theme, lang);
  const purpose = asLocalizedText(tour?.purpose, lang);

  return {
    destinations_array: [...new Set(destinations)],
    start_date: tour?.start_date || '',
    end_date: tour?.end_date || '',
    male_adults: 1,
    female_adults: 0,
    children: 0,
    guide_languages: asList(tour?.guide_languages ?? tour?.languages, lang),
    requirements: buildRequirements(tour, lang),
    holiday_types: [...new Set([...themes, ...(purpose ? [purpose] : [])])],
    additional_services: [],
    tour_type: normalizeTourType(tour?.tour_type),
    needs_transport: included.some(item => /transport|transfer|vehicle|car/.test(item)),
    needs_accommodation: included.some(item => /hotel|accommodation|guesthouse|lodging/.test(item)),
    accommodation_stars: null,
  };
}

export function getPackageRequestKind(request) {
  if (request?.request_kind === 'package_booking') return 'package_booking';
  if (request?.request_kind === 'package_private') return 'package_private';
  return null;
}

export function buildPackageProposalPrefill(request, lang = 'en') {
  const tour = request?.source_tour;
  if (!tour) return null;

  const price = tour.price ?? tour.price_usd ?? tour.price_from ?? '';
  const itinerary = Array.isArray(tour.itinerary)
    ? tour.itinerary.map((day, index) => {
      if (typeof day === 'string') return day.trim();
      const title = asLocalizedText(day?.title, lang);
      const description = asLocalizedText(day?.description, lang);
      return `Day ${day?.day || index + 1}: ${[title, description].filter(Boolean).join(' — ')}`.trim();
    }).filter(Boolean).join('\n')
    : asLocalizedText(tour.itinerary, lang);

  return {
    price: price == null ? '' : String(price),
    itinerary,
    included: asList(tour.included, lang),
    excluded: asList(tour.excluded ?? tour.not_included, lang),
    message: getPackageRequestKind(request) === 'package_booking'
      ? 'Thank you for your booking request. I have reviewed the package details and availability.'
      : 'Thank you for your private tour request. This offer is based on the reference package and can be tailored to your needs.',
  };
}
