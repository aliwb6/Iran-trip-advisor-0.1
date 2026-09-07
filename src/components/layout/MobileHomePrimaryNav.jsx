import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { preloadRoute } from '@/lib/route-loaders';

export default function MobileHomePrimaryNav() {
  const { pathname } = useLocation();
  const { t, dir } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = pathname === '/';

  useEffect(() => {
    if (!isHome) return undefined;
    document.documentElement.classList.add('mobile-home-primary-nav-active');
    return () => {
      document.documentElement.classList.remove('mobile-home-primary-nav-active');
    };
  }, [isHome]);

  useEffect(() => {
    if (!isHome) setMenuOpen(false);
  }, [isHome, pathname]);

  if (!isHome) return null;

  const primaryLinks = [
    { path: '/tours', label: t('nav_tours') },
    { path: '/guides', label: t('nav_guides') },
    { path: '/agencies', label: t('nav_agencies') },
  ];

  const toggleExistingMobileMenu = () => {
    const menuButton = document.querySelector(
      '.public-site-shell > nav button[class~="lg:hidden"]'
    );
    if (menuButton instanceof HTMLButtonElement) {
      menuButton.click();
      setMenuOpen((open) => !open);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={toggleExistingMobileMenu}
        className="fixed top-[22px] end-5 z-[60] lg:hidden w-9 h-9 rounded-full border border-white/30 bg-black/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg"
        aria-label={t('nav_menu_aria')}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X className="w-4 h-4" /> : <MoreHorizontal className="w-5 h-5" />}
      </button>

      {!menuOpen && (
        <div
          dir={dir}
          className="fixed top-[72px] inset-x-0 z-[45] lg:hidden px-4"
        >
          <div className="mx-auto max-w-md grid grid-cols-3 gap-1 rounded-2xl border border-white/15 bg-black/30 backdrop-blur-xl p-1.5 shadow-xl">
            {primaryLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onPointerDown={() => preloadRoute(link.path)}
                onFocus={() => preloadRoute(link.path)}
                className="min-w-0 rounded-xl px-2 py-2.5 text-center font-body text-[11px] font-semibold text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors"
              >
                <span className="block truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
