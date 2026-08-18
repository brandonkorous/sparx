'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE TASK DATA LAYER
//
// A task is a piece of work to do for a customer or a deal — "call back", "send
// the quote" — assigned to someone on the team, usually with a due date. It has
// three states: open, completed, cancelled. Completing has its own endpoint (it
// records who finished it and when), so it is its own mutation here.
//
// The write shapes mirror the CRM's own `CreateTaskInput` / `UpdateTaskInput`
// (Zod in `@wizeworks/crm-schemas`), named locally because that package is not a
// dependency of this app; the server runs that Zod and has the final say.
//
//   ['crm','tasks']              the root every read nests under
//   ['crm','tasks','list',{…}]   one list window
//   ['crm','tasks', id]          one task, in full
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import type { TaskPriority, TaskStatus } from '@wizeworks/crm-schemas';
import { api } from '../../lib/api/client';

// `TaskStatus` / `TaskPriority` are the server's own enums (`@wizeworks/crm-schemas`).
// `CreateTaskInput` / `UpdateTaskInput` below stay narrow local write payloads
// (the `DiscountInput` house pattern), so they name only what this pane sends.
export type { TaskPriority, TaskStatus };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The customer a task is about, carried alongside the task so a list can name
 *  the subject without a second request. */
export interface TaskCustomerLink {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  completedAt: string | null;
  assignedToUserId: string;
  customerId: string | null;
  dealId: string | null;
  customer: TaskCustomerLink | null;
  deal: { title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListParams {
  q?: string;
  status?: TaskStatus;
  assignedToUserId?: string;
  customerId?: string;
  dealId?: string;
}

export const taskKeys = {
  all: ['crm', 'tasks'] as const,
  list: (params: TaskListParams) => [...taskKeys.all, 'list', params] as const,
  detail: (id: string) => [...taskKeys.all, id] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export const TASK_STATUSES: TaskStatus[] = ['open', 'completed', 'cancelled'];
export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/** Whether an OPEN task is past its due date. Completed/cancelled tasks are
 *  never "overdue" — the work is settled. */
export function isOverdue(task: { status: string; dueAt: string | null }): boolean {
  if (task.status !== 'open' || !task.dueAt) return false;
  const due = new Date(task.dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

/**
 * How a task's state reads — plain label + tone for the badge. A curated map,
 * NOT the generic `statusTone`: that treats "open" as success (green), which is
 * wrong for a to-do that still needs doing. Here open reads as info (pending),
 * done as success, cancelled as neutral, and an overdue-open task as danger.
 */
export function taskStatusMeta(
  status: string,
  overdue = false
): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' } {
  if (status === 'completed') return { label: 'Done', tone: 'success' };
  if (status === 'cancelled') return { label: 'Cancelled', tone: 'neutral' };
  if (overdue) return { label: 'Overdue', tone: 'danger' };
  return { label: 'To do', tone: 'info' };
}

/** The subject a task is about, in words: the customer's name, else the deal's
 *  title, else null (a general to-do). */
export function taskSubject(task: Task): string | null {
  if (task.customer) {
    const name = [task.customer.firstName, task.customer.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
    if (task.customer.company?.trim()) return task.customer.company.trim();
    if (task.customer.email?.trim()) return task.customer.email.trim();
    return 'A customer';
  }
  if (task.deal) return task.deal.title;
  return null;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () =>
      api.list<Task>('/v1/crm/tasks', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.assignedToUserId ? { assigned_to_user_id: params.assignedToUserId } : {}),
        ...(params.customerId ? { customer_id: params.customerId } : {}),
        ...(params.dealId ? { deal_id: params.dealId } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => api.get<Task>(`/v1/crm/tasks/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Deals, for the task's "about a deal" picker. A light read — id + title only. */
interface DealOption {
  id: string;
  title?: string | null;
  name?: string | null;
}
export function useDealOptions() {
  return useQuery({
    queryKey: ['crm', 'deals', 'options'],
    queryFn: () => api.list<DealOption>('/v1/crm/deals', { take: 200 }),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** Create payload — `assignedToUserId` is required by the server. */
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
  assignedToUserId: string;
  customerId?: string | null;
  dealId?: string | null;
}

/** Update payload — every field optional, plus the status flip. */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
  assignedToUserId?: string;
  customerId?: string | null;
  dealId?: string | null;
  status?: TaskStatus;
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.post<Task>('/v1/crm/tasks', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateTask(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (patch: UpdateTaskInput) => api.patch<Task>(`/v1/crm/tasks/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Mark a task done via the dedicated endpoint (records who + when). Idempotent
 *  server-side. */
export function useCompleteTask(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: () => api.post<Task>(`/v1/crm/tasks/${id}/complete`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function taskErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
