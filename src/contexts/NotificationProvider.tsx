import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { notificationsAPI } from '../services/notifications';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.getNotifications();
      setNotifications(response.notifications.map(n => ({ ...n, read: Boolean(n.read) })));
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // Silently fail - notification read is non-critical
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead, refresh }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationAdapter() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationAdapter must be used within a NotificationProvider');
  }
  return context;
}
