export const MAX_SPECIAL_ABILITY_LENGTH = 80;

export const PROVIDER_SPECIAL_ABILITY_OPTIONS = [
  { value: 'First Aid', en: 'First Aid', fa: 'کمک‌های اولیه', ar: 'الإسعافات الأولية' },
  { value: 'Photography', en: 'Photography', fa: 'عکاسی', ar: 'التصوير' },
  { value: 'Mountain Guiding', en: 'Mountain Guiding', fa: 'راهنمایی کوهستان', ar: 'الإرشاد الجبلي' },
  { value: 'Desert Driving', en: 'Desert Driving', fa: 'رانندگی در کویر', ar: 'القيادة في الصحراء' },
  { value: 'Family & Kids', en: 'Family & Kids', fa: 'خانواده و کودکان', ar: 'العائلات والأطفال' },
  { value: 'Culinary Expertise', en: 'Culinary Expertise', fa: 'تخصص آشپزی', ar: 'خبرة الطهي' },
  { value: 'Accessibility Assistance', en: 'Accessibility Assistance', fa: 'کمک به دسترس‌پذیری', ar: 'مساعدة إمكانية الوصول' },
  { value: 'Language Interpretation', en: 'Language Interpretation', fa: 'ترجمه شفاهی', ar: 'الترجمة الشفوية' },
];

export function normalizeProviderAbilities(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value.reduce((abilities, item) => {
    if (typeof item !== 'string') return abilities;
    const ability = item.trim().slice(0, MAX_SPECIAL_ABILITY_LENGTH);
    const key = ability.toLocaleLowerCase();
    if (!key || seen.has(key)) return abilities;
    seen.add(key);
    abilities.push(ability);
    return abilities;
  }, []);
}

export function addProviderAbility(current, rawAbility) {
  return normalizeProviderAbilities([...(Array.isArray(current) ? current : []), rawAbility]);
}

export function getProviderAbilityLabel(value, lang) {
  const option = PROVIDER_SPECIAL_ABILITY_OPTIONS.find(item => item.value === value);
  return option?.[lang] || option?.en || value;
}
