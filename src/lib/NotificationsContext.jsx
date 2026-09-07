import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const NotificationsContext = createContext(null);
const NOTIFICATION_FIELDS = 'id,user_id,type,title,body,link,is_read,created_at';

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_FIELDS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  const markOneRead = useCallback(async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    let cancelled = false;
    let channel = null;

    const startNotifications = () => {
      if (cancelled) return;
      fetchNotifications();
      channel = supabase
        .channel(`notifications-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        })
        .subscribe();
    };

    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(startNotifications, { timeout: 1200 })
      : window.setTimeout(startNotifications, 650);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, markAllRead, markOneRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used within NotificationsProvider');
  return ctx;
}
