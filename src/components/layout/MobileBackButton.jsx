import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';

const HOME_PATH = '/';

export default function MobileBackButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { dir, lang } = useI18n();

  // Chat already has its own persistent back control in its header.
  if (pathname === HOME_PATH || pathname.startsWith('/chat/')) return null;

  const label = lang === 'fa' ? 'بازگشت' : lang === 'ar' ? 'عودة' : 'Back';
  const Icon = dir === 'rtl' ? ChevronRight : ChevronLeft;

  const goBack = () => {
    // React Router sets an index on in-app history entries. A direct link has
    // no prior app entry, so safely return to the homepage instead.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(HOME_PATH);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="mobile-back-button lg:hidden"
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
