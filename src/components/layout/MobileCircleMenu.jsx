import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Bot,
  BookOpen,
  Compass,
  Home,
  LayoutDashboard,
  LogOut,
  Map,
  Shield,
  UserRound,
  Users,
  X,
} from 'lucide-react';

const positions = [
  { x: -0.72, y: -0.70 },
  { x: 0, y: -1 },
  { x: 0.72, y: -0.70 },
  { x: 0.98, y: -0.05 },
  { x: 0.72, y: 0.64 },
  { x: 0, y: 0.92 },
  { x: -0.72, y: 0.64 },
  { x: -0.98, y: -0.05 },
];

export default function MobileCircleMenu({
  open,
  onClose,
  dir,
  isActive,
  t,
  isAdmin,
  isGuideOrAgency,
  isTourist,
  isAuthenticated,
  logout,
}) {
  const [radius, setRadius] = useState(116);

  useEffect(() => {
    if (!open) return undefined;

    const updateRadius = () => setRadius(window.innerWidth < 390 ? 105 : 126);
    updateRadius();
    window.addEventListener('resize', updateRadius);
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('resize', updateRadius);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  const items = useMemo(() => {
    const primaryItems = [
      { path: '/', label: t('nav_home'), icon: Home },
      { path: '/tours', label: t('nav_tours'), icon: Map },
      { path: '/guides', label: t('nav_guides'), icon: Users },
      { path: '/agencies', label: t('nav_agencies'), icon: Compass },
      { path: '/ai-assistant', label: t('nav_ai'), icon: Bot },
      { path: '/blog', label: t('nav_blog'), icon: BookOpen },
    ];

    if (isAdmin) primaryItems.push({ path: '/admin', label: t('nav_admin_panel'), icon: Shield });
    if (isGuideOrAgency) primaryItems.push({ path: '/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, external: true });
    if (isTourist || isAdmin || isGuideOrAgency) primaryItems.push({ path: '/profile', label: t('nav_profile'), icon: UserRound });

    return primaryItems.slice(0, positions.length);
  }, [isAdmin, isGuideOrAgency, isTourist, t]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          dir={dir}
          className="fixed inset-0 z-40 lg:hidden overflow-hidden bg-[hsl(var(--background)/0.96)] backdrop-blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-label={t('nav_menu_aria')}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-x-0 top-24 px-6 text-center">
            <motion.p
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="font-heading text-2xl font-medium text-foreground"
            >
              {t('nav_menu_aria')}
            </motion.p>
            <p className="mt-1 font-body text-sm text-muted-foreground">{t('circle_menu_choose')}</p>
          </div>

          <div className="absolute left-1/2 top-[53%] -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-[300px] w-[300px]">
              <div className="absolute left-1/2 top-1/2 h-[calc(var(--menu-radius)*2)] w-[calc(var(--menu-radius)*2)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15" style={{ '--menu-radius': `${radius}px` }} />
              <div className="absolute left-1/2 top-1/2 h-[calc(var(--menu-radius)*1.25)] w-[calc(var(--menu-radius)*1.25)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/15" style={{ '--menu-radius': `${radius}px` }} />

              {items.map((item, index) => {
                const Icon = item.icon;
                const position = positions[index];
                const active = isActive(item.path);
                const linkProps = item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

                return (
                  <motion.div
                    key={item.path}
                    className="absolute left-1/2 top-1/2"
                    initial={{ x: '-50%', y: '-50%', scale: 0.3, opacity: 0 }}
                    animate={{
                      x: `calc(-50% + ${position.x * radius}px)`,
                      y: `calc(-50% + ${position.y * radius}px)`,
                      scale: 1,
                      opacity: 1,
                    }}
                    exit={{ x: '-50%', y: '-50%', scale: 0.3, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 330, damping: 23, delay: 0.04 + index * 0.045 }}
                  >
                    <Link
                      to={item.path}
                      onClick={onClose}
                      {...linkProps}
                      aria-current={active ? 'page' : undefined}
                      className="group flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center outline-none"
                    >
                      <span className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-warm transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 ${
                        active
                          ? 'border-accent bg-accent text-white shadow-lg shadow-accent/25'
                          : 'border-border/60 bg-background/90 text-foreground group-hover:border-gold group-hover:text-accent'
                      }`}>
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className={`max-w-[86px] font-body text-[11px] font-medium leading-tight ${active ? 'text-accent' : 'text-foreground'}`}>
                        {item.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}

              <motion.button
                type="button"
                onClick={onClose}
                className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gold/50 bg-foreground text-background shadow-warm-lg outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ type: 'spring', stiffness: 300, damping: 19 }}
                aria-label={t('circle_menu_close')}
              >
                <X className="h-7 w-7" />
              </motion.button>
            </div>
          </div>

          {isAuthenticated ? (
            <motion.button
              type="button"
              onClick={() => { onClose(); logout(); }}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ delay: 0.35 }}
              className="absolute inset-x-0 bottom-8 mx-auto flex w-fit items-center gap-2 rounded-full border border-border/50 bg-background/70 px-4 py-2 font-body text-xs font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <LogOut className="h-4 w-4" />
              {t('auth_signout')}
            </motion.button>
          ) : (
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ delay: 0.35 }}
              className="absolute inset-x-0 bottom-8 mx-auto flex w-fit gap-2"
            >
              <Link to="/login" onClick={onClose} className="rounded-full border border-border/60 bg-background/70 px-4 py-2 font-body text-xs font-semibold text-foreground">
                {t('auth_signin')}
              </Link>
              <Link to="/signup" onClick={onClose} className="rounded-full bg-accent px-4 py-2 font-body text-xs font-semibold text-white">
                {t('auth_signup')}
              </Link>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
