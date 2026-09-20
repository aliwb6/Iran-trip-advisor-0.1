import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// ── Guest / localStorage fallback ────────────────────────────────────────────
const LS_KEY = 'iran_tour_ai_conversations';
const MAX_LS_CONVS = 50;

function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((c) => ({ ...c, messages: ensureIds(c.messages) }));
  } catch {
    return [];
  }
}

function lsSave(convs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(convs.slice(0, MAX_LS_CONVS)));
  } catch {}
}

function ensureIds(msgs) {
  return (msgs || []).map((m) => (m.id ? m : { ...m, id: crypto.randomUUID() }));
}

function makeMsg(partial) {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    edited: false,
    editedAt: null,
    cards: null,
    ...partial,
  };
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function dbRowToMsg(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    edited: row.edited ?? false,
    editedAt: row.edited_at ?? null,
    timestamp: row.created_at,
    cards: row.cards ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useChatHistory() {
  const { user, isLoadingAuth } = useAuth();
  const isLoggedIn = !!user && !isLoadingAuth;

  // Sidebar conversation list (no embedded messages for Supabase mode)
  const [conversations, setConversations] = useState([]);
  // Active conversation's messages (loaded on demand)
  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [isLoadingConvs, setIsLoadingConvs] = useState(false);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);

  // ── Load conversation list ────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (isLoadingAuth) return;

    if (isLoggedIn) {
      setIsLoadingConvs(true);
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      setIsLoadingConvs(false);
      if (error) {
        toast.error('Failed to load conversations');
        return;
      }
      setConversations(
        (data || []).map((c) => ({
          id: c.id,
          title: c.title,
          timestamp: c.updated_at ?? c.created_at,
        }))
      );
    } else {
      // Guest: conversations stored with embedded messages in localStorage
      setConversations(
        lsLoad().map((c) => ({ id: c.id, title: c.title, timestamp: c.timestamp }))
      );
    }
  }, [isLoggedIn, isLoadingAuth]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Create conversation (local only — no DB row until first message) ──────
  // For guests this creates a full localStorage entry.
  // For logged-in users, returns a temporary local ID; persistConversation writes to DB.
  function createConversation(greetingText, lang) {
    const id = crypto.randomUUID();
    const greeting = greetingText
      ? makeMsg({ role: 'assistant', content: greetingText })
      : null;

    setMessages(greeting ? [greeting] : []);
    setActiveId(id);

    if (!isLoggedIn) {
      // Guest: save to localStorage immediately
      const conv = {
        id,
        title: null,
        lang,
        timestamp: new Date().toISOString(),
        messages: greeting ? [greeting] : [],
      };
      const existing = lsLoad();
      lsSave([conv, ...existing]);
      setConversations((prev) => [
        { id, title: null, timestamp: conv.timestamp },
        ...prev,
      ]);
    }
    // Logged-in: conversation row created lazily on first user message

    return id;
  }

  // ── Persist conversation row to Supabase (called before first message) ────
  async function persistConversation(title) {
    if (!isLoggedIn) return activeId; // guest: already exists in localStorage

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: title || 'New conversation' })
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to create conversation');
      return null;
    }

    const newId = data.id;

    // Flush any pending local messages (e.g., the greeting) to Supabase
    if (messages.length > 0) {
      await supabase.from('messages').insert(
        messages.map((m) => ({
          id: m.id,
          conversation_id: newId,
          role: m.role,
          content: m.content,
          edited: false,
          cards: m.cards ?? null,
        }))
      );
    }

    setActiveId(newId);
    setConversations((prev) => [
      { id: newId, title: title || 'New conversation', timestamp: new Date().toISOString() },
      ...prev,
    ]);
    return newId;
  }

  // ── Append a message ──────────────────────────────────────────────────────
  async function appendMessage(convId, msgPartial) {
    const msg = makeMsg(msgPartial);

    // Optimistic update
    setMessages((prev) => [...prev, msg]);

    if (isLoggedIn) {
      const { error } = await supabase.from('messages').insert({
        id: msg.id,
        conversation_id: convId,
        role: msg.role,
        content: msg.content,
        edited: false,
        cards: msg.cards ?? null,
      });
      if (error) {
        toast.error('Message failed to save');
        // Roll back optimistic update
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        return;
      }
      // Touch conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);

      // Sync sidebar timestamp
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, timestamp: new Date().toISOString() } : c
        )
      );
    } else {
      // Guest: update localStorage
      const convs = lsLoad().map((c) => {
        if (c.id !== convId) return c;
        const msgs = [...(c.messages || []), msg];
        const title = c.title ?? (msg.role === 'user' ? msg.content.slice(0, 40) : null);
        return { ...c, messages: msgs, title };
      });
      lsSave(convs);
      // Update sidebar
      const updated = convs.find((c) => c.id === convId);
      if (updated) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { id: c.id, title: updated.title, timestamp: updated.timestamp } : c
          )
        );
      }
    }
  }

  // ── Edit a message (truncate everything after it) ─────────────────────────
  async function editMessage(convId, msgId, newText) {
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;

    const editedAt = new Date().toISOString();
    const updatedMsg = { ...messages[idx], content: newText, edited: true, editedAt };

    // Optimistic: truncate to edited message
    setMessages([...messages.slice(0, idx), updatedMsg]);

    if (isLoggedIn) {
      // Update the edited message
      const { error: updateError } = await supabase
        .from('messages')
        .update({ content: newText, edited: true, edited_at: editedAt })
        .eq('id', msgId);

      if (updateError) {
        toast.error('Failed to update message');
        setMessages(messages); // restore
        return;
      }

      // Delete all messages that came after the edited one
      const laterMsgs = messages.slice(idx + 1);
      if (laterMsgs.length > 0) {
        await supabase
          .from('messages')
          .delete()
          .in('id', laterMsgs.map((m) => m.id));
      }
    } else {
      // Guest: update localStorage
      const convs = lsLoad().map((c) => {
        if (c.id !== convId) return c;
        const i = (c.messages || []).findIndex((m) => m.id === msgId);
        if (i === -1) return c;
        const updated = { ...c.messages[i], content: newText, edited: true, editedAt };
        return { ...c, messages: [...c.messages.slice(0, i), updated] };
      });
      lsSave(convs);
    }
  }

  // ── Switch to an existing conversation ───────────────────────────────────
  async function switchConversation(convId) {
    if (convId === activeId) return;
    setActiveId(convId);
    setMessages([]);

    if (isLoggedIn) {
      setIsLoadingMsgs(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      setIsLoadingMsgs(false);
      if (error) {
        toast.error('Failed to load messages');
        return;
      }
      setMessages((data || []).map(dbRowToMsg));
    } else {
      const conv = lsLoad().find((c) => c.id === convId);
      setMessages(conv ? ensureIds(conv.messages) : []);
    }
  }

  // ── Delete a conversation ─────────────────────────────────────────────────
  async function deleteConversation(convId) {
    // Optimistic
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeId === convId) {
      setActiveId(null);
      setMessages([]);
    }

    if (isLoggedIn) {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', convId);
      if (error) {
        toast.error('Failed to delete conversation');
        loadConversations(); // restore
      }
    } else {
      const convs = lsLoad().filter((c) => c.id !== convId);
      lsSave(convs);
    }
  }

  return {
    conversations,
    activeId,
    messages,
    isLoggedIn,
    isLoadingConvs,
    isLoadingMsgs,
    createConversation,
    persistConversation,
    appendMessage,
    editMessage,
    deleteConversation,
    switchConversation,
  };
}
