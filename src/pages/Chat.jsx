import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { avatarFor } from '@/lib/avatar';
import { fetchParticipantProfile } from '@/api/participantProfiles';
import { selectPublicProfiles } from '@/lib/publicProfiles';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
  MessageCircle,
  Sparkles,
  Globe2,
  ChevronDown,
} from 'lucide-react';

// ── Brand tokens ────────────────────────────────────────────────
const C = {
  turq: '#0D8B85',
  turqSoft: '#3FC7C1',
  turqDeep: '#0A6864',
  teal: '#1A4A4A',
  white: '#FFFFFF',
  mist: '#F5FBFA',
  muted: '#7A8C8C',
  ink: '#0F2A2A',
  gold: '#C9972B',
};

// ── Persian Rub-el-Hizb pattern ─────────────────────────────────
function PersianPattern({ opacity = 0.06, color = C.turq, size = 72 }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full select-none pointer-events-none"
      aria-hidden="true"
      style={{ opacity }}
    >
      <defs>
        <pattern
          id="rub-el-hizb"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke={color} strokeWidth="0.9">
            <rect
              x={size * 0.22}
              y={size * 0.22}
              width={size * 0.56}
              height={size * 0.56}
            />
            <rect
              x={size * 0.22}
              y={size * 0.22}
              width={size * 0.56}
              height={size * 0.56}
              transform={`rotate(45 ${size / 2} ${size / 2})`}
            />
            <circle cx={size / 2} cy={size / 2} r="1.6" fill={color} />
          </g>
          <g fill={color}>
            <circle cx="0" cy="0" r="1" />
            <circle cx={size} cy="0" r="1" />
            <circle cx="0" cy={size} r="1" />
            <circle cx={size} cy={size} r="1" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rub-el-hizb)" />
    </svg>
  );
}

// ── Aria avatar mark ────────────────────────────────────────────
function AriaMark({ size = 36, pulse = false }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 28%, ${C.turqSoft}, ${C.turq} 60%, ${C.turqDeep})`,
          boxShadow: `0 4px 12px ${C.turq}40, inset 0 0 0 1px ${C.turqDeep}80`,
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <Sparkles
          className="text-[#FFFFFF]"
          style={{ width: size * 0.5, height: size * 0.5 }}
          strokeWidth={2.2}
        />
      </div>
      {pulse && (
        <span
          className="absolute -inset-1 rounded-full animate-ping"
          style={{ background: `${C.turq}25` }}
          aria-hidden
        />
      )}
    </div>
  );
}

// ── Typing indicator ────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: C.muted }}
          animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ── Chat bubble ─────────────────────────────────────────────────
function MessageBubble({ msg, idx, isUser, avatar, senderName }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.45,
        delay: idx === 0 ? 0 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`flex w-full items-end gap-3 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && <AriaMark size={32} />}
      <div className={`group max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isUser && (
          <span className="mb-1 px-1 text-[11px] font-medium tracking-wide" style={{ color: C.muted }}>
            {senderName || 'Guide'}
          </span>
        )}
        <div
          className={`relative rounded-3xl px-5 py-3.5 text-[14.5px] leading-relaxed shadow-sm whitespace-pre-wrap ${
            isUser ? 'rounded-br-md' : 'rounded-bl-md'
          }`}
          style={
            isUser
              ? {
                  background: `linear-gradient(135deg, ${C.turq} 0%, ${C.turqDeep} 100%)`,
                  color: '#FFFFFF',
                  boxShadow: `0 6px 18px ${C.turq}30`,
                }
              : {
                  background: '#FFFFFF',
                  color: C.ink,
                  border: `1px solid ${C.muted}20`,
                }
          }
        >
          {msg.content}
        </div>
        {msg.created_at && (
          <span
            className="mt-1.5 px-1 text-[10.5px] opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: C.muted }}
          >
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Language switcher ───────────────────────────────────────────
const LANGS = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fa', label: 'فارسی', dir: 'rtl' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

function LanguageSwitcher({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
        style={{
          background: '#ffffff70',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${C.muted}30`,
          color: C.teal,
        }}
      >
        <Globe2 className="h-4 w-4" style={{ color: C.turq }} />
        <span>{current.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: C.muted }}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 min-w-[140px] overflow-hidden rounded-2xl py-1 z-10"
            style={{
              background: '#ffffff',
              border: `1px solid ${C.muted}25`,
              boxShadow: `0 12px 40px ${C.teal}15`,
            }}
          >
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  onChange(l.code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-white"
                style={{ color: C.teal }}
              >
                <span style={{ direction: l.dir }}>{l.label}</span>
                {l.code === lang && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.turq }} />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Chat Component ─────────────────────────────────────────
export default function Chat() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { lang, dir } = useI18n();
  const [chatLang, setChatLang] = useState(lang);
  const isRtl = dir === 'rtl';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const initialMessage = location.state?.initialMessage || '';
  const [guide, setGuide] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [input, setInput] = useState(initialMessage);
  const [sending, setSending] = useState(false);

  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  // Auth guard
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  // Initial load: guide profile + message history
  useEffect(() => {
    if (!user || !guideId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [publicProfileRes, msgsRes] = await Promise.all([
          // A public guide/agency can be contacted before a message
          // relationship exists, so resolve published identity through the
          // public RPC before attempting the relationship-scoped RPC.
          selectPublicProfiles(
            supabase,
            'id, full_name, avatar_url, gender, role, city, bio'
          ).eq('id', guideId).maybeSingle(),
          supabase
            .from('messages')
            .select('*')
            .or(
              `and(sender_id.eq.${user.id},receiver_id.eq.${guideId}),and(sender_id.eq.${guideId},receiver_id.eq.${user.id})`
            )
            .order('created_at', { ascending: true }),
        ]);

        if (cancelled) return;
        if (msgsRes.error) throw msgsRes.error;

        let participant = publicProfileRes.data;
        if (!participant) participant = await fetchParticipantProfile(guideId);

        setGuide(participant || {
          id: guideId,
          full_name: 'User',
          avatar_url: null,
          gender: null,
          role: null,
          city: null,
          bio: null,
        });
        setMessages(msgsRes.data || []);

        const unreadIds = (msgsRes.data || [])
          .filter((m) => m.receiver_id === user.id && !m.is_read)
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, guideId]);

  // Realtime: incoming messages from this guide
  useEffect(() => {
    if (!user || !guideId) return;
    const channel = supabase
      .channel(`chat-${user.id}-${guideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const m = payload.new;
          if (m.sender_id !== guideId) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          await supabase.from('messages').update({ is_read: true }).eq('id', m.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, guideId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user || !guideId || sending) return;
    setSending(true);
    setInput('');
    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: guideId,
          content: text,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) {
        setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
      }
    } catch (err) {
      setError(err.message);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  if (isLoadingAuth || (loading && !error)) {
    return (
      <div
        dir={dir}
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: C.white }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.turq }} />
          <p style={{ color: C.muted }} className="text-sm">
            {chatLang === 'fa' ? 'در حال بارگزاری...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div
        dir={dir}
        className="min-h-screen w-full flex items-center justify-center px-6"
        style={{ background: C.white }}
      >
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-4"
            style={{ background: `${C.muted}10`, borderColor: `${C.muted}20` }}
          >
            <MessageCircle className="w-7 h-7" style={{ color: C.muted }} />
          </div>
          <p className="font-semibold text-lg mb-2" style={{ color: C.teal }}>
            {chatLang === 'fa'
              ? 'کاربر یافت نشد'
              : chatLang === 'ar'
              ? 'المستخدم غير موجود'
              : 'Guide not found'}
          </p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80"
            style={{ color: C.turq }}
          >
            ← {chatLang === 'fa' ? 'بازگشت' : chatLang === 'ar' ? 'رجوع' : 'Back'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className="h-[100dvh] min-h-[100dvh] w-full overflow-hidden"
      style={{
        background: C.white,
        fontFamily: "'Khamenei', 'Segoe UI', system-ui, -apple-system, sans-serif",
        color: C.ink,
      }}
    >
      <div className="mx-auto flex h-full max-w-[1480px] flex-col lg:flex-row">
        {/* Chat column */}
        <section
          className="relative flex min-h-0 w-full flex-1 flex-col lg:w-[60%] lg:border-r"
          style={{ borderColor: `${C.muted}20` }}
        >
          {/* Header */}
          <header
            className="relative shrink-0 overflow-hidden px-4 pt-5 pb-4 sm:px-10 sm:pt-10 sm:pb-9"
            style={{ borderBottom: `1px solid ${C.muted}20` }}
          >
            <PersianPattern opacity={0.055} color={C.turq} size={64} />
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${C.turq}55, transparent)`,
              }}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors -ml-2"
                  style={{ background: `${C.muted}10`, color: C.teal }}
                  aria-label="Back"
                >
                  <BackArrow className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div
                    className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: C.turq }}
                  >
                    Chat with Guide
                  </div>
                  <h1
                    className="mt-1 truncate text-xl font-bold leading-tight sm:text-2xl"
                    style={{ color: C.teal }}
                  >
                    {guide.full_name || 'Guide'}
                  </h1>
                  {guide.city && (
                    <p
                      className="mt-0.5 text-[13px]"
                      style={{ color: C.muted }}
                    >
                      📍 {guide.city}
                    </p>
                  )}
                </div>
              </div>
              <LanguageSwitcher lang={chatLang} onChange={setChatLang} />
            </div>

            {/* Decorative line */}
            <div
              className="mt-7 h-[2px] w-full"
              style={{
                background: `repeating-linear-gradient(90deg, ${C.turq} 0 6px, transparent 6px 12px, ${C.muted} 12px 14px, transparent 14px 20px)`,
                opacity: 0.45,
              }}
            />
          </header>

          {/* Messages */}
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-10 sm:py-6"
          >
            <div className="mx-auto flex max-w-[680px] flex-col gap-5">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <AriaMark size={48} />
                  <p className="mt-4 font-medium" style={{ color: C.teal }}>
                    {chatLang === 'fa'
                      ? 'هنوز پیامی رد و بدل نشده است'
                      : chatLang === 'ar'
                      ? 'لا توجد رسائل بعد'
                      : 'No messages yet'}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>
                    {chatLang === 'fa'
                      ? 'گفت‌وگو را با یک سلام آغاز کنید'
                      : chatLang === 'ar'
                      ? 'ابدأ المحادثة بتحية'
                      : 'Start the conversation with a hello'}
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((m, idx) => {
                    const isUser = m.sender_id === user.id;
                    return (
                      <MessageBubble
                        key={m.id}
                        msg={m}
                        idx={idx}
                        isUser={isUser}
                        senderName={isUser ? 'You' : guide.full_name}
                      />
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Input form */}
          <form
            onSubmit={handleSend}
            className="shrink-0 border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-10 sm:py-4"
            style={{ borderColor: `${C.muted}20`, background: `${C.white}` }}
          >
            <div className="mx-auto flex max-w-[680px] items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  chatLang === 'fa'
                    ? 'پیام خود را بنویسید...'
                    : chatLang === 'ar'
                    ? 'اكتب رسالتك...'
                    : 'Type a message...'
                }
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all"
                style={{
                  background: `${C.mist}`,
                  borderColor: `${C.muted}20`,
                  color: C.ink,
                }}
                dir="auto"
                autoComplete="off"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center font-medium transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: !sending && input.trim() ? C.turq : `${C.muted}40`,
                  color: C.white,
                }}
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-500">{error}</p>
            )}
          </form>
        </section>

        {/* Info panel - Right side on desktop */}
        <aside
          className="hidden lg:flex flex-col w-[40%] border-l overflow-y-auto px-8 py-8"
          style={{ borderColor: `${C.muted}20`, background: `${C.mist}40` }}
        >
          {guide && (
            <div>
              <div
                className="relative w-24 h-24 rounded-2xl overflow-hidden mb-4 border-2"
                style={{ borderColor: C.turq }}
              >
                <img decoding="async" loading="lazy"
                  src={avatarFor(guide)}
                  alt={guide.full_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: C.teal }}>
                {guide.full_name}
              </h2>
              {guide.city && (
                <p className="text-sm mb-4" style={{ color: C.muted }}>
                  📍 {guide.city}
                </p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: C.ink }}>
                {guide.bio || 'Welcome! Let me help you plan an unforgettable journey through Iran.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
