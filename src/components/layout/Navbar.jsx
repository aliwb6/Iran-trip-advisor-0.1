import { lazy, Suspense, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/supabaseClient';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import { Menu, X, Compass, ArrowRight, LogOut, LayoutDashboard, Shield, User } from 'lucide-react';
import { preloadRoute } from '@/lib/route-loaders';

const UserDropdown = lazy(() => import('@/components/navbar/UserDropdown'));

export default function Navbar() {
  const { t, lang, dir } = useI18n();
  const { isAuthenticated, isLoadingAuth, user, profile, logout } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openRequestCount, setOpenRequestCount] = useState(0);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Role derivations must come first — used by navLinks below
  const role = profile?.role || user?.user_metadata?.role;
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isGuideOrAgency = role === 'guide' || role === 'agency';
  const isTourist = role === 'tourist' || role === 'traveler';

  useEffect(() => {
    if (!isAuthenticated || !isGuideOrAgency) {
      setOpenRequestCount(0);
      return;
    }
    let cancelled = false;

    async function fetchCount() {
      try {
        const { data, error } = await supabase
          .from('trip_requests')
          .select('id, expires_at, proposals_count, max_proposals')
          .in('status', ['open', 'active', 'pending']);
        if (error) throw error;
        const availableCount = (data || []).filter(request => {
          const expired = request.expires_at && new Date(request.expires_at).getTime() <= Date.now();
          const max = Math.max(1, Number(request.max_proposals) || 5);
          return !expired && (Number(request.proposals_count) || 0) < max;
        }).length;
        if (!cancelled) setOpenRequestCount(availableCount);
      } catch (e) {
        // silently fail
      }
    }

    fetchCount();

    const channel = supabase
      .channel('nav-trip-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_requests',
      }, fetchCount)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isGuideOrAgency]);

  const baseLinks = [
    { path: '/tours', label: t('nav_tours') },
    { path: '/guides', label: t('nav_guides') },
    { path: '/agencies', label: t('nav_agencies') },
    { path: '/ai-assistant', label: t('nav_ai') },
    { path: '/blog', label: t('nav_blog') },
  ];

  const navLinks = [...baseLinks];

  const isActive = (path) => location.pathname === path;
  const isHome = location.pathname === '/';
  const isLight = !scrolled && isHome;

  const fullName = profile?.full_name || user?.user_metadata?.full_name || '';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <>
      <nav
        dir={dir}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-background/85 backdrop-blur-2xl border-b border-border/40 shadow-warm py-0'
            : isHome ? 'bg-transparent py-2' : 'bg-background/60 backdrop-blur-xl py-1'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16 lg:h-[70px]">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full bg-accent/15 group-hover:bg-accent/25 transition-colors" />
                <div className="absolute inset-0 rounded-full border border-gold/50 group-hover:border-gold transition-colors" />
                <Compass className="absolute inset-0 m-auto w-4 h-4 text-accent" />
              </div>
              <div className="flex flex-col leading-none">
                <span className={`font-heading text-base font-semibold tracking-wide transition-colors ${
                  isLight ? 'text-white' : 'text-foreground'
                }`}>Iran Trip Advisor</span>
                <span className="font-body text-[9px] uppercase tracking-[0.18em] text-gold/80">{t('brand_tagline')}</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onMouseEnter={() => preloadRoute(link.path)}
                  onFocus={() => preloadRoute(link.path)}
                  className={`relative px-3.5 py-2 text-[13px] font-body font-medium rounded-full transition-all duration-300 ${
                    link.path === '/tours'
                      ? 'border border-border/70 bg-secondary/40 hover:bg-secondary/60 hover:border-border text-black hover:text-black'
                      : isActive(link.path)
                        ? 'text-accent'
                        : isLight
                          ? 'text-white/80 hover:text-white'
                          : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.label}
                  {isActive(link.path) && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />
                  )}
                </Link>
              ))}

              {/* Find Jobs — special highlighted link for guides/agencies */}
              {isGuideOrAgency && (
                <div className="relative inline-flex" data-testid="find-jobs-wrapper">
                  <Link
                    to="/dashboard/requests"
                    onMouseEnter={() => preloadRoute('/dashboard')}
                    onFocus={() => preloadRoute('/dashboard')}
                    className={`flex items-center px-3.5 py-2 text-[13px] font-body font-bold rounded-lg transition-all duration-300 ${
                      isActive('/dashboard/requests')
                        ? 'bg-accent text-white'
                        : isLight
                          ? 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
                          : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
                    }`}
                  >
                    Find Jobs
                  </Link>
                  {openRequestCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        minWidth: '18px',
                        height: '18px',
                        borderRadius: '999px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        zIndex: 50,
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 2px var(--background)',
                        lineHeight: 1,
                      }}
                    >
                      {openRequestCount > 99 ? '99+' : openRequestCount}
                    </span>
                  )}
                </div>
              )}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
                <NotificationBell isLight={isLight} />
              </div>

              {/* Auth buttons — desktop */}
              {!isLoadingAuth && (
                isAuthenticated ? (
                  <div className="hidden lg:flex items-center gap-1.5">
                    {/* Admin Panel — admin only */}
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onMouseEnter={() => preloadRoute('/admin')}
                        onFocus={() => preloadRoute('/admin')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-all ${
                          isLight
                            ? 'bg-white/10 text-white hover:bg-white/20'
                            : 'bg-muted/60 text-foreground hover:bg-muted'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {t('nav_admin_panel')}
                      </Link>
                    )}
                    {/* Dashboard — guide/agency only */}
                    {isGuideOrAgency && (
                      <Link
                        to="/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        onMouseEnter={() => preloadRoute('/dashboard')}
                        onFocus={() => preloadRoute('/dashboard')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-all ${
                          isLight
                            ? 'bg-white/10 text-white hover:bg-white/20'
                            : 'bg-muted/60 text-foreground hover:bg-muted'
                        }`}
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        {t('nav_dashboard')}
                      </Link>
                    )}

                    {/* Traveler: avatar dropdown with Profile / Bookings / Requests / Settings / Sign out */}
                    {isTourist && (
                      <Suspense fallback={null}>
                        <UserDropdown isLight={isLight} />
                      </Suspense>
                    )}

                    {/* Admin/guide still need a quick sign-out */}
                    {!isTourist && (
                      <button
                        onClick={() => logout()}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          isLight
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                        title={t('auth_signout')}
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="hidden lg:flex items-center gap-2">
                    <Link
                      to="/login"
                      onMouseEnter={() => preloadRoute('/login')}
                      onFocus={() => preloadRoute('/login')}
                      className={`px-4 py-2 rounded-full text-xs font-body font-medium border transition-all ${
                        isLight
                          ? 'border-white/40 text-white hover:bg-white/10'
                          : 'border-border/60 text-foreground hover:bg-muted'
                      }`}
                    >
                      {t('auth_signin')}
                    </Link>
                    <Link
                      to="/signup"
                      onMouseEnter={() => preloadRoute('/signup')}
                      onFocus={() => preloadRoute('/signup')}
                      className="px-4 py-2 rounded-full text-xs font-body font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
                      {t('auth_signup')}
                    </Link>
                  </div>
                )
              )}

              {/* Hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className={`lg:hidden w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                  isLight
                    ? 'border-white/30 text-white bg-white/10'
                    : 'border-border/60 bg-background/60 text-foreground'
                }`}
                aria-label={t('nav_menu_aria')}
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
          <div
            dir={dir}
            className="fixed inset-0 z-40 bg-background/97 backdrop-blur-2xl lg:hidden overflow-y-auto"
          >
            <div className="pt-20 pb-10 px-6">
              {/* Nav links */}
              <div className="space-y-1 mb-8">
                {[{ path: '/', label: t('nav_home') }, ...navLinks].map((link) => (
                  <div
                    key={link.path}
                  >
                    <Link
                      to={link.path}
                      className={`flex items-center justify-between py-4 border-b border-border/20 group ${
                        isActive(link.path) ? 'text-accent' : 'text-foreground'
                      }`}
                    >
                      <span className="font-heading text-2xl font-light">{link.label}</span>
                      <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-all ${
                        dir === 'rtl' ? 'rotate-180' : ''
                      } ${isActive(link.path) ? 'opacity-100 text-accent' : ''}`} />
                    </Link>
                  </div>
                ))}

                {/* Find Jobs — mobile, guides/agencies only */}
                {isGuideOrAgency && (
                  <div
                    className="relative"
                  >
                    <Link
                      to="/dashboard/requests"
                      className="flex items-center justify-between py-4 border-b border-border/20 group text-accent"
                    >
                      <span className="font-heading text-2xl font-semibold">Find Jobs</span>
                      <ArrowRight className={`w-4 h-4 opacity-100 text-accent ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                    </Link>
                    {openRequestCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '-10px',
                          minWidth: '22px',
                          height: '22px',
                          borderRadius: '999px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          zIndex: 50,
                          pointerEvents: 'none',
                          boxShadow: '0 0 0 2px var(--background)',
                          lineHeight: 1,
                        }}
                      >
                        {openRequestCount > 99 ? '99+' : openRequestCount}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Notification Bell — mobile */}
              <div className="flex justify-center mb-4">
                <NotificationBell isLight={false} />
              </div>

              {/* Mobile auth section */}
              {!isLoadingAuth && (
                isAuthenticated ? (
                  <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-muted/50 border border-border/30">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <span className="font-body text-sm font-bold text-white">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-foreground truncate">{fullName || t('common_user')}</p>
                      <p className="font-body text-xs text-muted-foreground capitalize">{role || t('role_traveler')}</p>
                    </div>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/50 font-body text-xs font-medium text-foreground hover:bg-muted/50 transition"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {t('nav_admin_panel')}
                      </Link>
                    )}
                    {isGuideOrAgency && (
                      <Link
                        to="/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white font-body text-xs font-medium"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        {t('nav_dashboard')}
                      </Link>
                    )}
                    {isTourist && (
                      <Link
                        to="/profile"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white font-body text-xs font-medium"
                      >
                        <User className="w-3.5 h-3.5" />
                        {t('nav_profile')}
                      </Link>
                    )}
                    <button
                      onClick={() => logout()}
                      className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition"
                      title={t('auth_signout')}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 mb-6">
                    <Link
                      to="/login"
                      className="flex-1 text-center py-3 rounded-xl border border-border/60 font-body text-sm font-medium text-foreground hover:bg-muted/50 transition"
                    >
                      {t('auth_signin')}
                    </Link>
                    <Link
                      to="/signup"
                      className="flex-1 text-center py-3 rounded-xl bg-accent font-body text-sm font-semibold text-white hover:bg-accent/90 transition"
                    >
                      {t('auth_signup')}
                    </Link>
                  </div>
                )
              )}

              {/* Mobile controls */}
              <div className="flex items-center gap-3 pt-2">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </div>
          </div>
      )}
    </>
  );
}
