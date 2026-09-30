import SmoothDropdown from '@/components/smooth-dropdown';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User, ClipboardList, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { avatarFor } from '@/lib/avatar';

// Tourist avatar menu, using the installed useLayouts Smooth Dropdown.
// Authentication, destinations, and the sign-out confirmation stay here.
//
// `isLight` reflects whether we're over a dark hero (home with transparent
// nav) so the trigger contrast can be tuned by the parent navbar.
export default function UserDropdown({ isLight = false }) {
  const { user, profile, logout } = useAuth();
  const { lang, dir } = useI18n();
  const { pathname } = useLocation();

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const triggerRef = useRef(null);

  const fullName = profile?.full_name || user?.user_metadata?.full_name || '';
  const email = profile?.email || user?.email || '';

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
    { id: '/profile', to: '/profile',          icon: User,          label: tx.manageProfile },
    { id: '/profile/requests', to: '/profile/requests', icon: ClipboardList, label: tx.myRequests },
    { id: '/profile/settings', to: '/profile/settings', icon: Settings,     label: tx.settings },
  ];

  const activeId = [...items].reverse().find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.id;

  return (
    <>
      <SmoothDropdown
        triggerRef={triggerRef}
        triggerLabel={tx.manageProfile}
        dir={dir}
        activeId={activeId}
        items={[
          ...items,
          { id: 'sign-out', icon: LogOut, label: tx.signOut, destructive: true, dividerBefore: true, onSelect: () => setConfirmingSignOut(true) },
        ]}
        triggerClassName={`flex items-center gap-2 px-1.5 py-1.5 rounded-full transition-colors ${isLight ? 'hover:bg-white/10' : 'hover:bg-muted/60'}`}
        trigger={(open) => (
          <>
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gold/40 bg-navy">
              <img decoding="async" loading="lazy" src={avatarFor(profile)} alt="" className="w-full h-full object-cover" />
            </div>
            <ChevronDown className={`hidden sm:block w-3.5 h-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''} ${isLight ? 'text-white/80' : 'text-muted-foreground'}`} />
          </>
        )}
        header={(
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
        )}
      />

      <Dialog open={confirmingSignOut} onOpenChange={setConfirmingSignOut}>
        <DialogContent
          className="bg-card border border-border/60 rounded-2xl p-6 w-[calc(100%-2rem)] max-w-sm shadow-2xl z-[60]"
          dir={dir}
          onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
        >
          <div className="w-11 h-11 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center mb-3">
            <LogOut className="w-5 h-5" />
          </div>
          <DialogTitle className="font-heading text-lg font-semibold text-foreground mb-1.5">{tx.confirmTitle}</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground leading-relaxed mb-5">{tx.confirmBody}</DialogDescription>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmingSignOut(false)}
              className="flex-1 py-2.5 rounded-xl border border-border/60 text-foreground text-sm font-medium hover:bg-muted/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {tx.cancel}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {tx.yesSignOut}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
