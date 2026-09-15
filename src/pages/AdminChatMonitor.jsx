import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import {
  AlertTriangle,
  History,
  Loader2,
  LockKeyhole,
  LockOpen,
  MessageSquare,
  Pencil,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import { detectContactSharing } from '@/lib/contactSharing';

const CARD = 'bg-white/[0.03] border border-white/[0.07] rounded-2xl';
const REASONS = [
  ['contact_sharing', 'Sharing contact information'],
  ['off_platform_payment', 'Payment outside the platform'],
  ['abusive_content', 'Inappropriate / abusive content'],
  ['spam', 'Spam'],
  ['other', 'Other'],
];

const fmtTime = (ts) => {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const keyFor = (a, b) => [a, b].sort().join('__');
const isMissingModerationSchema = (error) => {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /chat_moderation_(threads|warnings|audit).*does not exist/i.test(message)
    || /schema cache.*chat_moderation_/i.test(message);
};

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(222,47%,10%)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SmallButton({ children, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${danger
        ? 'border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15'
        : 'border-white/10 bg-white/[0.05] text-white/65 hover:bg-white/[0.08] hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export default function AdminChatMonitor() {
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [controls, setControls] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [audit, setAudit] = useState([]);
  const [moderationAvailable, setModerationAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeKey, setActiveKey] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [dialog, setDialog] = useState(null);

  const loadModeration = async () => {
    const [threadsRes, warningsRes, auditRes] = await Promise.all([
      supabase.from('chat_moderation_threads').select('*'),
      supabase.from('chat_moderation_warnings').select('*').order('created_at', { ascending: false }),
      supabase.from('chat_moderation_audit').select('*').order('created_at', { ascending: false }),
    ]);
    const firstError = threadsRes.error || warningsRes.error || auditRes.error;
    if (firstError) {
      if (isMissingModerationSchema(firstError)) {
        setModerationAvailable(false);
        setControls([]); setWarnings([]); setAudit([]);
        return;
      }
      throw firstError;
    }
    setModerationAvailable(true);
    setControls(threadsRes.data || []);
    setWarnings(warningsRes.data || []);
    setAudit(auditRes.data || []);
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [{ data: msgs, error: mErr }, { data: profs, error: pErr }] = await Promise.all([
        supabase.from('messages')
          .select('id, sender_id, receiver_id, content, created_at, is_read, edited, edited_at')
          .not('sender_id', 'is', null)
          .not('receiver_id', 'is', null)
          .order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, full_name, email, role, avatar_url'),
      ]);
      if (mErr) throw mErr;
      if (pErr) throw pErr;
      const map = {};
      (profs || []).forEach(profile => { map[profile.id] = profile; });
      setProfiles(map);
      setMessages(msgs || []);
      await loadModeration();
    } catch (loadError) {
      setError(loadError.message || 'Could not load chat monitor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const nameOf = id => profiles[id]?.full_name || profiles[id]?.email || 'Unknown';
  const roleOf = id => profiles[id]?.role || '—';

  const controlsByPair = useMemo(() => Object.fromEntries(
    controls.map(control => [keyFor(control.participant_a, control.participant_b), control]),
  ), [controls]);

  const threads = useMemo(() => {
    const map = new Map();
    for (const message of messages) {
      const pair = [message.sender_id, message.receiver_id].sort();
      const key = pair.join('__');
      if (!map.has(key)) map.set(key, { key, a: pair[0], b: pair[1], items: [] });
      map.get(key).items.push({ ...message, violations: detectContactSharing(message.content) });
    }
    const list = [...map.values()].map(thread => {
      const last = thread.items[thread.items.length - 1];
      return {
        ...thread,
        last,
        count: thread.items.length,
        flaggedCount: thread.items.filter(item => item.violations.length).length,
        control: controlsByPair[thread.key] || null,
        isClosed: controlsByPair[thread.key]?.is_closed === true,
      };
    });
    list.sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
    return list;
  }, [messages, controlsByPair]);

  const visibleThreads = useMemo(() => {
    let list = [...threads];
    if (onlyFlagged) list = list.filter(thread => thread.flaggedCount > 0);
    if (sortBy === 'oldest') list.sort((a, b) => new Date(a.last.created_at) - new Date(b.last.created_at));
    if (sortBy === 'messages') list.sort((a, b) => b.count - a.count);
    if (sortBy === 'flagged') list.sort((a, b) => b.flaggedCount - a.flaggedCount);
    if (sortBy === 'participants') list.sort((a, b) => `${nameOf(a.a)} ${nameOf(a.b)}`.localeCompare(`${nameOf(b.a)} ${nameOf(b.b)}`));
    return list;
  }, [threads, onlyFlagged, sortBy, profiles]);

  const active = threads.find(thread => thread.key === activeKey) || null;
  const activeWarnings = active ? warnings.filter(item => keyFor(item.participant_a, item.participant_b) === active.key) : [];
  const activeAudit = active ? audit.filter(item => keyFor(item.participant_a, item.participant_b) === active.key) : [];
  const totalFlagged = threads.reduce((sum, thread) => sum + thread.flaggedCount, 0);

  const runAction = async action => {
    setBusy(true); setError('');
    try {
      await action();
      await loadModeration();
      setDialog(null);
    } catch (actionError) {
      setError(actionError.message || 'Moderation action failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitWarning = event => {
    event.preventDefault();
    if (!active || !dialog?.message?.trim()) return;
    runAction(async () => {
      const { error: rpcError } = await supabase.rpc('admin_warn_chat_user', {
        p_user_a: active.a,
        p_user_b: active.b,
        p_target_user_id: dialog.target === 'both' ? null : dialog.target,
        p_reason_code: dialog.reason,
        p_message: dialog.message.trim(),
      });
      if (rpcError) throw rpcError;
    });
  };

  const submitEdit = event => {
    event.preventDefault();
    if (!dialog?.message || !dialog.content?.trim()) return;
    runAction(async () => {
      const { data, error: rpcError } = await supabase.rpc('admin_edit_chat_message', {
        p_message_id: dialog.message.id,
        p_new_content: dialog.content.trim(),
        p_reason: dialog.reason?.trim() || null,
      });
      if (rpcError) throw rpcError;
      setMessages(current => current.map(item => item.id === dialog.message.id
        ? { ...item, content: data?.content || dialog.content.trim(), edited: true, edited_at: data?.edited_at || new Date().toISOString() }
        : item));
    });
  };

  const submitCloseToggle = event => {
    event.preventDefault();
    if (!active) return;
    const closing = !active.isClosed;
    runAction(async () => {
      const { error: rpcError } = await supabase.rpc('admin_set_chat_closed', {
        p_user_a: active.a,
        p_user_b: active.b,
        p_closed: closing,
        p_reason: dialog?.reason?.trim() || null,
      });
      if (rpcError) throw rpcError;
    });
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[hsl(178,85%,45%)]" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Chat Monitor</h2>
          <p className="mt-0.5 text-xs text-white/40">Oversight and moderation of guide ↔ tourist conversations</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/60">{threads.length} conversations</span>
          {totalFlagged > 0 && <span className="flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/15 px-2.5 py-1 text-red-400"><AlertTriangle className="h-3 w-3" />{totalFlagged} flagged</span>}
        </div>
      </div>

      {!moderationAvailable && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">Moderation controls will activate after the new Supabase migration is applied. Chat monitoring remains read-only until then.</div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort conversations" className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-[hsl(222,45%,14%)] px-3 py-2 text-sm text-white [color-scheme:dark]">
          <option value="newest">Sort by: Newest activity</option>
          <option value="oldest">Sort by: Oldest activity</option>
          <option value="messages">Sort by: Most messages</option>
          <option value="flagged">Sort by: Most flagged</option>
          <option value="participants">Sort by: Participant name</option>
        </select>
        <SmallButton onClick={() => setOnlyFlagged(value => !value)}><AlertTriangle className="h-3.5 w-3.5" />Flagged only</SmallButton>
      </div>

      <div className="grid min-h-[440px] gap-4 lg:grid-cols-[320px_1fr] lg:h-[calc(100vh-20rem)]">
        <div className={`${CARD} max-h-[42vh] overflow-y-auto lg:max-h-none`}>
          {visibleThreads.length === 0 ? <div className="p-6 text-center text-sm text-white/40">No conversations found.</div> : visibleThreads.map(thread => (
            <button key={thread.key} onClick={() => { setActiveKey(thread.key); setShowHistory(false); }} className={`w-full border-b border-white/[0.05] px-4 py-3 text-left transition ${thread.key === activeKey ? 'bg-[hsl(178,85%,32%)]/15' : 'hover:bg-white/[0.04]'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-white">{nameOf(thread.a)} <span className="text-white/30">↔</span> {nameOf(thread.b)}</p>
                <div className="flex shrink-0 gap-1">
                  {thread.isClosed && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Closed</span>}
                  {thread.flaggedCount > 0 && <span className="flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400"><AlertTriangle className="h-2.5 w-2.5" />{thread.flaggedCount}</span>}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1.5"><span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] capitalize text-white/45">{roleOf(thread.a)}</span><span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] capitalize text-white/45">{roleOf(thread.b)}</span></div>
              <p className="mt-1.5 truncate text-xs text-white/40">{thread.last?.content}</p>
              <p className="mt-1 text-[10px] text-white/25">{fmtTime(thread.last?.created_at)} · {thread.count} msgs</p>
            </button>
          ))}
        </div>

        <div className={`${CARD} flex min-h-[500px] flex-col overflow-hidden`}>
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/30"><MessageSquare className="h-8 w-8" /><p className="text-sm">Select a conversation to review</p></div>
          ) : (
            <>
              <div className="border-b border-white/[0.07] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold text-white">{nameOf(active.a)} <span className="text-white/30">↔</span> {nameOf(active.b)}</p><p className="mt-0.5 text-[10px] text-white/35">{activeWarnings.length} warning{activeWarnings.length === 1 ? '' : 's'} · {activeAudit.length} admin action{activeAudit.length === 1 ? '' : 's'}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {active.flaggedCount > 0 && <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] text-red-400"><ShieldAlert className="h-3 w-3" />{active.flaggedCount} flagged</span>}
                    <SmallButton disabled={!moderationAvailable || busy} onClick={() => setDialog({ type: 'warn', target: active.a, reason: 'contact_sharing', message: 'Please keep communication and booking activity within Iran Trip Advisor and follow the platform safety rules.' })}><Siren className="h-3.5 w-3.5" />Warn</SmallButton>
                    <SmallButton disabled={!moderationAvailable || busy} danger={!active.isClosed} onClick={() => setDialog({ type: 'close', reason: '' })}>{active.isClosed ? <LockOpen className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}{active.isClosed ? 'Reopen chat' : 'Close chat'}</SmallButton>
                    <SmallButton onClick={() => setShowHistory(value => !value)}><History className="h-3.5 w-3.5" />History</SmallButton>
                  </div>
                </div>
                {active.isClosed && <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">This chat is closed. Participants can read history but cannot send new messages.{active.control?.close_reason ? ` Reason: ${active.control.close_reason}` : ''}</div>}
              </div>

              {showHistory ? (
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">Moderation history</h3>
                  {[...activeAudit, ...activeWarnings.map(item => ({ ...item, action: 'warning', reason: item.message }))]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((item, index) => (
                      <div key={`${item.id || item.action}-${index}`} className="mb-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-semibold capitalize text-white/70">{String(item.action || 'warning').replaceAll('_', ' ')}</span><span className="text-[10px] text-white/30">{fmtTime(item.created_at)}</span></div>
                        {item.target_user_id && <p className="mt-1 text-[10px] text-white/40">Target: {nameOf(item.target_user_id)}</p>}
                        {item.reason && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/60">{item.reason}</p>}
                        {item.action === 'message_edit' && item.metadata?.original_content && <div className="mt-2 rounded-lg bg-black/15 p-2 text-[10px] text-white/45"><p><span className="font-semibold">Original:</span> {item.metadata.original_content}</p><p className="mt-1"><span className="font-semibold">Edited:</span> {item.metadata.edited_content}</p></div>}
                      </div>
                    ))}
                  {!activeAudit.length && !activeWarnings.length && <p className="py-12 text-center text-sm text-white/30">No moderation actions yet.</p>}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {active.items.map(message => {
                    const left = message.sender_id === active.a;
                    const flagged = message.violations.length > 0;
                    return (
                      <div key={message.id} className={`group flex ${left ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-2xl border px-3.5 py-2 text-sm ${flagged ? 'border-red-500/30 bg-red-500/10 text-white' : left ? 'border-white/[0.04] bg-white/[0.06] text-white/90' : 'border-[hsl(178,85%,32%)]/10 bg-[hsl(178,85%,32%)]/15 text-white/90'}`}>
                          <div className="mb-1 flex items-center justify-between gap-3"><p className="text-[10px] text-white/40">{nameOf(message.sender_id)} · {fmtTime(message.created_at)}</p><button type="button" disabled={!moderationAvailable || busy} onClick={() => setDialog({ type: 'edit', message, content: message.content, reason: '' })} className="rounded p-1 text-white/25 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100 disabled:hidden" aria-label="Edit message"><Pencil className="h-3 w-3" /></button></div>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          {message.edited && <p className="mt-1.5 text-[9px] font-medium text-amber-300/80">Edited by Iran Trip Advisor</p>}
                          {flagged && <div className="mt-1.5 flex flex-wrap gap-1">{message.violations.map(violation => <span key={violation} className="flex items-center gap-0.5 rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-medium text-red-300"><AlertTriangle className="h-2.5 w-2.5" />{violation}</span>)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {dialog?.type === 'warn' && active && (
        <Dialog title="Send administrator warning" onClose={() => !busy && setDialog(null)}>
          <form onSubmit={submitWarning} className="space-y-4 p-5">
            <div><label className="mb-1.5 block text-[11px] font-medium text-white/55">Warn</label><select value={dialog.target || 'both'} onChange={event => setDialog(current => ({ ...current, target: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[hsl(222,45%,14%)] px-3 py-2.5 text-sm text-white [color-scheme:dark]"><option value={active.a}>{nameOf(active.a)} ({roleOf(active.a)})</option><option value={active.b}>{nameOf(active.b)} ({roleOf(active.b)})</option><option value="both">Both participants</option></select></div>
            <div><label className="mb-1.5 block text-[11px] font-medium text-white/55">Reason</label><select value={dialog.reason} onChange={event => setDialog(current => ({ ...current, reason: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[hsl(222,45%,14%)] px-3 py-2.5 text-sm text-white [color-scheme:dark]">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label className="mb-1.5 block text-[11px] font-medium text-white/55">Warning message</label><textarea rows={5} maxLength={1500} value={dialog.message} onChange={event => setDialog(current => ({ ...current, message: event.target.value }))} className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></div>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4"><SmallButton disabled={busy} onClick={() => setDialog(null)}>Cancel</SmallButton><button type="submit" disabled={busy || !dialog.message.trim()} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Send warning</button></div>
          </form>
        </Dialog>
      )}

      {dialog?.type === 'edit' && (
        <Dialog title="Edit message as administrator" onClose={() => !busy && setDialog(null)}>
          <form onSubmit={submitEdit} className="space-y-4 p-5">
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/75">The original message is preserved in the audit log. Participants will see that this message was edited by Iran Trip Advisor.</div>
            <div><label className="mb-1.5 block text-[11px] font-medium text-white/55">Message</label><textarea rows={6} maxLength={4000} value={dialog.content} onChange={event => setDialog(current => ({ ...current, content: event.target.value }))} className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium text-white/55">Moderation note (optional)</label><textarea rows={2} maxLength={1500} value={dialog.reason} onChange={event => setDialog(current => ({ ...current, reason: event.target.value }))} className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></div>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4"><SmallButton disabled={busy} onClick={() => setDialog(null)}>Cancel</SmallButton><button type="submit" disabled={busy || !dialog.content.trim() || dialog.content.trim() === dialog.message.content} className="inline-flex items-center gap-2 rounded-lg bg-[hsl(178,85%,32%)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save edit</button></div>
          </form>
        </Dialog>
      )}

      {dialog?.type === 'close' && active && (
        <Dialog title={active.isClosed ? 'Reopen conversation' : 'Close conversation'} onClose={() => !busy && setDialog(null)}>
          <form onSubmit={submitCloseToggle} className="space-y-4 p-5">
            <div className={`rounded-xl border p-3 text-xs leading-relaxed ${active.isClosed ? 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-100/75' : 'border-red-500/20 bg-red-500/[0.07] text-red-100/75'}`}>{active.isClosed ? 'Reopening restores both participants’ ability to send new messages. Existing history remains unchanged.' : 'Closing keeps the full conversation readable but blocks both participants from sending new messages until an administrator reopens it.'}</div>
            <div><label className="mb-1.5 block text-[11px] font-medium text-white/55">{active.isClosed ? 'Reopen note (optional)' : 'Reason for closing (optional)'}</label><textarea rows={3} maxLength={1000} value={dialog.reason} onChange={event => setDialog(current => ({ ...current, reason: event.target.value }))} className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></div>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4"><SmallButton disabled={busy} onClick={() => setDialog(null)}>Cancel</SmallButton><button type="submit" disabled={busy} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${active.isClosed ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'}`}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{active.isClosed ? 'Reopen chat' : 'Close chat'}</button></div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
