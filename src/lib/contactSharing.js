const DIGIT_MAP = new Map([
  ...'۰۱۲۳۴۵۶۷۸۹'.split('').map((char, index) => [char, String(index)]),
  ...'٠١٢٣٤٥٦٧٨٩'.split('').map((char, index) => [char, String(index)]),
]);

const NUMBER_WORDS = new Map([
  // English. Include common evasive spellings and compact teen numbers so
  // phrases such as "zero ... eleven" normalize to a real digit sequence.
  ['zero', '0'], ['ziro', '0'], ['oh', '0'],
  ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4'], ['five', '5'],
  ['six', '6'], ['seven', '7'], ['eight', '8'], ['nine', '9'],
  ['ten', '10'], ['eleven', '11'], ['twelve', '12'], ['thirteen', '13'],
  ['fourteen', '14'], ['fifteen', '15'], ['sixteen', '16'], ['seventeen', '17'],
  ['eighteen', '18'], ['nineteen', '19'],

  // Persian / Arabic digit words used by the site's audience.
  ['صفر', '0'],
  ['یک', '1'], ['يك', '1'], ['واحد', '1'],
  ['دو', '2'], ['اثنان', '2'], ['اثنين', '2'], ['اتنين', '2'],
  ['سه', '3'], ['ثلاثة', '3'], ['ثلاثه', '3'],
  ['چهار', '4'], ['اربعة', '4'], ['أربعة', '4'], ['اربعه', '4'],
  ['پنج', '5'], ['خمسة', '5'], ['خمسه', '5'],
  ['شش', '6'], ['ستة', '6'], ['سته', '6'],
  ['هفت', '7'], ['سبعة', '7'], ['سبعه', '7'],
  ['هشت', '8'], ['ثمانية', '8'], ['ثمانيه', '8'],
  ['نه', '9'], ['تسعة', '9'], ['تسعه', '9'],
]);

const SINGLE_ENGLISH_DIGIT_WORDS = [
  ['three', '3'], ['seven', '7'], ['eight', '8'], ['zero', '0'], ['ziro', '0'],
  ['four', '4'], ['five', '5'], ['nine', '9'], ['one', '1'], ['two', '2'],
  ['six', '6'], ['oh', '0'],
];

const NUMBER_CONNECTORS = new Set([
  'and', 'dash', 'hyphen', 'dot', 'space', 'plus',
  'و', 'فاصله', 'خط',
]);

export function normalizeContactText(value = '') {
  return String(value)
    .normalize('NFKC')
    .split('')
    .map(char => DIGIT_MAP.get(char) ?? char)
    .join('')
    .toLowerCase();
}

function expandConcatenatedEnglishDigits(token) {
  if (!/^[a-z]+$/.test(token) || token.length < 6) return null;

  const memo = new Map();
  const solve = (index) => {
    if (index === token.length) return '';
    if (memo.has(index)) return memo.get(index);

    for (const [word, digit] of SINGLE_ENGLISH_DIGIT_WORDS) {
      if (!token.startsWith(word, index)) continue;
      const rest = solve(index + word.length);
      if (rest !== null) {
        const value = `${digit}${rest}`;
        memo.set(index, value);
        return value;
      }
    }

    memo.set(index, null);
    return null;
  };

  return solve(0);
}

function numericExpansionForToken(token) {
  if (/^\d+$/.test(token)) return token;
  if (NUMBER_WORDS.has(token)) return NUMBER_WORDS.get(token);
  return expandConcatenatedEnglishDigits(token);
}

function containsObfuscatedPhone(text) {
  const tokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  let digitRun = '';
  let multiplier = 1;

  for (const token of tokens) {
    if (token === 'double' || token === 'دابل') {
      multiplier = 2;
      continue;
    }
    if (token === 'triple' || token === 'تریپل') {
      multiplier = 3;
      continue;
    }

    const expansion = numericExpansionForToken(token);
    if (expansion !== null) {
      digitRun += expansion.repeat(multiplier);
      multiplier = 1;
      if (digitRun.length >= 9) return true;
      continue;
    }

    if (NUMBER_CONNECTORS.has(token) && digitRun) {
      multiplier = 1;
      continue;
    }

    digitRun = '';
    multiplier = 1;
  }

  return false;
}

function containsObfuscatedPlatform(text) {
  // Separators between letters are allowed so "t e l e g r a m" and similar
  // variants cannot bypass the pre-payment rule.
  const spacedPlatform = /(?:^|[^a-z0-9])(?:t[\s._-]*e[\s._-]*l[\s._-]*e[\s._-]*g[\s._-]*r[\s._-]*a[\s._-]*m|w[\s._-]*h[\s._-]*a[\s._-]*t[\s._-]*s[\s._-]*a[\s._-]*p[\s._-]*p|i[\s._-]*n[\s._-]*s[\s._-]*t[\s._-]*a[\s._-]*g[\s._-]*r[\s._-]*a[\s._-]*m)(?:[^a-z0-9]|$)/i;
  if (spacedPlatform.test(text)) return true;

  // Short aliases are only considered contact-sharing cues when they are used
  // like an account identifier, avoiding broad false positives for "ig/wa/tg".
  return /(?:^|\s)(?:ig|tg|wa)\s*(?:id|user(?:name)?|handle|@|[:=])/i.test(text);
}

function containsSpacedHandle(text) {
  const cue = /(?:user\s*name|username|handle|my\s+id|my\s+user(?:name)?|آیدی|ايدي|شناسه)\s*(?:is\s*)?[:=_-]?\s*((?:[a-z0-9_][\s._-]*){4,})/iu;
  const match = text.match(cue);
  if (!match) return false;
  return (match[1].match(/[a-z0-9_]/gi) || []).length >= 4;
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
    test: text => /telegram|t\.me\/?|تلگرام/i.test(text)
      || /(?:^|[^a-z0-9])t[\s._-]*e[\s._-]*l[\s._-]*e[\s._-]*g[\s._-]*r[\s._-]*a[\s._-]*m(?:[^a-z0-9]|$)/i.test(text)
      || /(?:^|\s)tg\s*(?:id|user(?:name)?|handle|@|[:=])/i.test(text),
  },
  {
    label: 'WhatsApp',
    test: text => /whatsapp|wa\.me\/?|واتساپ|واتس\s*اپ/i.test(text)
      || /(?:^|[^a-z0-9])w[\s._-]*h[\s._-]*a[\s._-]*t[\s._-]*s[\s._-]*a[\s._-]*p[\s._-]*p(?:[^a-z0-9]|$)/i.test(text)
      || /(?:^|\s)wa\s*(?:id|user(?:name)?|handle|@|[:=])/i.test(text),
  },
  {
    label: 'Instagram',
    test: text => /instagram|(?:^|\s)insta(?:\s|:)|اینستاگرام|اینستا/i.test(text)
      || /(?:^|[^a-z0-9])i[\s._-]*n[\s._-]*s[\s._-]*t[\s._-]*a[\s._-]*g[\s._-]*r[\s._-]*a[\s._-]*m(?:[^a-z0-9]|$)/i.test(text)
      || /(?:^|\s)ig\s*(?:id|user(?:name)?|handle|@|[:=])/i.test(text),
  },
  {
    label: 'Messaging app',
    test: text => /signal|سیگنال|viber|وایبر|wechat|ویچت|skype|اسکایپ|messenger/i.test(text)
      || containsObfuscatedPlatform(text),
  },
  {
    label: 'Social handle',
    test: text => /(?:^|[\s\p{P}])@[a-z0-9_][a-z0-9_.]{2,}/iu.test(text)
      || containsSpacedHandle(text),
  },
  {
    label: 'Phone number',
    test: text => {
      const candidates = text.match(/\+?\d[\d\s().\-]{7,}\d/g) || [];
      return candidates.some(candidate => candidate.replace(/\D/g, '').length >= 9)
        || containsObfuscatedPhone(text);
    },
  },
];

export function detectContactSharing(value) {
  const text = normalizeContactText(value);
  if (!text.trim()) return [];
  return [...new Set(RULES.filter(rule => rule.test(text)).map(rule => rule.label))];
}

export function containsContactSharing(value) {
  return detectContactSharing(value).length > 0;
}
