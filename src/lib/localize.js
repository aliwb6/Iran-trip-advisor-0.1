// Keep the English source visible beside its Persian and Arabic equivalents.
export function localize(lang, en, fa, ar) {
  return lang === 'fa' ? fa : lang === 'ar' ? ar : en;
}

const englishRegions = new Intl.DisplayNames('en', { type: 'region' });
const translatedRegions = {
  fa: new Intl.DisplayNames('fa', { type: 'region' }),
  ar: new Intl.DisplayNames('ar', { type: 'region' }),
};
const regionCodes = new Map();
for (let first = 65; first <= 90; first += 1) {
  for (let second = 65; second <= 90; second += 1) {
    const code = String.fromCharCode(first, second);
    const name = englishRegions.of(code);
    if (name !== code) regionCodes.set(name, code);
  }
}
regionCodes.set('Czech Republic', 'CZ');
regionCodes.set('Turkey', 'TR');

export function localizeCountry(name, lang) {
  if (lang === 'en') return name;
  const code = regionCodes.get(name);
  return code ? translatedRegions[lang]?.of(code) || name : name;
}

export function localizePriceBasis(value, lang) {
  const labels = {
    per_person: ['per person', 'به‌ازای هر نفر', 'لكل شخص'],
    entire_group: ['entire group', 'برای کل گروه', 'للمجموعة كاملة'],
    per_day: ['per day', 'در روز', 'لليوم الواحد'],
    entire_trip: ['entire trip', 'برای کل سفر', 'للرحلة كاملة'],
  };
  const match = labels[value];
  return match ? localize(lang, ...match) : String(value || '').replace(/_/g, ' ');
}

export function localizeBookingStatus(value, lang) {
  const labels = {
    pending: ['Pending', 'در انتظار', 'قيد الانتظار'],
    accepted: ['Accepted', 'پذیرفته‌شده', 'مقبول'],
    selected: ['Selected', 'انتخاب‌شده', 'مختار'],
    rejected: ['Rejected', 'ردشده', 'مرفوض'],
    chatting: ['In discussion', 'در حال گفت‌وگو', 'قيد النقاش'],
    finalized: ['Booked', 'رزروشده', 'محجوز'],
    inactive: ['Inactive', 'غیرفعال', 'غير نشط'],
    approved: ['Approved', 'تأییدشده', 'موافَق عليه'],
    published: ['Published', 'منتشرشده', 'منشور'],
    pending_review: ['Pending Review', 'در انتظار بررسی', 'بانتظار المراجعة'],
    draft: ['Draft', 'پیش‌نویس', 'مسودة'],
    open: ['Open', 'باز', 'مفتوح'],
    active: ['Active', 'فعال', 'نشط'],
    waiting: ['Waiting', 'در انتظار', 'قيد الانتظار'],
    matched: ['Matched', 'هماهنگ‌شده', 'تمت المطابقة'],
    proposals_ready: ['Choose a Guide', 'انتخاب راهنما', 'اختر مرشداً'],
    received: ['Proposals Received', 'پیشنهاد دریافت شده', 'وصلت عروض'],
    expired: ['Expired', 'منقضی‌شده', 'منتهية الصلاحية'],
    confirmed: ['Confirmed', 'تأییدشده', 'مؤكّد'],
    booked: ['Booked', 'رزروشده', 'محجوز'],
    closed: ['Closed', 'بسته‌شده', 'مغلق'],
    completed: ['Completed', 'تکمیل‌شده', 'مكتمل'],
    cancelled: ['Cancelled', 'لغوشده', 'ملغى'],
    deposit_paid: ['Deposit paid', 'پیش‌پرداخت پرداخت‌شده', 'دُفع العربون'],
    paid: ['Paid', 'پرداخت‌شده', 'مدفوع'],
    unpaid: ['Unpaid', 'پرداخت‌نشده', 'غير مدفوع'],
    failed: ['Failed', 'ناموفق', 'فشلت العملية'],
    refunded: ['Refunded', 'بازپرداخت‌شده', 'مستردّ'],
  };
  const match = labels[value];
  return match ? localize(lang, ...match) : String(value || '').replace(/_/g, ' ');
}

export function localizeTripOption(value, lang) {
  const labels = {
    Transportation: ['Transportation', 'حمل‌ونقل', 'النقل'],
    Accommodation: ['Accommodation', 'اقامت', 'الإقامة'],
    'Private Tour': ['Private Tour', 'تور خصوصی', 'جولة خاصة'],
    'Group Tour': ['Group Tour', 'تور گروهی', 'جولة جماعية'],
    Active: ['Active', 'فعال و پرتحرک', 'نشطة'],
    'Local Living': ['Local Living', 'زندگی بومی', 'الحياة المحلية'],
    Nature: ['Nature', 'طبیعت‌گردی', 'الطبيعة'],
    Offbeat: ['Offbeat', 'مسیرهای کمتر شناخته‌شده', 'أماكن غير مألوفة'],
    Relaxing: ['Relaxing', 'آرامش‌بخش', 'مريحة'],
    'Air Tickets': ['Air Tickets', 'بلیط هواپیما', 'تذاكر الطيران'],
    'Train Tickets': ['Train Tickets', 'بلیط قطار', 'تذاكر القطار'],
    'Attraction Tickets': ['Attraction Tickets', 'بلیط جاذبه‌ها', 'تذاكر المعالم'],
    Visa: ['Visa', 'روادید', 'التأشيرة'],
    'Airport Transfer': ['Airport Transfer', 'ترانسفر فرودگاهی', 'النقل من المطار'],
    Architecture: ['Architecture', 'معماری', 'العمارة'],
    History: ['History', 'تاریخ', 'التاريخ'],
    Food: ['Food', 'خوراک', 'المأكولات'],
    Photography: ['Photography', 'عکاسی', 'التصوير'],
    Desert: ['Desert', 'کویر', 'الصحراء'],
    Luxury: ['Luxury', 'لوکس', 'فاخر'],
    Culture: ['Culture', 'فرهنگ', 'الثقافة'],
    Research: ['Research', 'پژوهش', 'البحث'],
    Art: ['Art', 'هنر', 'الفن'],
    'Private car': ['Private car', 'خودروی شخصی', 'سيارة خاصة'],
    'Minibus / Van': ['Minibus / Van', 'مینی‌بوس / ون', 'حافلة صغيرة / سيارة فان'],
    'Coach bus': ['Coach bus', 'اتوبوس', 'حافلة سياحية'],
    Motorcycle: ['Motorcycle', 'موتورسیکلت', 'دراجة نارية'],
    Bicycle: ['Bicycle', 'دوچرخه', 'دراجة هوائية'],
    Boat: ['Boat', 'قایق', 'قارب'],
    Train: ['Train', 'قطار', 'قطار'],
    'Domestic flight': ['Domestic flight', 'پرواز داخلی', 'رحلة جوية داخلية'],
    Budget: ['Budget', 'اقتصادی', 'اقتصادي'],
    'Mid-range': ['Mid-range', 'میان‌رده', 'متوسط التكلفة'],
    'Cultural exploration': ['Cultural exploration', 'آشنایی با فرهنگ', 'استكشاف الثقافة'],
    'Historical sites': ['Historical sites', 'بازدید از بناهای تاریخی', 'زيارة المواقع التاريخية'],
    'Natural landscapes': ['Natural landscapes', 'طبیعت‌گردی', 'المناظر الطبيعية'],
    'Food & cuisine': ['Food & cuisine', 'خوراک و آشپزی', 'الطعام وفنون الطهي'],
    'Spiritual journey': ['Spiritual journey', 'سفر معنوی', 'رحلة روحانية'],
    'Adventure activities': ['Adventure activities', 'فعالیت‌های ماجراجویانه', 'أنشطة المغامرة'],
    'Research/Education': ['Research/Education', 'پژوهش و آموزش', 'البحث والتعليم'],
    'Family vacation': ['Family vacation', 'تعطیلات خانوادگی', 'عطلة عائلية'],
    Other: ['Other', 'سایر', 'أخرى'],
    Light: ['Light', 'سبک', 'خفيف'],
    Moderate: ['Moderate', 'متوسط', 'متوسط'],
    Adventurous: ['Adventurous', 'ماجراجویانه', 'مغامرة'],
    Mixed: ['Mixed', 'ترکیبی', 'متنوع'],
    'No restrictions': ['No restrictions', 'بدون محدودیت', 'دون قيود'],
    Vegetarian: ['Vegetarian', 'گیاه‌خوار', 'نباتي'],
    Vegan: ['Vegan', 'وگان', 'نباتي صرف'],
    Halal: ['Halal', 'حلال', 'حلال'],
    Kosher: ['Kosher', 'کوشر', 'كوشير'],
    Allergies: ['Allergies', 'حساسیت غذایی', 'حساسية غذائية'],
    'Luxury hotels': ['Luxury hotels', 'هتل‌های لوکس', 'فنادق فاخرة'],
    'Mid-range hotels': ['Mid-range hotels', 'هتل‌های میان‌رده', 'فنادق متوسطة التكلفة'],
    'Budget hostels': ['Budget hostels', 'هاستل‌های اقتصادی', 'نُزل اقتصادية'],
    'Traditional guesthouses': ['Traditional guesthouses', 'مهمان‌خانه‌های سنتی', 'بيوت ضيافة تقليدية'],
    'Eco-lodges': ['Eco-lodges', 'اقامتگاه‌های بوم‌گردی', 'نُزل بيئية'],
    'Mix of different types': ['Mix of different types', 'ترکیبی از چند نوع اقامتگاه', 'مزيج من أنواع الإقامة'],
    'Fast-paced': ['Fast-paced', 'فشرده', 'وتيرة سريعة'],
    Relaxed: ['Relaxed', 'آرام', 'وتيرة مريحة'],
    Balanced: ['Balanced', 'متعادل', 'وتيرة متوازنة'],
  };
  if (Array.isArray(value)) return value.map(item => localizeTripOption(item, lang));
  const match = labels[value];
  return match ? localize(lang, ...match) : value;
}
