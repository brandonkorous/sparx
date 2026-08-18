'use client';

// Messages (the `chat` module) data — the conversation queue, one thread and its
// messages, the canned replies, the widget configuration, and the reporting
// aggregates.
//
// This file OWNS every `['chat', …]` query key and the shapes the four chat
// surfaces read. The vocabulary is deliberately plain: a "conversation" is a
// chat with one person, a "quick reply" is a saved thing you can send with one
// click, and the AI "first responder" is the assistant that answers when nobody
// on the team is around. The helpers at the bottom translate the backend's terse
// enums into that language once, so every surface says the same thing.
//
// LIVE UPDATES — socket first, poll as the fallback. The chat WebSocket in
// api-rest (`/ws/chat`) is now wired here: live.ts holds ONE socket and pushes
// every server event straight into the ['chat', …] cache below (that is the seam
// these query keys were built to be). The polling stays as a safety net for a
// missed broadcast or a dropped connection — RELAXED while the socket is healthy
// (isChatLive()) and TIGHTENED the instant it drops, so freshness never depends
// on the socket alone. This still mirrors the app's awareness layer
// (lib/api/activity.ts, lib/api/jobs.ts); the socket just makes the common case
// instant instead of up-to-a-poll late.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import { isChatLive } from './live-status';

/* ── Domain shapes (mirror wizeworks/services/api-rest/src/lib/chat) ────────────────── */

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'spam';
export type SenderType = 'customer' | 'staff' | 'ai';
export type ChatSource = 'site' | 'sparx_market' | 'dashboard';

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  'open',
  'pending',
  'resolved',
  'spam',
];

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  source: ChatSource;
  /** The site this conversation happened on, or null for a staff-to-staff thread
   *  (or one whose site was since removed — the record outlives the business). */
  propertyId: string | null;
  subject: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  assignedToId: string | null;
  unreadStaff: number;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  body: string;
  attachments: unknown;
  aiGenerated: boolean;
  aiConfidence: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  placedAt: string;
}

export interface CustomerContext {
  linked: boolean;
  customerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
  recentOrders: RecentOrder[];
}

/* ── Widget configuration ─────────────────────────────────────────────────── */

export type AiProvider = 'anthropic' | 'openai';
export const AI_PROVIDERS: readonly AiProvider[] = ['anthropic', 'openai'];

export interface OperatingHours {
  timezone: string;
  /** 0 = Sunday … 6 = Saturday. null = closed that day. */
  days: Record<string, { open: string; close: string } | null>;
}

/** The client-safe config — the AI key ciphertext is replaced by a boolean. */
export interface ChatConfig {
  aiEnabled: boolean;
  aiProvider: AiProvider | null;
  aiKeyConfigured: boolean;
  collectEmail: boolean;
  greeting: string;
  awayMessage: string;
  primaryColor: string | null;
  primaryColorContent: string | null;
  position: 'bottom-right' | 'bottom-left';
  operatingHours: OperatingHours | null;
}

/** The partial the settings surface PATCHes. `aiApiKey` is plaintext — the
 *  server verifies then encrypts it, and rejects a bad one; omit to leave the
 *  stored key untouched, pass null to disconnect. */
export interface ChatConfigPatch {
  aiEnabled?: boolean;
  aiProvider?: AiProvider | null;
  aiApiKey?: string | null;
  collectEmail?: boolean;
  greeting?: string;
  awayMessage?: string;
  primaryColor?: string | null;
  primaryColorContent?: string | null;
  position?: 'bottom-right' | 'bottom-left';
  operatingHours?: OperatingHours | null;
}

/* ── Analytics ────────────────────────────────────────────────────────────── */

export interface ChatSummary {
  rangeLabel: string;
  startedInRange: number;
  resolvedInRange: number;
  openNow: number;
  avgFirstResponseSeconds: number | null;
  aiResolved: number;
  humanResolved: number;
  aiHandledPct: number | null;
  byStatus: Record<ConversationStatus, number>;
  byChannel: { source: string; count: number }[];
}

export interface ChatTimeseriesPoint {
  bucket: string;
  started: number;
  resolved: number;
}

export interface ChatTimeseries {
  range: { from: string; to: string; grain: 'day' | 'week' | 'month' };
  points: ChatTimeseriesPoint[];
  totals: { started: number; resolved: number };
}

export interface ChatAgentRow {
  kind: 'staff' | 'ai';
  id: string | null;
  name: string;
  handled: number;
  avgResponseSeconds: number | null;
}

export interface ChatActivityItem {
  id: string;
  conversationId: string;
  senderType: string;
  aiGenerated: boolean;
  who: string;
  snippet: string;
  createdAt: string;
}

/* ── Query keys ───────────────────────────────────────────────────────────── */

export interface ConversationsFilter {
  /** A site id, or the literal `all` for the cross-site inbox. Omit for the
   *  active site (resolved from the header server-side). */
  property?: string;
  status?: ConversationStatus;
  mine?: boolean;
  assignedTo?: string;
  q?: string;
  take?: number;
  skip?: number;
}

export const CHAT_KEYS = {
  conversations: (filter: ConversationsFilter) => ['chat', 'conversations', filter] as const,
  conversationsRoot: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  context: (id: string) => ['chat', 'conversation', id, 'context'] as const,
  quickReplies: ['chat', 'quick-replies'] as const,
  settings: ['chat', 'settings'] as const,
  summary: ['chat', 'analytics', 'summary'] as const,
  timeseries: ['chat', 'analytics', 'timeseries'] as const,
  agents: ['chat', 'analytics', 'agents'] as const,
  activity: ['chat', 'analytics', 'activity'] as const,
};

/* ── Poll cadences (the socket's fallback) ────────────────────────────────── */

// Two cadences each: the FALLBACK one when the socket is down (the old live-ish
// clock), and a RELAXED safety-net one while it is connected — the socket is
// carrying freshness then, so this only has to catch a rare missed broadcast.
// Deliberately never `false`: a slow poll under a healthy socket is cheap
// insurance, and it means a subtly-wrong connection flag degrades to "a little
// late", never to "silently stuck".
const INBOX_POLL_MS = 15_000;
const INBOX_POLL_LIVE_MS = 60_000;
const THREAD_POLL_MS = 5_000;
const THREAD_POLL_LIVE_MS = 20_000;

/** The active inbox refetch interval — relaxed while the socket is connected. */
function inboxPollInterval(): number {
  return isChatLive() ? INBOX_POLL_LIVE_MS : INBOX_POLL_MS;
}
/** The active open-thread refetch interval — relaxed while the socket is connected. */
function threadPollInterval(): number {
  return isChatLive() ? THREAD_POLL_LIVE_MS : THREAD_POLL_MS;
}

/* ── Reads ────────────────────────────────────────────────────────────────── */

/** One page of the conversation queue. Paged envelope, so `total` comes back for
 *  the pager. */
export function useConversations(filter: ConversationsFilter) {
  return useQuery({
    queryKey: CHAT_KEYS.conversations(filter),
    queryFn: () =>
      api.list<ConversationSummary>('/v1/chat/conversations', {
        ...(filter.property ? { property: filter.property } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.mine ? { mine: 'true' } : {}),
        ...(filter.assignedTo ? { assigned_to: filter.assignedTo } : {}),
        ...(filter.q ? { q: filter.q } : {}),
        ...(filter.take ? { take: filter.take } : {}),
        ...(filter.skip ? { skip: filter.skip } : {}),
      }),
    refetchInterval: inboxPollInterval,
    placeholderData: (previous) => previous,
  });
}

/** One conversation and its messages. Polls while open so replies from the
 *  visitor (or a teammate in another window) append on their own. */
export function useConversation(id: string) {
  return useQuery({
    queryKey: CHAT_KEYS.conversation(id),
    queryFn: () =>
      api.get<ConversationDetail>(`/v1/chat/conversations/${id}`, { message_take: 200 }),
    enabled: id !== '',
    refetchInterval: threadPollInterval,
  });
}

/** The CRM "who am I talking to" panel for a conversation. */
export function useCustomerContext(id: string) {
  return useQuery({
    queryKey: CHAT_KEYS.context(id),
    queryFn: () => api.get<CustomerContext>(`/v1/chat/conversations/${id}/context`),
    enabled: id !== '',
    staleTime: 60_000,
  });
}

/** Canned replies offered on the active site (its own plus tenant-wide ones). */
export function useQuickReplies() {
  return useQuery({
    queryKey: CHAT_KEYS.quickReplies,
    queryFn: () => api.get<QuickReply[]>('/v1/chat/quick-replies'),
    staleTime: 60_000,
  });
}

export function useChatConfig() {
  return useQuery({
    queryKey: CHAT_KEYS.settings,
    queryFn: () => api.get<ChatConfig>('/v1/chat/settings'),
  });
}

export function useChatSummary() {
  return useQuery({
    queryKey: CHAT_KEYS.summary,
    queryFn: () => api.get<ChatSummary>('/v1/chat/analytics/summary'),
  });
}

export function useChatTimeseries() {
  return useQuery({
    queryKey: CHAT_KEYS.timeseries,
    queryFn: () => api.get<ChatTimeseries>('/v1/chat/analytics/timeseries', { grain: 'day' }),
  });
}

export function useChatAgents() {
  return useQuery({
    queryKey: CHAT_KEYS.agents,
    queryFn: () => api.get<ChatAgentRow[]>('/v1/chat/analytics/agents'),
  });
}

export function useChatActivity(limit = 12) {
  return useQuery({
    queryKey: CHAT_KEYS.activity,
    queryFn: () => api.get<ChatActivityItem[]>('/v1/chat/analytics/activity', { limit }),
  });
}

/* ── Writes ───────────────────────────────────────────────────────────────── */

function useInvalidateConversations() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversationsRoot });
    if (id) void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversation(id) });
  };
}

/** Send a staff reply. The thread refetch picks up the appended message; this
 *  also refreshes the list so the last-message preview and ordering move. */
export function useSendMessage(id: string) {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<ChatMessage>(`/v1/chat/conversations/${id}/messages`, { body }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Assign / resolve / reopen / mark-spam — every lifecycle move is one PATCH. */
export function useUpdateConversation(id: string) {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (patch: { status?: ConversationStatus; assignedToId?: string | null }) =>
      api.patch<ConversationSummary>(`/v1/chat/conversations/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Clear the staff-unread counter when the thread is opened. Fire-and-forget
 *  from the thread's mount; invalidates the list so the badge clears there too. */
export function useMarkRead(id: string) {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>(`/v1/chat/conversations/${id}/read`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useCreateQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      body: string;
      shortcut?: string;
      propertyId?: string | null;
    }) => api.post<QuickReply>('/v1/chat/quick-replies', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.quickReplies });
    },
  });
}

export function useDeleteQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/chat/quick-replies/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.quickReplies });
    },
  });
}

export function useUpdateChatConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChatConfigPatch) => api.patch<ChatConfig>('/v1/chat/settings', patch),
    onSuccess: (config) => {
      queryClient.setQueryData(CHAT_KEYS.settings, config);
    },
  });
}

/* ── Presentation helpers (shared, so every surface speaks alike) ─────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info';

/** A conversation's lifecycle state as a color. Open needs a reply (info),
 *  waiting is on the customer (warning), resolved is done (success), spam is
 *  unwanted (error) — never a bland neutral pill. */
export function statusTone(status: ConversationStatus): Tone {
  switch (status) {
    case 'open':
      return 'info';
    case 'pending':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'spam':
      return 'error';
  }
}

/** The lifecycle state in plain words. */
export function statusLabel(status: ConversationStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'pending':
      return 'Waiting';
    case 'resolved':
      return 'Resolved';
    case 'spam':
      return 'Spam';
  }
}

/** Where a conversation came from, in the owner's words. */
export function sourceLabel(source: ChatSource): string {
  switch (source) {
    case 'site':
      return 'Your site';
    case 'sparx_market':
      return 'Marketplace';
    case 'dashboard':
      return 'Your team';
  }
}

/** Who sent a message, for its label. AI and staff are "your side"; the customer
 *  is the person you are helping. */
export function senderLabel(message: ChatMessage, customerName: string | null): string {
  switch (message.senderType) {
    case 'customer':
      return customerName ?? 'Visitor';
    case 'staff':
      return 'Your team';
    case 'ai':
      return 'AI assistant';
  }
}

/** A best-effort display name for a conversation row, never blank. */
export function conversationName(conversation: {
  customerName: string | null;
  customerEmail: string | null;
}): string {
  return conversation.customerName ?? conversation.customerEmail ?? 'Anonymous visitor';
}

const NUMBER = new Intl.NumberFormat();
const MONEY = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

export function formatCount(n: number): string {
  return NUMBER.format(Math.max(0, Math.round(n)));
}

/** A money value from the CRM context. Currency is not carried on the chat
 *  context DTO, so this assumes the platform default (USD) — the figure is a
 *  rough "how valuable is this customer" cue, not an invoice line. */
export function formatMoney(n: number): string {
  return MONEY.format(n);
}

/** A percentage from a 0–1 fraction, e.g. 0.62 → "62%". */
export function formatPct(fraction: number | null): string {
  if (fraction === null) return '—';
  return `${Math.round(fraction * 100)}%`;
}

/** A response latency in seconds as a coarse human duration, e.g. 95 → "2m". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** A short absolute time for a message, e.g. "3:42 PM" or "Mar 5, 3:42 PM". */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return date.toLocaleString(undefined, {
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The server's own sentence for a 4xx, worth showing verbatim: the settings
 * route explains exactly why a pasted AI key was rejected, and the conversation
 * routes name what went wrong. A 5xx has no such sentence, so it falls back to
 * the caller's wording.
 */
export function chatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
