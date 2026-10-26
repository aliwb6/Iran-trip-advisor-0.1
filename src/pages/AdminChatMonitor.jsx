import IconSwap from '@/components/ui/IconSwap';
import {
  useState,
  useEffect,
  useMemo } from 'react';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { AlertTriangle,
  Check,
  LockKeyhole,
  MessageSquare,
  Pencil,
  ShieldAlert,
  Unlock,
  X,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

const CARD = 'bg-card border border-border rounded-2xl';
const RULES = [
  { label: 'Phone number', test: t => (t.match(/\+?\d[\d\s().-]{7,}\d/g) || []).some(s => s.replace(/\D/g, '').length >= 9) },
  { label: 'Email', test: t => /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t) },
  { label: 'External link', test: t => /\b(https?:\/\/|www\.)\S+/i.test(t) },
  { label: 'Telegram', test: t => /\btelegram\b|\bt\.me\b|تلگرام/i.test(t) },
  { label: 'WhatsApp', test: t => /\bwhatsapp\b|\bwa\.me\b|واتساپ|واتس\s?اپ/i.test(t) },
  { label: 'Instagram', test: t => /\binstagram\b|\binsta\b|اینستا/i.test(t) },
  { label: 'Social handle', test: t => /(^|\s)@[a-z0-9_.]{3,}/i.test(t) },
];
const detectViolations = text => text ? RULES.filter(rule => rule.test(text)).map(rule => rule.label) : [];
const fmtTime = (timestamp, lang) => { try { return new Date(timestamp).toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const pairFor = (a, b) => [a, b].sort();
const moderationKey = (a, b) => pairFor(a, b).join('__');
const isMissingModerationSchema = error => error?.code === 'PGRST205' || /direct_chat_moderation/i.test(error?.message || '');

export default function AdminChatMonitor() {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const roleLabel = role => role === 'agency' ? l('Agency', 'آژانس', 'وكالة') : role === 'guide' ? l('Guide', 'راهنما', 'مرشد') : role === 'tourist' ? l('Tourist', 'گردشگر', 'سائح') : role;
  const violationLabel = label => ({ 'Phone number': l('Phone number', 'شمارهٔ تلفن', 'رقم هاتف'), Email: l('Email', 'ایمیل', 'بريد إلكتروني'), 'External link': l('External link', 'پیوند بیرونی', 'رابط خارجي'), Telegram: l('Telegram', 'تلگرام', 'تيليغرام'), WhatsApp: l('WhatsApp', 'واتساپ', 'واتساب'), Instagram: l('Instagram', 'اینستاگرام', 'إنستغرام'), 'Social handle': l('Social handle', 'شناسهٔ شبکهٔ اجتماعی', 'معرّف تواصل اجتماعي') })[label] || label;
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [moderationByPair, setModerationByPair] = useState({});
  const [moderationAvailable, setModerationAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKey, setActiveKey] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [{ data: msgs, error: messagesError }, { data: profileRows, error: profilesError }, { data: moderationRows, error: moderationError }] = await Promise.all([
        supabase.from('messages').select('id, sender_id, receiver_id, content, created_at, is_read, edited, edited_at').not('sender_id', 'is', null).not('receiver_id', 'is', null).order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, full_name, email, role, avatar_url'),
        supabase.from('direct_chat_moderation').select('participant_one_id, participant_two_id, is_closed, closure_reason, closed_at'),
      ]);
      if (messagesError || profilesError) throw messagesError || profilesError;
      if (moderationError && !isMissingModerationSchema(moderationError)) throw moderationError;
      setProfiles(Object.fromEntries((profileRows || []).map(profile => [profile.id, profile])));
      setMessages(msgs || []);
      setModerationAvailable(!moderationError);
      setModerationByPair(Object.fromEntries((moderationRows || []).map(item => [moderationKey(item.participant_one_id, item.participant_two_id), item])));
    } catch (loadError) {
      setError(l('Could not load chat monitor data. Make sure the chat moderation migration has been applied.', 'بارگذاری گفت‌وگوها ممکن نشد. از اجرای به‌روزرسانی پایگاه داده برای مدیریت گفت‌وگو مطمئن شوید.', 'تعذّر تحميل المحادثات. تحقّق من تطبيق تحديث قاعدة البيانات الخاص بإدارة المحادثات.'));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const nameOf = id => profiles[id]?.full_name || profiles[id]?.email || l('Unknown', 'نامشخص', 'غير معروف');
  const roleOf = id => roleLabel(profiles[id]?.role) || '—';
  const threads = useMemo(() => {
    const grouped = new Map();
    messages.forEach(message => {
      const [a, b] = pairFor(message.sender_id, message.receiver_id); const key = `${a}__${b}`;
      if (!grouped.has(key)) grouped.set(key, { key, a, b, items: [] });
      grouped.get(key).items.push({ ...message, violations: detectViolations(message.content) });
    });
    return [...grouped.values()].map(thread => ({ ...thread, last: thread.items.at(-1), count: thread.items.length, flaggedCount: thread.items.filter(item => item.violations.length).length, moderation: moderationByPair[thread.key] || null })).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  }, [messages, moderationByPair]);
  const visibleThreads = useMemo(() => {
    let result = onlyFlagged ? threads.filter(thread => thread.flaggedCount) : [...threads];
    const sorters = { oldest: (a, b) => new Date(a.last.created_at) - new Date(b.last.created_at), messages: (a, b) => b.count - a.count, flagged: (a, b) => b.flaggedCount - a.flaggedCount, participants: (a, b) => `${nameOf(a.a)} ${nameOf(a.b)}`.localeCompare(`${nameOf(b.a)} ${nameOf(b.b)}`) };
    return sorters[sortBy] ? result.sort(sorters[sortBy]) : result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, onlyFlagged, sortBy, profiles]);
  const active = threads.find(thread => thread.key === activeKey) || null;
  const totalFlagged = threads.reduce((total, thread) => total + thread.flaggedCount, 0);

  const saveEdit = async () => {
    const content = editText.trim(); if (!content || !editingId || busy) return;
    setBusy(true);
    const { error: editError } = await supabase.rpc('admin_edit_direct_message', { p_message_id: editingId, p_content: content });
    setBusy(false);
    if (editError) return toast.error(l('Message could not be updated.', 'ویرایش پیام ممکن نشد.', 'تعذّر تعديل الرسالة.'));
    setMessages(current => current.map(message => message.id === editingId ? { ...message, content, edited: true, edited_at: new Date().toISOString() } : message));
    setEditingId(null); setEditText(''); toast.success(l('Message updated.', 'پیام ویرایش شد.', 'تم تعديل الرسالة.'));
  };
  const closeChat = async () => {
    const reason = closeReason.trim(); if (!active || !reason || busy) return;
    setBusy(true);
    const { error: closeError } = await supabase.rpc('close_direct_chat', { p_participant_a: active.a, p_participant_b: active.b, p_reason: reason });
    setBusy(false);
    if (closeError) return toast.error(l('Conversation could not be closed.', 'بستن گفت‌وگو ممکن نشد.', 'تعذّر إغلاق المحادثة.'));
    setModerationByPair(current => ({ ...current, [active.key]: { participant_one_id: active.a, participant_two_id: active.b, is_closed: true, closure_reason: reason, closed_at: new Date().toISOString() } }));
    setShowCloseForm(false); setCloseReason(''); toast.success(l('Conversation closed; both participants can now see the reason.', 'گفت‌وگو بسته شد و هر دو طرف می‌توانند دلیل آن را ببینند.', 'أُغلقت المحادثة، ويمكن للطرفين الآن رؤية السبب.'));
  };
  const reopenChat = async () => {
    if (!active || busy) return; setBusy(true);
    const { error: reopenError } = await supabase.rpc('reopen_direct_chat', { p_participant_a: active.a, p_participant_b: active.b });
    setBusy(false);
    if (reopenError) return toast.error(l('Conversation could not be reopened.', 'بازگشایی گفت‌وگو ممکن نشد.', 'تعذّرت إعادة فتح المحادثة.'));
    setModerationByPair(current => ({ ...current, [active.key]: { ...(current[active.key] || {}), is_closed: false, closure_reason: null, closed_at: null } }));
    toast.success(l('Conversation reopened.', 'گفت‌وگو دوباره باز شد.', 'أُعيد فتح المحادثة.'));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 text-accent animate-spin" /></div>;
  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3"><div><h2 className="text-foreground font-bold text-lg">{l('Chat Monitor', 'نظارت بر گفت‌وگوها', 'مراقبة المحادثات')}</h2><p className="text-muted-foreground text-xs mt-0.5">{l('Review, edit, and moderate tourist, guide, and agency conversations', 'گفت‌وگوهای گردشگران، راهنماها و آژانس‌ها را بررسی و مدیریت کنید', 'راجع محادثات السياح والمرشدين والوكالات وعدّلها وأدِرها')}</p></div><div className="flex items-center gap-2 text-[11px]"><span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{l(`${threads.length} conversations`, `گفت‌وگوها: ${threads.length}`, `المحادثات: ${threads.length}`)}</span>{totalFlagged > 0 && <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-700 border border-red-500/25 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{l(`${totalFlagged} flagged`, `موارد علامت‌گذاری‌شده: ${totalFlagged}`, `المواضيع المعلّمة: ${totalFlagged}`)}</span>}</div></div>
    {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-sm">{error}</div>}
    {!moderationAvailable && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm">{l('Chat history is available. To enable editing, closing, and closure reasons, apply the latest database migration.', 'تاریخچهٔ گفت‌وگوها در دسترس است. برای فعال شدن ویرایش و بستن گفت‌وگو، آخرین به‌روزرسانی پایگاه داده را اجرا کنید.', 'سجلّ المحادثات متاح. لتفعيل التعديل والإغلاق وأسبابه، طبّق آخر تحديث لقاعدة البيانات.')}</div>}
    <div className="flex items-center gap-3 flex-wrap"><select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label={l('Sort conversations', 'مرتب‌سازی گفت‌وگوها', 'ترتيب المحادثات')} className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-[hsl(178,85%,32%)] transition [color-scheme:light]"><option value="newest">{l('Sort by: Newest activity', 'مرتب‌سازی: تازه‌ترین فعالیت', 'الترتيب: أحدث نشاط')}</option><option value="oldest">{l('Sort by: Oldest activity', 'مرتب‌سازی: قدیمی‌ترین فعالیت', 'الترتيب: أقدم نشاط')}</option><option value="messages">{l('Sort by: Most messages', 'مرتب‌سازی: بیشترین پیام', 'الترتيب: الأكثر رسائل')}</option><option value="flagged">{l('Sort by: Most flagged', 'مرتب‌سازی: بیشترین موارد علامت‌گذاری‌شده', 'الترتيب: الأكثر بلاغات')}</option><option value="participants">{l('Sort by: Participant name', 'مرتب‌سازی: نام شرکت‌کنندگان', 'الترتيب: اسم المشاركين')}</option></select><button onClick={() => setOnlyFlagged(value => !value)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${onlyFlagged ? 'bg-red-500/15 text-red-700 border-red-500/25' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}><AlertTriangle className="w-3.5 h-3.5" />{l('Flagged only', 'فقط موارد علامت‌گذاری‌شده', 'المعلّمة فقط')}</button></div>
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 min-h-[420px] lg:h-[calc(100vh-20rem)]">
      <div className={`${CARD} overflow-y-auto max-h-[42vh] lg:max-h-none`}>{visibleThreads.length === 0 ? <div className="p-6 text-center text-muted-foreground text-sm">{l('No conversations found.', 'گفت‌وگویی پیدا نشد.', 'لم يُعثر على محادثات.')}</div> : visibleThreads.map(thread => <button key={thread.key} onClick={() => { setActiveKey(thread.key); setShowCloseForm(false); setEditingId(null); }} className={`w-full text-left px-4 py-3 border-b border-border transition ${thread.key === activeKey ? 'bg-[hsl(178,85%,32%)]/15' : 'hover:bg-muted'}`}><div className="flex items-center justify-between gap-2"><p className="text-foreground text-sm font-medium truncate">{nameOf(thread.a)} <span className="text-muted-foreground">↔</span> {nameOf(thread.b)}</p><div className="flex items-center gap-1">{thread.moderation?.is_closed && <LockKeyhole className="w-3.5 h-3.5 text-amber-700" />}{thread.flaggedCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-700 text-[9px] font-bold">{thread.flaggedCount}</span>}</div></div><div className="flex items-center gap-1.5 mt-1"><span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{roleOf(thread.a)}</span><span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{roleOf(thread.b)}</span></div><p className="text-muted-foreground text-xs truncate mt-1.5">{thread.last?.content}</p><p className="text-muted-foreground text-[10px] mt-1">{fmtTime(thread.last?.created_at, lang)} · {l(`${thread.count} msgs`, `پیام‌ها: ${thread.count}`, `الرسائل: ${thread.count}`)}</p></button>)}</div>
      <div className={`${CARD} flex flex-col min-h-[520px]`}>{!active ? <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2"><MessageSquare className="w-8 h-8" /><p className="text-sm">{l('Select a conversation to review', 'برای بررسی، یک گفت‌وگو را انتخاب کنید', 'اختر محادثة لمراجعتها')}</p></div> : <>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3"><div><p className="text-foreground text-sm font-semibold">{nameOf(active.a)} <span className="text-muted-foreground">↔</span> {nameOf(active.b)}</p><p className="text-muted-foreground text-[10px] mt-0.5">{roleOf(active.a)} · {roleOf(active.b)}</p></div><div className="flex items-center gap-2">{active.flaggedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 text-[10px] font-medium flex items-center gap-1"><ShieldAlert className="w-3 h-3" />{l(`${active.flaggedCount} flagged`, `موارد علامت‌گذاری‌شده: ${active.flaggedCount}`, `المواضيع المعلّمة: ${active.flaggedCount}`)}</span>}{active.moderation?.is_closed ? <button onClick={reopenChat} disabled={busy || !moderationAvailable} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 disabled:opacity-50 flex items-center gap-1.5"><Unlock className="w-3.5 h-3.5" />{l('Reopen chat', 'بازگشایی گفت‌وگو', 'إعادة فتح المحادثة')}</button> : <button onClick={() => setShowCloseForm(value => !value)} disabled={!moderationAvailable} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/25 disabled:opacity-40 flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5" />{l('Close chat', 'بستن گفت‌وگو', 'إغلاق المحادثة')}</button>}</div></div>
        {active.moderation?.is_closed && <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3"><div className="flex gap-2"><ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" /><div><p className="text-amber-700 text-xs font-semibold">{l('This conversation is closed for both participants', 'این گفت‌وگو برای هر دو طرف بسته شده است', 'هذه المحادثة مغلقة أمام الطرفين')}</p><p className="text-amber-700/70 text-xs mt-1 whitespace-pre-wrap">{active.moderation.closure_reason}</p><p className="text-amber-700/40 text-[10px] mt-1">{l('Closed', 'بسته‌شده در', 'أُغلقت في')} {fmtTime(active.moderation.closed_at, lang)}</p></div></div></div>}
        {showCloseForm && <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3.5"><div className="flex items-start justify-between gap-3"><div><p className="text-amber-700 text-xs font-semibold">{l('Close this conversation', 'بستن این گفت‌وگو', 'إغلاق هذه المحادثة')}</p><p className="text-muted-foreground text-[11px] mt-1">{l('The reason will be shown to this tourist and this guide or agency. Neither side can send new messages.', 'دلیل به گردشگر و راهنما یا آژانس نمایش داده می‌شود و هیچ‌یک نمی‌توانند پیام تازه‌ای بفرستند.', 'سيظهر السبب للسائح والمرشد أو الوكالة، ولن يستطيع أيّ منهما إرسال رسائل جديدة.')}</p></div><button onClick={() => { setShowCloseForm(false); setCloseReason(''); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div><textarea value={closeReason} onChange={event => setCloseReason(event.target.value)} rows={3} maxLength={1000} placeholder={l('Explain why this chat is being closed…', 'دلیل بستن گفت‌وگو را توضیح دهید…', 'وضّح سبب إغلاق هذه المحادثة…')} className="mt-3 w-full resize-y rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-amber-400/60" /><div className="mt-2 flex justify-end"><button onClick={closeChat} disabled={busy || !closeReason.trim()} className="px-3 py-2 rounded-xl text-xs font-semibold text-amber-950 bg-amber-300 disabled:opacity-45 flex items-center gap-1.5">{<IconSwap active={busy} a={<LockKeyhole className="w-3.5 h-3.5" />} b={<Loader2 className="w-3.5 h-3.5 animate-spin" />} keepMounted={false} />}{l('Close and show reason', 'بستن و نمایش دلیل', 'إغلاق المحادثة وإظهار السبب')}</button></div></div>}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">{active.items.map(message => { const editing = editingId === message.id; const flagged = message.violations.length > 0; const mine = message.sender_id === active.a; return <div key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm ${flagged ? 'bg-red-500/10 border border-red-500/30 text-foreground' : mine ? 'bg-muted text-foreground/80' : 'bg-[hsl(178,85%,32%)]/15 text-foreground/80'}`}><div className="flex items-center justify-between gap-3"><p className="text-[10px] text-muted-foreground mb-1">{nameOf(message.sender_id)} · {fmtTime(message.created_at, lang)}{message.edited && ` · ${l('edited', 'ویرایش‌شده', 'معدّلة')}`}</p>{!editing && <button onClick={() => { setEditingId(message.id); setEditText(message.content); }} disabled={!moderationAvailable} aria-label={l('Edit message', 'ویرایش پیام', 'تعديل الرسالة')} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><Pencil className="w-3.5 h-3.5" /></button>}</div>{editing ? <><textarea value={editText} onChange={event => setEditText(event.target.value)} rows={3} maxLength={4000} className="w-full resize-y rounded-lg bg-muted border border-border px-2.5 py-2 text-sm text-foreground outline-none focus:border-[hsl(178,85%,45%)]" /><div className="mt-2 flex justify-end gap-2"><button onClick={() => { setEditingId(null); setEditText(''); }} className="px-2.5 py-1 text-[11px] text-muted-foreground">{l('Cancel', 'انصراف', 'إلغاء')}</button><button onClick={saveEdit} disabled={busy || !editText.trim()} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[hsl(178,85%,38%)] text-white disabled:opacity-50 flex items-center gap-1"><Check className="w-3 h-3" />{l('Save', 'ذخیره', 'حفظ')}</button></div></> : <p className="whitespace-pre-wrap break-words">{message.content}</p>}{flagged && <div className="mt-1.5 flex flex-wrap gap-1">{message.violations.map(violation => <span key={violation} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-700 text-[9px] font-medium">{violationLabel(violation)}</span>)}</div>}</div></div>; })}</div>
      </>}</div>
    </div>
  </div>;
}
