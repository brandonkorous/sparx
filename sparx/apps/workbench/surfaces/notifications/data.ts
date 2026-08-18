'use client';

// Notification preferences — what sparx tells the signed-in person about, and
// whether it reaches them by email or only in their inbox here.
//
// Per-PERSON, not per-site: a notification is addressed to you, so these are
// your choices wherever you are working. Stored on the user record and served
// by /v1/me/notification-preferences (api-rest), which fills every gap with a
// default — so `channels` is always a complete map, never a sparse one this
// surface has to reason about.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  CalendarClock,
  FileText,
  Globe,
  Package,
  ReceiptText,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import type { WorkbenchModule } from '../../components/module-scope';

/** inbox + email · inbox only · muted. Mirrors the server enum. */
export type NotificationChannel = 'email' | 'inapp' | 'off';
export type EmailDigest = 'immediate' | 'daily' | 'weekly';

export type NotificationCategory =
  | 'orders'
  | 'payments'
  | 'inventory'
  | 'customers'
  | 'content'
  | 'bookings'
  | 'sites'
  | 'team'
  | 'system';

export interface NotificationPreferences {
  channels: Record<NotificationCategory, NotificationChannel>;
  digest: EmailDigest;
}

const KEY = ['notification-preferences'] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<NotificationPreferences>('/v1/me/notification-preferences'),
  });
}

export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      api.put<NotificationPreferences>('/v1/me/notification-preferences', preferences),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
    },
  });
}

/**
 * The categories a person tunes, in the order they read on the screen: money and
 * customer-facing things first, ambient housekeeping last. Each carries the
 * PLAIN-LANGUAGE name and one line of examples — never the raw event names the
 * system uses internally. `module` tints the row with that part of sparx's hue.
 */
export interface CategoryMeta {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Which part of sparx this belongs to, for the row's accent. Null = account. */
  module: WorkbenchModule | null;
}

export const NOTIFICATION_CATEGORY_META: readonly CategoryMeta[] = [
  {
    key: 'orders',
    label: 'Orders & sales',
    description: 'A new order comes in, or one needs a second look before it ships.',
    icon: Package,
    module: 'commerce',
  },
  {
    key: 'payments',
    label: 'Payments & billing',
    description: 'A payment goes through or fails, a refund is issued, or an invoice is paid.',
    icon: ReceiptText,
    module: 'invoicing',
  },
  {
    key: 'inventory',
    label: 'Stock levels',
    description: 'Something is running low or has sold out and may need reordering.',
    icon: Boxes,
    module: 'inventory',
  },
  {
    key: 'customers',
    label: 'Customers & enquiries',
    description: 'Someone signs up, sends a message, asks a question, or leaves a review.',
    icon: Users,
    module: 'crm',
  },
  {
    key: 'content',
    label: 'Content & forms',
    description: 'A scheduled page or post goes live, or someone fills in a form on your site.',
    icon: FileText,
    module: 'cms',
  },
  {
    key: 'bookings',
    label: 'Bookings & appointments',
    description: 'An appointment is booked, moved, or cancelled.',
    icon: CalendarClock,
    module: 'scheduling',
  },
  {
    key: 'sites',
    label: 'Sites & web addresses',
    description: 'A web address goes live, or one needs your attention to stay secure.',
    icon: Globe,
    module: 'platform',
  },
  {
    key: 'team',
    label: 'Team & security',
    description: 'Someone joins or leaves, a role changes, or a sign-in looks unusual.',
    icon: ShieldCheck,
    module: 'platform',
  },
  {
    key: 'system',
    label: 'Background tasks',
    description: 'A long job you started — an import, an export, a bulk change — finishes.',
    icon: Wrench,
    module: 'platform',
  },
] as const;

/** The three delivery choices, in plain words. Ordered most-reaching first so
 *  the dropdown reads from "tell me everywhere" down to "don't tell me". */
export const CHANNEL_OPTIONS: readonly { value: NotificationChannel; label: string }[] = [
  { value: 'email', label: 'Email and in your inbox' },
  { value: 'inapp', label: 'Only in your inbox' },
  { value: 'off', label: "Don't notify me" },
] as const;

export const DIGEST_OPTIONS: readonly { value: EmailDigest; label: string; hint: string }[] = [
  {
    value: 'immediate',
    label: 'As it happens',
    hint: 'One email per notification, sent right away.',
  },
  {
    value: 'daily',
    label: 'Once a day',
    hint: 'Everything from the day rolled into a single morning email.',
  },
  {
    value: 'weekly',
    label: 'Once a week',
    hint: 'A single email each week summing up what happened.',
  },
] as const;

/** Stable, order-independent comparison so the Save button only lights up on a
 *  real change (not on a key being reordered in the object). */
export function preferencesEqual(a: NotificationPreferences, b: NotificationPreferences): boolean {
  if (a.digest !== b.digest) return false;
  return NOTIFICATION_CATEGORY_META.every((meta) => a.channels[meta.key] === b.channels[meta.key]);
}
