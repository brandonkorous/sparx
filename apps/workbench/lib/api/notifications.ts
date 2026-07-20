// Notifications — "what needs me?" (docs/124 Phase 3).
//
// Addressed to the signed-in person, with read/unread state. That is what
// separates this from the activity feed: activity is ambient context nobody has
// to acknowledge, a notification is aimed at you and waits until you deal with
// it.
//
// Rows are written by the automation engine's `platform.notify` action, so what
// appears here is governed by tenant-editable rules rather than hardcoded in a
// worker — see packages/automation/src/actions/notify.ts.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from './client';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  module: string | null;
  severity: NotificationSeverity;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

/** Slower than the jobs chip on purpose: a notification is not a progress bar,
 *  and an inbox that repaints every four seconds is a distraction machine. */
const POLL_MS = 45_000;

const KEY = ['notifications', 'all'] as const;

export function useNotifications(): {
  items: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
} {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<NotificationsResponse>('/v1/notifications', { state: 'all', limit: 30 }),
    refetchInterval: POLL_MS,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/v1/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: () => api.post('/v1/notifications/read-all'),
    onSuccess: invalidate,
  });

  return {
    items: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    markRead: (id: string) => {
      readOne.mutate(id);
    },
    markAllRead: () => {
      readAll.mutate();
    },
  };
}
