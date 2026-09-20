import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Compass, FileText, LogIn, Menu, UserRound, UserPlus, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { useAuth } from '@/lib/AuthContext';
import { preloadRoute } from '@/lib/route-loaders';

const itemMotion = {
  hidden: { opacity: 0, scale: 0.45, x: 0, y: 0 },
  visible: (position) => ({ opacity: 1, scale: 1, x: position.x, y: position.y, transition: { type: 'spring', stiffness: 420, damping: 27, delay: position.delay } }),
  exit: { opacity: 0, scale: 0.45, x: 0, y: 0, transition: { duration: 0.16 } },
};

export default function MobileHomePrimaryNav() {
  const { pathname } = useLocation();
  const { t, dir } = useI18n();
  const { isAuthenticated, profile, user } = useAuth();
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

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  if (!isHome) return null;

  const role = profile?.role || user?.user_metadata?.role;
  const isProvider = role === 'guide' || role === 'agency';
  const accountPath = role === 'admin' ? '/admin' : isProvider ? '/dashboard' : '/profile';
  const accountLabel = role === 'admin' ? t('nav_admin_panel') : isProvider ? t('nav_dashboard') : t('nav_profile');

  // The buttons fan downward from the trigger so every target remains reachable on a phone.
  const items = [
    { path: '/', label: t('nav_home'), icon: Compass, position: { x: -88, y: 84, delay: 0.02 } },
    { path: '/ai-assistant', label: t('nav_ai'), icon: Bot, position: { x: -170, y: 146, delay: 0.05 } },
    { path: '/blog', label: t('nav_blog'), icon: FileText, position: { x: -199, y: 240, delay: 0.08 } },
    isAuthenticated
      ? { path: accountPath, label: accountLabel, icon: UserRound, position: { x: -118, y: 320, delay: 0.11 } }
      : { path: '/login', label: t('auth_signin'), icon: LogIn, position: { x: -118, y: 320, delay: 0.11 } },
    !isAuthenticated && { path: '/signup', label: t('auth_signup'), icon: UserPlus, position: { x: -20, y: 341, delay: 0.14 }, accent: true },
  ].filter(Boolean);

  const primaryLinks = [
    { path: '/tours', label: t('nav_tours') },
    { path: '/guides', label: t('nav_guides') },
    { path: '/agencies', label: t('nav_agencies') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className={`fixed top-[22px] end-5 z-[75] lg:hidden grid h-10 w-10 place-items-center rounded-full border shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${menuOpen ? 'border-gold/70 bg-[hsl(222,55%,11%)] text-gold shadow-black/40' : 'border-white/35 bg-[hsl(222,55%,11%)] text-white shadow-black/35'}`}
        aria-label={t('nav_menu_aria')}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            dir={dir}
            className="fixed inset-0 z-[70] lg:hidden bg-[linear-gradient(155deg,hsl(222,55%,11%)_0%,hsl(222,48%,15%)_55%,hsl(222,42%,10%)_100%)]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => setMenuOpen(false)}
          >
            <div className="absolute top-5 start-5 max-w-[210px] text-white">
              <p className="font-heading text-base font-semibold tracking-wide">Iran Trip Advisor</p>
              <p className="mt-1 font-body text-[10px] uppercase tracking-[0.18em] text-gold">{t('brand_tagline')}</p>
            </div>
            <div className="absolute top-[42px] end-[40px]" onClick={(event) => event.stopPropagation()}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.path}
                    className="absolute end-0 top-0"
                    custom={{ ...item.position, x: dir === 'rtl' ? -item.position.x : item.position.x }}
                    variants={itemMotion}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Link
                      to={item.path}
                      onPointerDown={() => preloadRoute(item.path)}
                      onClick={() => setMenuOpen(false)}
                      className={`group flex min-w-[116px] items-center gap-2.5 rounded-full border px-3 py-2.5 shadow-xl transition-transform active:scale-95 ${item.accent ? 'border-accent bg-accent text-white' : 'border-white/15 bg-[hsl(222,45%,19%)] text-white hover:bg-[hsl(222,45%,23%)]'}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${item.accent ? 'bg-white/15' : 'bg-gold/15 text-gold'}`}><Icon className="h-4 w-4" /></span>
                      <span className="whitespace-nowrap font-body text-xs font-semibold">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            <p className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] inset-x-5 text-center font-body text-xs text-white/55">{t('nav_menu_aria')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!menuOpen && (
        <div
          dir={dir}
          className="fixed top-[72px] inset-x-0 z-[45] lg:hidden px-4"
        >
          <div className="mx-auto max-w-md grid grid-cols-3 gap-1 rounded-2xl border border-white/15 bg-[hsl(222,55%,11%)] p-1.5 shadow-xl shadow-black/25">
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
