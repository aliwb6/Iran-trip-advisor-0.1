import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);
  const { profile, isAuthenticated } = useAuth();
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-7xl font-light text-muted-foreground/30">404</h1>
        <div>
          <h2 className="text-2xl font-medium text-foreground">{l('Page Not Found', 'صفحه پیدا نشد', 'لم يُعثر على الصفحة')}</h2>
          <p className="text-muted-foreground mt-2">
            {l('The page', 'صفحه', 'الصفحة')} "{pageName}" {l('could not be found.', 'پیدا نشد.', 'غير موجودة.')}
          </p>
        </div>
        {isAuthenticated && profile?.role === 'admin' && (
          <div className="p-4 bg-muted rounded-lg text-sm text-left">
            <p className="font-medium">{l('Admin Note: This page may not be implemented yet.', 'یادداشت مدیر: شاید این صفحه هنوز آماده نشده باشد.', 'ملاحظة للمسؤول: قد لا تكون هذه الصفحة متاحة بعد.')}</p>
          </div>
        )}
        <Link to="/" className="inline-block px-6 py-3 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent/90 transition-colors">
          {l('Back to Home', 'بازگشت به خانه', 'العودة إلى الرئيسية')}
        </Link>
      </div>
    </div>
  );
}
