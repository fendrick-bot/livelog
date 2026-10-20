import type { AdminNotification } from '@livelog/shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { queryClient } from '../lib/query-client';
import { getSocket } from '../lib/socket';

/** Admin-only: surfaces new stories, comments and subscribers as toasts. */
export function useAdminNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    const socket = getSocket();
    const onNotify = (notification: AdminNotification) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast(notification.message, {
        icon: notification.kind === 'story' ? '✉️' : notification.kind === 'comment' ? '🖋️' : '🔔',
        action: notification.href
          ? { label: 'Open', onClick: () => void navigate(notification.href!) }
          : undefined,
      });
    };
    socket.on('admin:notify', onNotify);
    return () => {
      socket.off('admin:notify', onNotify);
    };
  }, [isAdmin, navigate]);
}
