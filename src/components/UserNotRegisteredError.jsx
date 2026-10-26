import React from 'react';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

const UserNotRegisteredError = () => {
  const { lang, dir } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  return (
    <div dir={dir} className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{l('Access Restricted', 'دسترسی محدود شده است', 'الوصول مقيّد')}</h1>
          <p className="text-slate-600 mb-8">
            {l('You are not registered to use this application. Please contact the app administrator to request access.', 'برای استفاده از این برنامه ثبت‌نام نشده‌اید. برای درخواست دسترسی با مدیر برنامه تماس بگیرید.', 'لست مسجّلاً لاستخدام هذا التطبيق. يُرجى التواصل مع مسؤول التطبيق لطلب الوصول.')}
          </p>
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600">
            <p>{l('If you believe this is an error, you can:', 'اگر فکر می‌کنید اشتباهی رخ داده است:', 'إذا كنت تعتقد أن هذا خطأ، يمكنك:')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>{l('Verify you are logged in with the correct account', 'بررسی کنید که با حساب درست وارد شده‌اید.', 'تأكّد من تسجيل الدخول بالحساب الصحيح.')}</li>
              <li>{l('Contact the app administrator for access', 'برای دریافت دسترسی با مدیر برنامه تماس بگیرید.', 'تواصل مع مسؤول التطبيق للحصول على صلاحية الوصول.')}</li>
              <li>{l('Try logging out and back in again', 'از حساب خارج شوید و دوباره وارد شوید.', 'جرّب تسجيل الخروج ثم الدخول مجدداً.')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
