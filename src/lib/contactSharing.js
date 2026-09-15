const DIGIT_MAP = new Map([
  ...'۰۱۲۳۴۵۶۷۸۹'.split('').map((char, index) => [char, String(index)]),
  ...'٠١٢٣٤٥٦٧٨٩'.split('').map((char, index) => [char, String(index)]),
]);

export function normalizeContactText(value = '') {
  return String(value)
    .split('')
    .map(char => DIGIT_MAP.get(char) ?? char)
    .join('')
    .toLowerCase();
}

const RULES = [
  {
    label: 'Email',
    test: text => /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i.test(text)
      || /[a-z0-9._%+\-]+\s+(?:at|\(at\)|\[at\])\s+[a-z0-9.\-]+(?:\.[a-z]{2,}|\s+(?:dot|\(dot\)|\[dot\])\s+[a-z]{2,})/i.test(text),
  },
  {
    label: 'External link',
    test: text => /(?:https?:\/\/|www\.)\S+/i.test(text)
      || /[a-z0-9][a-z0-9.\-]+\.(?:com|net|org|ir|io|me|co|info|biz|app|travel|tour|site)(?:\/|\s|$)/i.test(text),
  },
  {
    label: 'Telegram',
    test: text => /telegram|t\.me\/|تلگرام/i.test(text),
  },
  {
    label: 'WhatsApp',
    test: text => /whatsapp|wa\.me\/|واتساپ|واتس\s*اپ/i.test(text),
  },
  {
    label: 'Instagram',
    test: text => /instagram|(?:^|\s)insta(?:\s|:)|اینستاگرام|اینستا/i.test(text),
  },
  {
    label: 'Messaging app',
    test: text => /signal|سیگنال|viber|وایبر|wechat|ویچت|skype|اسکایپ|messenger/i.test(text),
  },
  {
    label: 'Social handle',
    test: text => /(?:^|[\s\p{P}])@[a-z0-9_][a-z0-9_.]{2,}/iu.test(text),
  },
  {
    label: 'Phone number',
    test: text => {
      const candidates = text.match(/\+?\d[\d\s().\-]{7,}\d/g) || [];
      return candidates.some(candidate => candidate.replace(/\D/g, '').length >= 9);
    },
  },
];

export function detectContactSharing(value) {
  const text = normalizeContactText(value);
  if (!text.trim()) return [];
  return RULES.filter(rule => rule.test(text)).map(rule => rule.label);
}

export function containsContactSharing(value) {
  return detectContactSharing(value).length > 0;
}
