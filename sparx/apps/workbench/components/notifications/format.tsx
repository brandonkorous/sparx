'use client';

// How a notification LOOKS and where it LEADS — shared by the bell and Pulse.
//
// Both render the same row, so both read from here. Kept together because these
// four decisions are one decision: a row's hue, its glyph, its unread mark and
// its destination all answer "what is this and where does it take me?", and
// splitting them is how the bell and the inbox end up disagreeing about what
// the same notification is.

import { MessageSquare, Bell, type LucideIcon } from 'lucide-react';
import { routeAcceptsId, routeForEntity } from '@wizeworks/links';
import type { AppNotification } from '../../lib/api/notifications';
import { moduleIcon } from '../../lib/surfaces/nav';
import { ModuleScope, WORKBENCH_MODULES, type WorkbenchModule } from '../module-scope';

const MODULE_KEYS = new Set<string>(WORKBENCH_MODULES);

/** Severity is the semantic color axis — independent of any module hue. */
export function severityTone(
  severity: AppNotification['severity']
): 'success' | 'warning' | 'danger' | 'info' {
  if (severity === 'success' || severity === 'warning' || severity === 'danger') return severity;
  return 'info';
}

/** The unread dot's fill. Spelled out rather than interpolated because Tailwind
 *  only emits classes it can see written literally. */
export const SEVERITY_DOT: Record<'success' | 'warning' | 'danger' | 'info', string> = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Which module's hue this notification wears.
 *
 * `module` arrives as a plain string from the API and can name a module this
 * build doesn't know, so it is checked rather than cast. Falls back to
 * `platform` — the honest answer for an account-level notice (a message from
 * sparx belongs to no business module) and a safe one for an unknown key.
 */
export function moduleOf(notification: AppNotification): WorkbenchModule {
  const key = notification.module;
  return key !== null && MODULE_KEYS.has(key) ? (key as WorkbenchModule) : 'platform';
}

/**
 * The glyph in the row's box. Module icon by default, so a row is recognisable
 * as "Selling" or "Inventory" before it is read at all.
 *
 * `entityType` overrides it where a module icon would actively mislead: a reply
 * from the sparx team is correspondence, not a workbench dashboard.
 */
export function iconFor(notification: AppNotification): LucideIcon {
  if (notification.entityType === 'feedback') return MessageSquare;
  return moduleIcon(moduleOf(notification)) ?? Bell;
}

/**
 * Where a notification LEADS.
 *
 * The row carries `entityType`/`entityId` precisely so the consumer can resolve a
 * destination without a stored route — the notifications table deliberately has
 * no `href` column, because where a thing lives is a per-app concept and baking
 * one app's paths into the database outlives that app. A notification that only
 * marks itself read is a dead end: it announces something and then makes you go
 * find it.
 *
 * This resolves through the SAME entity table that universal search and every
 * emailed link use (`@wizeworks/links`), rather than a list of its own. It used to
 * know exactly one type — feedback — so every other notification in the bell was
 * a dead end, while the command palette could already open twenty-four of them.
 * One table means the two cannot disagree about where an order is again.
 */
export function destinationFor(
  notification: AppNotification
): { surface: string; params?: Record<string, string> } | null {
  const type = notification.entityType;
  if (type === null || type === undefined) return null;

  const route = routeForEntity(type);
  if (!route) return null;

  // An entity whose home is a LIST (no path parameter) still leads somewhere —
  // it just lands on the list rather than preselecting a row, which is the
  // honest answer when no detail surface exists.
  if (!routeAcceptsId(route)) return { surface: route.surface };
  if (!notification.entityId) return null;
  return { surface: route.surface, params: { id: notification.entityId } };
}

/**
 * The module box: WHERE this came from, answered before the row is read.
 *
 * `bg-module bg-soft` is the same theme-aware tint the module cards use,
 * repointed per row by ModuleScope's data attribute — so the hue comes from the
 * token cascade rather than a color table in here.
 */
export function NotificationIcon({ notification }: { notification: AppNotification }) {
  const Icon = iconFor(notification);
  return (
    <ModuleScope module={moduleOf(notification)} className="shrink-0">
      <span className="bg-module bg-soft text-module flex size-7 items-center justify-center rounded">
        <Icon className="size-3.5" aria-hidden />
      </span>
    </ModuleScope>
  );
}

/** A notification, plus how many identical ones it stands for. */
export interface NoticeRun {
  notice: AppNotification;
  count: number;
  /** Every id in the run, so marking the line read marks all of them. */
  ids: string[];
}

/**
 * Folds consecutive identical notifications into one line with a count.
 *
 * The same problem the activity feed solved, arriving here for a different
 * reason. Titles ARE templated (`{{order.total}}` in platform.notify), so a
 * well-authored rule produces distinct lines — but a rule written as plain "New
 * order" produces twenty rows distinguishable only by timestamp, and since the
 * row shows no message preview those rows are literally identical on screen.
 * Collapsing makes the product forgiving of that rule rather than punishing the
 * reader for it.
 *
 * Consecutive only, and keyed on title as well as kind: two notices of the same
 * kind naming different records ("Order #1042", "Order #1043") are two facts,
 * and an unrelated notice in between legitimately breaks the run. Nothing is
 * hidden — the count says exactly how many there were, and marking the line read
 * marks every row it stands for.
 *
 * Read state joins the key too. A run that mixed read and unread rows could only
 * render one of the two, so it would either re-bold something already dealt with
 * or bury something that still needs doing.
 */
export function collapseNotices(items: readonly AppNotification[]): NoticeRun[] {
  const runs: NoticeRun[] = [];
  for (const notice of items) {
    const previous = runs[runs.length - 1];
    if (
      previous?.notice.kind === notice.kind &&
      previous.notice.title === notice.title &&
      (previous.notice.readAt === null) === (notice.readAt === null)
    ) {
      previous.count += 1;
      previous.ids.push(notice.id);
      continue;
    }
    runs.push({ notice, count: 1, ids: [notice.id] });
  }
  return runs;
}
