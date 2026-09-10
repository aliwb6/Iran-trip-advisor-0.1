import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const NotificationsContext = createContext(null);

// Keep this list aligned with the canonical public.notifications table.
// The table stores one human-readable message plus the related trip request id.
const NOTIFICATION_FIELDS = 'id,user_id,type,message,related_request_id,is_read,created_at';

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

      if (error) {
        console.error('Failed to load notifications', error);
        return;
      }

      const nextNotifications = data || [];
      setNotifications(nextNotifications);
      setUnreadCount(nextNotifications.filter(notification => !notification.is_read).length);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Failed to mark notifications as read', error);
      return;
    }

    setNotifications(prev => prev.map(notification => ({ ...notification, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  const markOneRead = useCallback(async (id) => {
    if (!id) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('is_read', false);

    if (error) {
      console.error('Failed to mark notification as read', error);
      return;
    }

    setNotifications(prev => {
      const wasUnread = prev.some(notification => notification.id === id && !notification.is_read);
      if (wasUnread) setUnreadCount(count => Math.max(0, count - 1));
      return prev.map(notification => notification.id === id ? { ...notification, is_read: true } : notification);
    });
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
          const notification = payload.new;
          setNotifications(prev => {
            if (prev.some(item => item.id === notification.id)) return prev;
            return [notification, ...prev].slice(0, 20);
          });
          if (!notification.is_read) setUnreadCount(prev => prev + 1);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, fetchNotifications)
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
