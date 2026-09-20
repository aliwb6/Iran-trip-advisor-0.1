import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Loader2,
  MessageCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n.jsx';
import { avatarFor } from '@/lib/avatar';
import { fetchParticipantProfile } from '@/api/participantProfiles';
import { selectPublicProfiles } from '@/lib/publicProfiles';
import { canShareContactWithUser } from '@/api/chatAccess';
import { fetchChatModeration } from '@/api/chatModeration';
import { detectContactSharing } from '@/lib/contactSharing';

const C = {
  turq: '#0D8B85',
  turqSoft: '#3FC7C1',
  turqDeep: '#0A6864',
  teal: '#1A4A4A',
  white: '#FFFFFF',
  mist: '#F5FBFA',
  muted: '#7A8C8C',
  ink: '#0F2A2A',
};

const EMPTY_MODERATION = {
  isClosed: false,
  closedAt: null,
  closeReason: null,
  warnings: [],
};

const isMissingModerationRpc = (error) => {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /chat_moderation_(threads|warnings).*does not exist/i.test(message)
    || /schema cache.*chat_moderation_/i.test(message);
};

async function fetchChatModerationSafely(counterpartyId, currentUserId) {
  try {
    return await fetchChatModeration(counterpartyId, currentUserId);
  } catch (error) {
    // Keeps existing chat usable during a staged deploy where the frontend is
    // live a few seconds before the matching migration. Database enforcement
    // becomes authoritative as soon as the migration exists.
    if (isMissingModerationRpc(error)) return EMPTY_MODERATION;
    throw error;
  }
}

function MessageBubble({ message, mine, senderName }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[82%] sm:max-w-[72%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!mine && <span className="mb-1 px-1 text-[11px] font-medium" style={{ color: C.muted }}>{senderName}</span>}
        <div
          className={`rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
          style={mine
            ? { background: `linear-gradient(135deg, ${C.turq}, ${C.turqDeep})`, color: C.white }
            : { background: C.white, color: C.ink, border: `1px solid ${C.muted}25` }}
        >
          {message.content}
        </div>
        <div className={`mt-1 flex flex-wrap items-center gap-1.5 px-1 text-[10px] ${mine ? 'justify-end' : 'justify-start'}`} style={{ color: C.muted }}>
          {message.created_at && (
            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          {message.edited && (
            <span className="font-medium text-amber-600">· Edited by Iran Trip Advisor</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { lang, dir } = useI18n();
  const BackArrow = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [participant, setParticipant] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [contactSharingAllowed, setContactSharingAllowed] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);
  const [chatCloseReason, setChatCloseReason] = useState(null);
  const [chatWarnings, setChatWarnings] = useState([]);
  const scrollerRef = useRef(null);

  const applyModeration = (moderation) => {
    setChatClosed(moderation?.isClosed === true);
    setChatCloseReason(moderation?.closeReason || null);
    setChatWarnings(moderation?.warnings || []);
  };

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, isLoadingAuth, navigate]);

  useEffect(() => {
    if (!user?.id || !guideId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [publicProfileRes, messagesRes, contactPermission, moderation] = await Promise.all([
          selectPublicProfiles(supabase, 'id, full_name, avatar_url, gender, role, city, bio')
            .eq('id', guideId)
            .maybeSingle(),
          supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${guideId}),and(sender_id.eq.${guideId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true }),
          canShareContactWithUser(guideId).catch(() => false),
          fetchChatModerationSafely(guideId, user.id),
        ]);

        if (cancelled) return;
        if (messagesRes.error) throw messagesRes.error;

        let profile = publicProfileRes.data;
        if (!profile) profile = await fetchParticipantProfile(guideId);
        if (cancelled) return;

        setParticipant(profile || {
          id: guideId,
          full_name: 'User',
          avatar_url: null,
          role: null,
          city: null,
          bio: null,
        });
        setMessages(messagesRes.data || []);
        setContactSharingAllowed(contactPermission === true);
        applyModeration(moderation);

        const unreadIds = (messagesRes.data || [])
          .filter(message => message.receiver_id === user.id && !message.is_read)
          .map(message => message.id);
        if (unreadIds.length) {
          await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not load this conversation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [guideId, user?.id]);

  useEffect(() => {
    if (!guideId || !user?.id) return undefined;

    const refreshAccess = async () => {
      try {
        const [contactPermission, moderation] = await Promise.all([
          canShareContactWithUser(guideId).catch(() => false),
          fetchChatModerationSafely(guideId, user.id),
        ]);
        setContactSharingAllowed(contactPermission === true);
        applyModeration(moderation);
      } catch {
        // Keep the last safe values; database rules remain authoritative.
      }
    };

    window.addEventListener('focus', refreshAccess);
    return () => window.removeEventListener('focus', refreshAccess);
  }, [guideId, user?.id]);

  useEffect(() => {
    if (!user?.id || !guideId) return undefined;

    const mergeUpdatedMessage = (message) => {
      const belongsToThread = (
        (message.sender_id === user.id && message.receiver_id === guideId)
        || (message.sender_id === guideId && message.receiver_id === user.id)
      );
      if (!belongsToThread) return;
      setMessages(current => current.map(item => item.id === message.id ? { ...item, ...message } : item));
    };

    const channel = supabase
      .channel(`direct-chat-${user.id}-${guideId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        async payload => {
          const message = payload.new;
          if (message.sender_id !== guideId) return;
          setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
          await supabase.from('messages').update({ is_read: true }).eq('id', message.id);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        payload => mergeUpdatedMessage(payload.new),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
        payload => mergeUpdatedMessage(payload.new),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [guideId, user?.id]);

  useEffect(() => {
    if (!user?.id || !guideId) return undefined;

    const [participantA,participantB] = [user.id, guideId].sort();

    const refreshModeration = async () => {
      try {
        applyModeration(await fetchChatModerationSafely(guideId, user.id));
      } catch {
        // Keep the last known state; server-side enforcement remains authoritative.
      }
    };

    const channel = supabase
      .channel(`direct-chat-moderation-${participantA}-${participantB}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_moderation_threads',
          filter: `participant_a=eq.${participantA}`,
        },
        payload => {
          const row = payload.new || payload.old;
          if (row?.participant_b === participantB) refreshModeration();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_moderation_warnings',
          filter: `participant_a=eq.${participantA}`,
        },
        payload => {
          if (payload.new?.participant_b === participantB) refreshModeration();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [guideId, user?.id]);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  const blockedMessage = lang === 'fa'
    ? 'تا قبل از تأیید پرداخت، ارسال شماره تلفن، ایمیل، لینک یا شناسه شبکه‌های اجتماعی حتی به شکل حروفی یا جداشده مجاز نیست. گفتگو را داخل سایت ادامه دهید.'
    : lang === 'ar'
      ? 'قبل تأكيد الدفع لا يمكن مشاركة رقم الهاتف أو البريد الإلكتروني أو الروابط أو حسابات التواصل، حتى بصيغة مكتوبة أو مفصولة. تابع المحادثة داخل الموقع.'
      : 'Phone numbers, direct contact addresses, links, and social-media IDs — including spelled or spaced-out versions — cannot be shared until payment is confirmed. Please keep the conversation on the platform.';

  const closedMessage = lang === 'fa'
    ? 'این گفتگو توسط تیم Iran Trip Advisor بسته شده است. تاریخچه گفتگو قابل مشاهده است اما امکان ارسال پیام جدید وجود ندارد.'
    : lang === 'ar'
      ? 'تم إغلاق هذه المحادثة بواسطة فريق Iran Trip Advisor. يمكنك قراءة السجل ولكن لا يمكنك إرسال رسائل جديدة.'
      : 'This conversation has been closed by the Iran Trip Advisor team. You can read the history, but new messages are disabled.';

  const handleSend = async event => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !user?.id || !guideId || sending) return;

    if (chatClosed) {
      setError(closedMessage);
      return;
    }

    const violations = contactSharingAllowed ? [] : detectContactSharing(text);
    if (violations.length > 0) {
      setError(blockedMessage);
      return;
    }

    setSending(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({ sender_id: user.id, receiver_id: guideId, content: text })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) {
        setMessages(current => current.some(item => item.id === data.id) ? current : [...current, data]);
      }
      setInput('');
    } catch (sendError) {
      const message = String(sendError?.message || 'Could not send this message.');
      if (message.includes('Contact information can only be shared')) {
        setError(blockedMessage);
      } else if (message.includes('closed by Iran Trip Advisor') || /row-level security/i.test(message)) {
        try {
          const moderation = await fetchChatModerationSafely(guideId, user.id);
          applyModeration(moderation);
          setError(moderation.isClosed ? closedMessage : message);
        } catch {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setSending(false);
    }
  };

  if (isLoadingAuth || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: C.white }}>
        <div className="flex items-center gap-3 text-sm" style={{ color: C.muted }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.turq }} />
          {lang === 'fa' ? 'در حال بارگذاری گفتگو…' : lang === 'ar' ? 'جارٍ تحميل المحادثة…' : 'Loading conversation…'}
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div dir={dir} className="min-h-[100dvh] flex items-center justify-center px-5" style={{ background: C.white }}>
        <div className="max-w-sm text-center">
          <MessageCircle className="mx-auto h-8 w-8" style={{ color: C.muted }} />
          <h1 className="mt-4 text-xl font-bold" style={{ color: C.teal }}>
            {lang === 'fa' ? 'گفتگو یافت نشد' : lang === 'ar' ? 'المحادثة غير موجودة' : 'Conversation not found'}
          </h1>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <Link to="/profile/requests" className="mt-5 inline-block text-sm font-semibold" style={{ color: C.turq }}>View requests</Link>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="h-[100dvh] min-h-[100dvh] w-full overflow-hidden" style={{ background: C.white, color: C.ink }}>
      <div className="mx-auto flex h-full max-w-[1480px]">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col lg:border-r" style={{ borderColor: `${C.muted}25` }}>
          <header className="shrink-0 border-b px-4 py-4 sm:px-8" style={{ borderColor: `${C.muted}25`, background: C.white }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: C.mist, color: C.teal }} aria-label="Back">
                  <BackArrow className="h-5 w-5" />
                </button>
                <img src={avatarFor(participant)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.turq }}>Iran Trip Advisor chat</p>
                  <h1 className="truncate text-lg font-bold sm:text-xl" style={{ color: C.teal }}>{participant.full_name || 'User'}</h1>
                  {participant.city && <p className="truncate text-xs" style={{ color: C.muted }}>{participant.city}</p>}
                </div>
              </div>
              <div className="hidden rounded-full px-3 py-1.5 text-[11px] font-semibold sm:flex sm:items-center sm:gap-1.5" style={{ background: `${C.turq}12`, color: C.turq }}>
                <ShieldCheck className="h-3.5 w-3.5" /> In-platform messaging
              </div>
            </div>
          </header>

          <div className={`shrink-0 border-b px-4 py-3 sm:px-8 ${contactSharingAllowed ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="mx-auto flex max-w-[760px] items-start gap-2.5">
              {contactSharingAllowed
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
              <p className={`text-xs leading-relaxed ${contactSharingAllowed ? 'text-emerald-800' : 'text-amber-900'}`}>
                {contactSharingAllowed
                  ? (lang === 'fa' ? 'پرداخت تأیید شده است؛ اشتراک اطلاعات تماس برای هماهنگی رزرو مجاز است.' : lang === 'ar' ? 'تم تأكيد الدفع؛ يمكن الآن مشاركة معلومات الاتصال لتنسيق الحجز.' : 'Payment is confirmed. Contact information may now be shared for booking coordination.')
                  : (lang === 'fa' ? 'برای امنیت شما، گفتگوها ممکن است توسط تیم Iran Trip Advisor بررسی شوند. تا قبل از پرداخت، شماره تلفن، ایمیل، لینک و شناسه شبکه‌های اجتماعی حتی به شکل حروفی یا جداشده قابل اشتراک نیست.' : lang === 'ar' ? 'لأمانك قد تتم مراجعة المحادثات من فريق Iran Trip Advisor. قبل الدفع لا يمكن مشاركة الهاتف أو البريد أو الروابط أو حسابات التواصل، حتى بصيغة مكتوبة أو مفصولة.' : 'For your safety, conversations may be reviewed by the Iran Trip Advisor team. Before payment, phone numbers, direct contact addresses, links, and social-media IDs — including spelled or spaced-out versions — cannot be shared.')}
              </p>
            </div>
          </div>

          {chatWarnings.length > 0 && (
            <div className="shrink-0 border-b border-orange-200 bg-orange-50 px-4 py-3 sm:px-8">
              <div className="mx-auto max-w-[760px] space-y-2">
                {chatWarnings.slice(0, 3).map(warning => (
                  <div key={warning.id} className="flex items-start gap-2.5 rounded-xl border border-orange-200/80 bg-white/70 px-3 py-2.5">
                    <Siren className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700">Iran Trip Advisor warning</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-orange-950">{warning.message}</p>
                      {warning.created_at && <p className="mt-1 text-[10px] text-orange-700/60">{new Date(warning.created_at).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chatClosed && (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 sm:px-8">
              <div className="mx-auto flex max-w-[760px] items-start gap-2.5">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="text-xs font-semibold text-red-800">{closedMessage}</p>
                  {chatCloseReason && <p className="mt-1 text-[11px] leading-relaxed text-red-700/75">{chatCloseReason}</p>}
                </div>
              </div>
            </div>
          )}

          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
            <div className="mx-auto flex max-w-[760px] flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${C.turq}12`, color: C.turq }}><MessageCircle className="h-5 w-5" /></div>
                  <p className="mt-4 text-sm font-semibold" style={{ color: C.teal }}>{lang === 'fa' ? 'گفتگو را شروع کنید' : lang === 'ar' ? 'ابدأ المحادثة' : 'Start the conversation'}</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed" style={{ color: C.muted }}>{lang === 'fa' ? 'درباره برنامه سفر، قیمت، تاریخ و خدمات داخل سایت هماهنگ کنید.' : lang === 'ar' ? 'نسّق برنامج الرحلة والسعر والتواريخ والخدمات داخل الموقع.' : 'Discuss itinerary, pricing, dates, and services here before booking.'}</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map(message => (
                    <MessageBubble key={message.id} message={message} mine={message.sender_id === user.id} senderName={participant.full_name || 'User'} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          <form onSubmit={handleSend} className="shrink-0 border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:py-4" style={{ borderColor: `${C.muted}25`, background: C.white }}>
            <div className="mx-auto max-w-[760px]">
              <div className="flex items-end gap-2.5">
                <textarea
                  value={input}
                  onChange={event => { setInput(event.target.value); if (error) setError(''); }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend(event);
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder={chatClosed
                    ? (lang === 'fa' ? 'این گفتگو بسته شده است' : lang === 'ar' ? 'هذه المحادثة مغلقة' : 'This conversation is closed')
                    : (lang === 'fa' ? 'پیام خود را بنویسید…' : lang === 'ar' ? 'اكتب رسالتك…' : 'Type a message…')}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: C.mist, borderColor: `${C.muted}25`, color: C.ink, '--tw-ring-color': `${C.turq}30` }}
                  dir="auto"
                  disabled={sending || chatClosed}
                />
                <button type="submit" disabled={sending || chatClosed || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white transition disabled:cursor-not-allowed disabled:opacity-40" style={{ background: C.turq }} aria-label="Send message">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {error && <p role="alert" className="mt-2 text-xs leading-relaxed text-red-500">{error}</p>}
              {chatClosed ? (
                <p className="mt-2 text-[10px] text-red-500/80">New messages are disabled by an administrator.</p>
              ) : !contactSharingAllowed && (
                <p className="mt-2 text-[10px]" style={{ color: C.muted }}>
                  Contact details — including numbers or IDs written as words — are automatically blocked until booking payment is confirmed.
                </p>
              )}
            </div>
          </form>
        </section>

        <aside className="hidden w-[34%] shrink-0 flex-col overflow-y-auto bg-[#F7FBFA] p-8 lg:flex">
          <img src={avatarFor(participant)} alt={participant.full_name || ''} className="h-24 w-24 rounded-2xl object-cover shadow-sm" />
          <h2 className="mt-4 text-2xl font-bold" style={{ color: C.teal }}>{participant.full_name || 'User'}</h2>
          {participant.role && <p className="mt-1 text-xs font-semibold capitalize" style={{ color: C.turq }}>{participant.role}</p>}
          {participant.city && <p className="mt-2 text-sm" style={{ color: C.muted }}>{participant.city}</p>}
          {participant.bio && <p className="mt-5 text-sm leading-7" style={{ color: C.ink }}>{participant.bio}</p>}
          <div className="mt-6 rounded-2xl border border-[#DCEBE8] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.teal }}><ShieldCheck className="h-4 w-4" /> Safer booking communication</div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: C.muted }}>Keep itinerary and price decisions in this chat. Verified payment unlocks private contact details automatically.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
