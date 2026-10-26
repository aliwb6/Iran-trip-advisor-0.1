export const popularLanguages = [
  'Persian',
  'English',
  'Arabic',
  'French',
  'German',
  'Spanish',
  'Italian',
  'Chinese (Mandarin)',
  'Russian',
  'Turkish',
];

const languageLabels = {
  Persian: { fa: 'فارسی', ar: 'الفارسية' },
  English: { fa: 'انگلیسی', ar: 'الإنجليزية' },
  Arabic: { fa: 'عربی', ar: 'العربية' },
  French: { fa: 'فرانسوی', ar: 'الفرنسية' },
  German: { fa: 'آلمانی', ar: 'الألمانية' },
  Spanish: { fa: 'اسپانیایی', ar: 'الإسبانية' },
  Italian: { fa: 'ایتالیایی', ar: 'الإيطالية' },
  'Chinese (Mandarin)': { fa: 'چینی (ماندارین)', ar: 'الصينية (الماندرين)' },
  Russian: { fa: 'روسی', ar: 'الروسية' },
  Turkish: { fa: 'ترکی', ar: 'التركية' },
  Portuguese: { fa: 'پرتغالی', ar: 'البرتغالية' },
  Japanese: { fa: 'ژاپنی', ar: 'اليابانية' },
  Korean: { fa: 'کره‌ای', ar: 'الكورية' },
  'Chinese (Cantonese)': { fa: 'چینی (کانتونی)', ar: 'الصينية (الكانتونية)' },
  Hindi: { fa: 'هندی', ar: 'الهندية' },
  Urdu: { fa: 'اردو', ar: 'الأردية' },
  Dutch: { fa: 'هلندی', ar: 'الهولندية' },
  Swedish: { fa: 'سوئدی', ar: 'السويدية' },
  Norwegian: { fa: 'نروژی', ar: 'النرويجية' },
  Danish: { fa: 'دانمارکی', ar: 'الدنماركية' },
  Finnish: { fa: 'فنلاندی', ar: 'الفنلندية' },
  Polish: { fa: 'لهستانی', ar: 'البولندية' },
  Czech: { fa: 'چکی', ar: 'التشيكية' },
  Romanian: { fa: 'رومانیایی', ar: 'الرومانية' },
  Hungarian: { fa: 'مجاری', ar: 'المجرية' },
  Greek: { fa: 'یونانی', ar: 'اليونانية' },
  Hebrew: { fa: 'عبری', ar: 'العبرية' },
  Swahili: { fa: 'سواحیلی', ar: 'السواحيلية' },
  Indonesian: { fa: 'اندونزیایی', ar: 'الإندونيسية' },
  Malay: { fa: 'مالایی', ar: 'الملايوية' },
  Thai: { fa: 'تایلندی', ar: 'التايلاندية' },
  Vietnamese: { fa: 'ویتنامی', ar: 'الفيتنامية' },
  Bengali: { fa: 'بنگالی', ar: 'البنغالية' },
  Punjabi: { fa: 'پنجابی', ar: 'البنجابية' },
  Pashto: { fa: 'پشتو', ar: 'البشتوية' },
  Kurdish: { fa: 'کردی', ar: 'الكردية' },
  Azerbaijani: { fa: 'ترکی آذربایجانی', ar: 'الأذربيجانية' },
  Armenian: { fa: 'ارمنی', ar: 'الأرمنية' },
  Georgian: { fa: 'گرجی', ar: 'الجورجية' },
  Ukrainian: { fa: 'اوکراینی', ar: 'الأوكرانية' },
  Catalan: { fa: 'کاتالان', ar: 'الكتالونية' },
  Croatian: { fa: 'کرواتی', ar: 'الكرواتية' },
  Serbian: { fa: 'صربی', ar: 'الصربية' },
  Slovak: { fa: 'اسلواکی', ar: 'السلوفاكية' },
  Bulgarian: { fa: 'بلغاری', ar: 'البلغارية' },
  Slovenian: { fa: 'اسلوونیایی', ar: 'السلوفينية' },
  Estonian: { fa: 'استونیایی', ar: 'الإستونية' },
  Latvian: { fa: 'لتونیایی', ar: 'اللاتفية' },
  Lithuanian: { fa: 'لیتوانیایی', ar: 'الليتوانية' },
  Albanian: { fa: 'آلبانیایی', ar: 'الألبانية' },
  Macedonian: { fa: 'مقدونی', ar: 'المقدونية' },
  Maltese: { fa: 'مالتی', ar: 'المالطية' },
  Icelandic: { fa: 'ایسلندی', ar: 'الآيسلندية' },
  Welsh: { fa: 'ولزی', ar: 'الويلزية' },
  Irish: { fa: 'ایرلندی', ar: 'الأيرلندية' },
  Basque: { fa: 'باسکی', ar: 'الباسكية' },
};

export const allLanguages = [
  'Portuguese',
  'Russian',
  'Japanese',
  'Korean',
  'Chinese (Mandarin)',
  'Chinese (Cantonese)',
  'Hindi',
  'Urdu',
  'Turkish',
  'Dutch',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Polish',
  'Czech',
  'Romanian',
  'Hungarian',
  'Greek',
  'Hebrew',
  'Swahili',
  'Indonesian',
  'Malay',
  'Thai',
  'Vietnamese',
  'Bengali',
  'Punjabi',
  'Pashto',
  'Kurdish',
  'Azerbaijani',
  'Armenian',
  'Georgian',
  'Ukrainian',
  'Catalan',
  'Croatian',
  'Serbian',
  'Slovak',
  'Bulgarian',
  'Slovenian',
  'Estonian',
  'Latvian',
  'Lithuanian',
  'Albanian',
  'Macedonian',
  'Maltese',
  'Icelandic',
  'Welsh',
  'Irish',
  'Basque',
];

export function parseLanguages(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(/[,،;؛·]/);

  const seen = new Set();
  return raw
    .map((language) => String(language || '').trim())
    .filter((language) => {
      if (!language) return false;
      const key = language.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function mergeLanguages(...lists) {
  return parseLanguages(lists.flatMap((list) => parseLanguages(list)));
}

export function toLanguageOptions(languages) {
  return parseLanguages(languages).map((language) => ({
    key: language,
    en: language,
    fa: languageLabels[language]?.fa || language,
    ar: languageLabels[language]?.ar || language,
  }));
}
