import { TransitionSurface } from '@/components/ui/TransitionSurface';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { User, ClipboardList, Settings, LogOut, X, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { avatarFor } from '@/lib/avatar';

// Navbar avatar dropdown — appears on click, slides down with a fade,
// and triggers a confirmation modal for Sign Out so the action isn't lost.
//
// `isLight` reflects whether we're over a dark hero (home with transparent
// nav) so the trigger contrast can be tuned by the parent navbar.
export default function UserDropdown({ isLight = false }) {
  const { user, profile, logout } = useAuth();
  const { lang } = useI18n();

  const [open, setOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const rootRef = useRef(null);

  const fullName = profile?.full_name || user?.user_metadata?.full_name || '';
  const email = profile?.email || user?.email || '';

  // Close on outside click + ESC
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tx = {
    manageProfile: lang === 'fa' ? 'مدیریت پروفایل' : lang === 'ar' ? 'إدارة الملف الشخصي' : 'Manage Profile',
    myRequests:    lang === 'fa' ? 'درخواست‌های من' : lang === 'ar' ? 'طلباتي' : 'My Requests',
    settings:      lang === 'fa' ? 'تنظیمات و حریم خصوصی' : lang === 'ar' ? 'الإعدادات والخصوصية' : 'Settings and Privacy',
    signOut:       lang === 'fa' ? 'خروج از حساب' : lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out',
    confirmTitle:  lang === 'fa' ? 'مطمئن هستی؟' : lang === 'ar' ? 'هل أنت متأكد؟' : 'Sign out of your account?',
    confirmBody:   lang === 'fa' ? 'برای ادامه باید دوباره وارد شوی.' : lang === 'ar' ? 'ستحتاج إلى تسجيل الدخول مرة أخرى.' : 'You will need to sign in again to access your profile and trips.',
    cancel:        lang === 'fa' ? 'لغو' : lang === 'ar' ? 'إلغاء' : 'Cancel',
    yesSignOut:    lang === 'fa' ? 'بله، خروج' : lang === 'ar' ? 'نعم، اخرج' : 'Yes, sign out',
  };

  const items = [
    { to: '/profile',          icon: User,          label: tx.manageProfile },
    { to: '/profile/requests', icon: ClipboardList, label: tx.myRequests },
    { to: '/profile/settings', icon: Settings,     label: tx.settings },
  ];

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 px-1.5 py-1.5 rounded-full transition-colors ${
            isLight ? 'hover:bg-white/10' : 'hover:bg-muted/60'
          }`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gold/40 bg-navy">
            <img decoding="async" loading="lazy" src={avatarFor(profile)} alt="" className="w-full h-full object-cover" />
          </div>
          <ChevronDown className={`hidden sm:block w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''} ${
            isLight ? 'text-white/80' : 'text-muted-foreground'
          }`} />
        </button>

        <AnimatePresence>
          {open && (
            <TransitionSurface kind="dropdown" data-origin="top-end"
              className="absolute end-0 mt-2 w-72 origin-top-end rounded-2xl bg-popover/95 backdrop-blur-2xl border border-border/60 shadow-2xl overflow-hidden z-50"
              role="menu"
            >
              {/* Identity block */}
              <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-card/90 to-card/40 border-b border-border/40">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold/50 flex-shrink-0">
                  <img decoding="async" loading="lazy" src={avatarFor(profile)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-body text-sm font-semibold text-foreground truncate">
                    {fullName || (lang === 'fa' ? 'مهمان' : lang === 'ar' ? 'ضيف' : 'Guest')}
                  </p>
                  <p className="font-body text-xs text-muted-foreground truncate">{email}</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors"
                    role="menuitem"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="border-t border-border/40 py-1.5">
                <button
                  onClick={() => { setOpen(false); setConfirmingSignOut(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  {tx.signOut}
                </button>
              </div>
            </TransitionSurface>
          )}
        </AnimatePresence>
      </div>

      {/* Sign-out confirmation modal */}
      <AnimatePresence>
        {confirmingSignOut && (
          <TransitionSurface kind="backdrop"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setConfirmingSignOut(false)}
          >
            <TransitionSurface kind="modal"
              className="bg-card border border-border/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
                  <LogOut className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setConfirmingSignOut(false)}
                  className="w-8 h-8 rounded-lg hover:bg-muted/60 text-muted-foreground flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-1.5">{tx.confirmTitle}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-5">{tx.confirmBody}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingSignOut(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border/60 text-foreground text-sm font-medium hover:bg-muted/40 transition"
                >
                  {tx.cancel}
                </button>
                <button
                  onClick={() => logout()}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition"
                >
                  {tx.yesSignOut}
                </button>
              </div>
            </TransitionSurface>
          </TransitionSurface>
        )}
      </AnimatePresence>
    </>
  );
}
