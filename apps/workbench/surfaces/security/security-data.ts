'use client';

// Security data — sign-in rules, signed-in devices, and the account's activity
// record.
//
// Two very different sources feed this one surface, and the split matters:
//
//   • Passwords and sessions are Better Auth's, not api-rest's. The workbench
//     mounts the Better Auth handler at /api/auth/* on its OWN origin (see
//     app/api/auth/[...all]/route.ts), and the session cookie is host-only to
//     it. So changing a password or signing a device out is a same-origin call
//     through `authClient` — NOT a Bearer call to api-rest, which has no session
//     endpoints at all. This is the real system: Better Auth 1.6 ships
//     change-password / list-sessions / revoke-session / revoke-other-sessions
//     as core routes, and there is no second implementation to reconcile.
//
//   • The activity record is api-rest's /v1/activity — the human feed that
//     turns the shared audit_logs table into sentences with resolved actor
//     names. It rides the same token/client as every other pane.
//
// Nothing here fakes two-step verification: the platform has no `twoFactor`
// plugin yet (see docs/brain/architecture/better-auth.md), so the surface says
// so honestly rather than drawing a toggle that does nothing.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { authClient } from '@sparx/auth/client';
import { api } from '../../lib/api/client';

/* ── Sessions (Better Auth) ─────────────────────────────────────────────────
   `listSessions` hands back the raw session rows: a token (the id we revoke
   by), when it started, when it was last touched, and the ip / user-agent it
   was seen from. There is no geo-IP on the platform, so "location" is the
   network address shown plainly — an honest fact rather than an invented city. */

export interface AuthSession {
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export const SESSIONS_KEY = ['security', 'sessions'] as const;

/** Coerce Better Auth's Date-or-string fields to ISO strings so the rest of the
 *  surface never has to care which the client handed back. */
function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async (): Promise<AuthSession[]> => {
      const { data, error } = await authClient.listSessions();
      // Better Auth returns { data, error } rather than throwing; React Query
      // needs a throw to treat this as a failed load.
      if (error) throw new Error(error.message ?? 'Could not load your signed-in devices.');
      const rows = (data ?? []) as Record<string, unknown>[];
      return rows
        .map((row) => ({
          token: typeof row.token === 'string' ? row.token : '',
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
          expiresAt: toIso(row.expiresAt),
          ipAddress: typeof row.ipAddress === 'string' ? row.ipAddress : null,
          userAgent: typeof row.userAgent === 'string' ? row.userAgent : null,
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    staleTime: 30_000,
  });
}

/** Sign one device out by its session token. */
export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(error.message ?? 'Could not sign that device out.');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

/** Sign out every device EXCEPT the one making the request. */
export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message ?? 'Could not sign the other devices out.');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

/* ── Password (Better Auth) ─────────────────────────────────────────────── */

/** The server enforces this too (emailAndPassword.minPasswordLength = 8); it is
 *  mirrored here only so the form can refuse before a round-trip. */
export const MIN_PASSWORD_LENGTH = 8;

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  /** Also end every OTHER signed-in session — the safe default after a change
   *  someone made because they think a password leaked. */
  revokeOtherSessions: boolean;
}

/**
 * Change the signed-in user's password.
 *
 * The current password is required and verified server-side, so this is
 * self-authenticating — a leaked, still-open tab cannot change the password
 * without knowing the old one. The server's own message is surfaced verbatim on
 * failure (it distinguishes "wrong current password" from a weak new one), which
 * is the most specific true thing available.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const { error } = await authClient.changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: input.revokeOtherSessions,
      });
      if (error) {
        throw new Error(
          error.message ??
            'Could not change your password. Check your current password and try again.'
        );
      }
    },
    onSuccess: () => {
      // Revoking other sessions changes the device list.
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

/* ── Activity record (api-rest /v1/activity) ────────────────────────────────
   The human feed, not the forensic /v1/audit dump: humanized titles, resolved
   actor names, and reads already filtered out. That is exactly "who did what,
   when" for a business owner. */

export interface ActivityActor {
  id: string | null;
  type: string;
  /** Null means "not a person did this" — a background job, the system, an API
   *  key. Reported honestly rather than invented. */
  name: string | null;
}

export interface ActivityEntry {
  id: string;
  at: string;
  action: string;
  module: string | null;
  title: string;
  subject: string | null;
  entityType: string | null;
  entityId: string | null;
  actor: ActivityActor;
}

/** How many activity rows to show. Grows in steps rather than paging, because
 *  this is a recent-history view someone skims, not a table they navigate; the
 *  endpoint caps at 200, which is where "Show more" stops. */
export const ACTIVITY_PAGE = 20;
export const ACTIVITY_MAX = 200;

export function useActivity(limit: number) {
  return useQuery({
    queryKey: ['security', 'activity', limit],
    queryFn: () =>
      api
        .get<{ items: ActivityEntry[] }>('/v1/activity', { limit })
        .then((response) => response.items),
    staleTime: 30_000,
  });
}

/* ── Display helpers ────────────────────────────────────────────────────── */

/** State is its own colour axis: an activity row's tone comes from what KIND of
 *  change it was, so a wall of history becomes scannable — removals read red,
 *  new things read green, edits read blue. Derived from the action verb because
 *  every module names its actions the same way (`crm.customer.created`,
 *  `team.member.removed`), so one rule covers all of them without a per-module
 *  table to keep in sync. */
export function activityTone(action: string): 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  const verb = action.split('.').pop() ?? '';
  if (
    /(deleted|removed|revoked|cancelled|canceled|disconnected|voided|failed|suspended)$/.test(verb)
  ) {
    return 'error';
  }
  if (
    /(created|added|sent|placed|paid|published|completed|approved|connected|verified|invited)$/.test(
      verb
    )
  ) {
    return 'success';
  }
  if (/(updated|changed|edited|renamed|moved|reordered|assigned)$/.test(verb)) {
    return 'info';
  }
  if (/(warning|flagged|expired|overdue|rejected|declined)$/.test(verb)) {
    return 'warning';
  }
  return 'neutral';
}

/** A short label for the tone badge — the verb, capitalised, in plain words. */
export function activityKindLabel(action: string): string {
  const verb = (action.split('.').pop() ?? '').replace(/_/g, ' ');
  if (verb.length === 0) return 'Activity';
  return verb.charAt(0).toUpperCase() + verb.slice(1);
}

/**
 * Turn a raw user-agent string into "Chrome on macOS" — the two facts a person
 * actually recognises about a device. Best-effort and deliberately coarse: the
 * goal is "is this the laptop I'm on or something I don't know?", not a forensic
 * breakdown. An unparseable or absent agent falls back to an honest "Unknown
 * device" rather than a made-up guess.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent || userAgent.trim() === '') return 'Unknown device';

  const browser = /edg\//i.test(userAgent)
    ? 'Edge'
    : /opr\/|opera/i.test(userAgent)
      ? 'Opera'
      : /chrome|crios/i.test(userAgent)
        ? 'Chrome'
        : /firefox|fxios/i.test(userAgent)
          ? 'Firefox'
          : /safari/i.test(userAgent)
            ? 'Safari'
            : null;

  const os = /windows/i.test(userAgent)
    ? 'Windows'
    : /iphone|ipad|ipod/i.test(userAgent)
      ? 'iOS'
      : /mac os x|macintosh/i.test(userAgent)
        ? 'macOS'
        : /android/i.test(userAgent)
          ? 'Android'
          : /linux/i.test(userAgent)
            ? 'Linux'
            : null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'Unknown device';
}
