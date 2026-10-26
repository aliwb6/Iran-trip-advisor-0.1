import { useState } from 'react';

export function useCustomTrip() {
  const [tripData, setTripData] = useState({
    destinations: '',
    duration: '',
    budget: '',
    groupSize: '',
    children: { hasChildren: false, count: 0, ages: [] },
    purpose: '',
    healthConsiderations: '',
    activityLevel: '',
    dietary: [],
    accommodation: [],
    pace: '',
    notes: ''
  });

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showTripBuilder, setShowTripBuilder] = useState(false);

  const questions = [
    {
      id: 'destinations',
      question: (lang) => lang === 'fa' ? 'کدام شهرها یا مناطق ایران می‌خواهید بازدید کنید؟' : lang === 'ar' ? 'أي المدن أو المناطق في إيران تود زيارتها؟' : 'Which cities or regions in Iran would you like to visit?',
      placeholder: (lang) => lang === 'fa' ? 'مثال: اصفهان، شیراز، یزد' : lang === 'ar' ? 'مثال: أصفهان، شيراز، يزد' : 'e.g., Isfahan, Shiraz, Yazd',
      type: 'text',
      required: true
    },
    {
      id: 'duration',
      question: (lang) => lang === 'fa' ? 'چند روز می‌خواهید سفر کنید؟' : lang === 'ar' ? 'كم يوم تود السفر؟' : 'How many days would you like to travel?',
      placeholder: (lang) => lang === 'fa' ? 'مثلاً: ۷' : lang === 'ar' ? 'مثلاً: 7' : 'e.g., 7',
      type: 'number',
      required: true
    },
    {
      id: 'budget',
      question: (lang) => lang === 'fa' ? 'بودجه شما برای هر نفر چقدر است؟' : lang === 'ar' ? 'ما ميزانيتك لكل شخص؟' : 'What\'s your budget per person?',
      placeholder: (lang) => lang === 'fa' ? 'مثلاً: ۱۰۰۰ دلار' : lang === 'ar' ? 'مثلاً: 1000 دولار' : 'e.g., $1000',
      type: 'text',
      required: true
    },
    {
      id: 'groupSize',
      question: (lang) => lang === 'fa' ? 'چند نفر سفر خواهید کرد؟' : lang === 'ar' ? 'كم عدد الأشخاص في المجموعة؟' : 'How many people will be traveling?',
      placeholder: (lang) => lang === 'fa' ? 'مثلاً: ۴' : lang === 'ar' ? 'مثلاً: 4' : 'e.g., 4',
      type: 'number',
      required: true
    },
    {
      id: 'children',
      question: (lang) => lang === 'fa' ? 'آیا کودکان (زیر 12 سال) در گروه شما وجود دارد؟' : lang === 'ar' ? 'هل هناك أطفال (أقل من 12 سنة) في المجموعة؟' : 'Will there be children (under 12) in your group?',
      placeholder: (lang) => lang === 'fa' ? 'بله یا خیر؛ اگر بله، تعداد و سنشان را بنویسید.' : lang === 'ar' ? 'نعم أم لا؛ إذا كانت الإجابة نعم، فاذكر العدد والأعمار.' : 'Yes/No, and if yes, how many and their ages?',
      type: 'text',
      required: false
    },
    {
      id: 'purpose',
      question: (lang) => lang === 'fa' ? 'دلیل اصلی سفر شما چیست؟' : lang === 'ar' ? 'ما السبب الرئيسي للسفر؟' : 'What\'s your main reason for traveling to Iran?',
      options: ['Cultural exploration', 'Historical sites', 'Natural landscapes', 'Photography', 'Food & cuisine', 'Spiritual journey', 'Adventure activities', 'Research/Education', 'Family vacation', 'Other'],
      type: 'select',
      required: true
    },
    {
      id: 'healthConsiderations',
      question: (lang) => lang === 'fa' ? 'آیا مسائل سلامتی یا نیازهای خاصی وجود دارد؟' : lang === 'ar' ? 'هل هناك أي مخاوف صحية أو احتياجات خاصة؟' : 'Are there any medical conditions or health concerns we should know about?',
      placeholder: (lang) => lang === 'fa' ? 'مثلاً: حساسیت، محدودیت حرکتی یا بیماری مزمن' : lang === 'ar' ? 'مثلاً: الحساسية أو صعوبات الحركة أو الأمراض المزمنة' : 'e.g., allergies, mobility issues, chronic conditions',
      type: 'text',
      required: false
    },
    {
      id: 'activityLevel',
      question: (lang) => lang === 'fa' ? 'سطح فعالیت ترجیحی شما چیست؟' : lang === 'ar' ? 'ما مستوى النشاط المفضل لديك؟' : 'What\'s your preferred activity level?',
      options: ['Light', 'Moderate', 'Adventurous', 'Mixed'],
      type: 'select',
      required: true
    },
    {
      id: 'dietary',
      question: (lang) => lang === 'fa' ? 'آیا محدودیت یا ترجیح غذایی دارید؟' : lang === 'ar' ? 'هل لديك تفضيلات أو قيود غذائية؟' : 'Any dietary preferences or restrictions?',
      options: ['No restrictions', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Allergies', 'Other'],
      type: 'select',
      required: false
    },
    {
      id: 'accommodation',
      question: (lang) => lang === 'fa' ? 'نوع اقامت ترجیح شده شما کدام است؟' : lang === 'ar' ? 'ما نوع الإقامة المفضل؟' : 'What type of accommodation do you prefer?',
      options: ['Luxury hotels', 'Mid-range hotels', 'Budget hostels', 'Traditional guesthouses', 'Eco-lodges', 'Mix of different types'],
      type: 'select',
      required: true
    },
    {
      id: 'pace',
      question: (lang) => lang === 'fa' ? 'چگونه دوست دارید سفر کنید؟' : lang === 'ar' ? 'كيف تفضل السفر؟' : 'How do you like to travel?',
      options: ['Fast-paced', 'Relaxed', 'Balanced'],
      type: 'select',
      required: true
    },
    {
      id: 'notes',
      question: (lang) => lang === 'fa' ? 'آیا چیز دیگری می‌خواهید ما بدانیم؟' : lang === 'ar' ? 'هل هناك أي شيء آخر تود أن تخبرنا به؟' : 'Is there anything else you\'d like us to know?',
      placeholder: (lang) => lang === 'fa' ? 'درخواست‌های ویژه یا مواردی که باید بدانیم' : lang === 'ar' ? 'طلبات خاصة أو أمور تود أن نعرفها' : 'Special requests or concerns',
      type: 'text',
      required: false
    }
  ];

  const updateTripData = (questionId, value) => {
    setTripData(prev => ({ ...prev, [questionId]: value }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setShowPreview(true);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const resetTrip = () => {
    setTripData({
      destinations: '',
      duration: '',
      budget: '',
      groupSize: '',
      children: { hasChildren: false, count: 0, ages: [] },
      purpose: '',
      healthConsiderations: '',
      activityLevel: '',
      dietary: [],
      accommodation: [],
      pace: '',
      notes: ''
    });
    setCurrentQuestion(0);
    setShowPreview(false);
    setShowTripBuilder(false);
  };

  const generateTripObject = () => {
    return {
      id: 'trip-' + Date.now(),
      createdAt: new Date(),
      status: 'draft',
      title: `${tripData.duration}-day trip to ${tripData.destinations}`,
      destinations: tripData.destinations.split(',').map(d => d.trim()),
      duration: parseInt(tripData.duration),
      budget: {
        amount: parseFloat(tripData.budget.replace(/[^0-9]/g, '')),
        currency: tripData.budget.includes('$') ? 'USD' : 'IRR',
        perPerson: true
      },
      groupSize: parseInt(tripData.groupSize),
      children: tripData.children,
      purpose: tripData.purpose,
      activityLevel: tripData.activityLevel,
      pace: tripData.pace,
      accommodation: Array.isArray(tripData.accommodation) ? tripData.accommodation : [tripData.accommodation],
      dietary: Array.isArray(tripData.dietary) ? tripData.dietary : [tripData.dietary],
      healthConsiderations: {
        conditions: tripData.healthConsiderations,
        hasSpecialNeeds: !!tripData.healthConsiderations
      },
      notes: tripData.notes
    };
  };

  return {
    tripData,
    updateTripData,
    currentQuestion,
    questions,
    nextQuestion,
    prevQuestion,
    resetTrip,
    showPreview,
    setShowPreview,
    showTripBuilder,
    setShowTripBuilder,
    generateTripObject
  };
}
