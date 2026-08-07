'use client';

// ══════════════════════════════════════════════════════════════════════════
// CONNECTED MAILBOXES (docs/144 §5.2)
//
// The email accounts sparx reads from and sends through, so a customer's
// record shows the actual conversation rather than only what the platform did.
//
//   ['crm','mailboxes']   every connected mailbox
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

export interface Mailbox {
  id: string;
  provider: string;
  scope: string;
  userId: string | null;
  emailAddress: string;
  displayName: string | null;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** The promise the connect flow made, readable afterwards. */
  syncGate: 'known_contacts_only' | 'everything';
}

export interface ConnectMailboxInput {
  emailAddress: string;
  appPassword: string;
  imapHost: string;
  imapPort?: number;
  smtpHost: string;
  smtpPort?: number;
  imapUser?: string;
  scope: 'personal' | 'shared';
  displayName?: string | null;
}

export interface SyncOutcome {
  ok: boolean;
  stored: number;
  skipped: number;
  error?: string;
}

export const mailboxKeys = {
  all: ['crm', 'mailboxes'] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/**
 * What a mailbox's state means, in a sentence rather than a status word.
 *
 * `expired` and `error` are genuinely different problems — one needs a new app
 * password, the other usually needs nothing at all — and a single red "Error"
 * chip on both sends someone to change a password that was fine.
 */
export function statusTone(status: string): string {
  if (status === 'active') return 'success';
  if (status === 'expired') return 'danger';
  return 'warning';
}

export function statusLabel(status: string): string {
  if (status === 'active') return 'Working';
  if (status === 'expired') return 'Needs a new password';
  return 'Having trouble';
}

/**
 * The settings for the mail services people actually use.
 *
 * Presets exist because "IMAP server" is not a phrase a florist should have to
 * look up, and getting it wrong produces a connection timeout that explains
 * nothing. Picking your provider fills all four boxes.
 */
export interface MailPreset {
  id: string;
  label: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  /** Where this provider hides the app-password screen. Every one of them calls
   *  it something different, which is most of why this step goes wrong. */
  appPasswordHint: string;
}

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    appPasswordHint:
      'In your Google Account, under Security, turn on 2-Step Verification and then create an App password. Google will not accept your normal password here.',
  },
  {
    id: 'microsoft',
    label: 'Outlook / Microsoft 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    appPasswordHint:
      'In your Microsoft account security settings, create an App password. If your workplace manages the account, an administrator may need to allow IMAP first.',
  },
  {
    id: 'fastmail',
    label: 'Fastmail',
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 465,
    appPasswordHint:
      'In Fastmail, go to Settings → Privacy & Security → Connected apps and create a new app password with Mail access.',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    appPasswordHint:
      'In Zoho Mail, open Settings → Security → App passwords and generate one for sparx.',
  },
  {
    id: 'icloud',
    label: 'iCloud Mail',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    appPasswordHint:
      'At appleid.apple.com, under Sign-In and Security, choose App-Specific Passwords and create one.',
  },
  {
    id: 'custom',
    label: 'Something else',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 587,
    appPasswordHint:
      'Your email provider or IT person can tell you the incoming (IMAP) and outgoing (SMTP) server names.',
  },
];

/** When a mailbox last managed to check for new mail, in plain words. */
export function describeLastSync(iso: string | null): string {
  if (!iso) return 'Has not checked yet';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) return 'Checked just now';
  if (minutes < 60) return `Checked ${String(minutes)} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'Checked an hour ago' : `Checked ${String(hours)} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Checked yesterday' : `Checked ${String(days)} days ago`;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useMailboxes() {
  return useQuery({
    queryKey: mailboxKeys.all,
    queryFn: () => api.list<Mailbox>('/v1/crm/mailboxes'),
  });
}

export function useConnectMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectMailboxInput) => api.post<Mailbox>('/v1/crm/mailboxes', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
    },
  });
}

export function useDisconnectMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/crm/mailboxes/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
    },
  });
}

/** Check now rather than waiting for the scheduled poll. Also refreshes the
 *  timelines, because the whole point is that something new landed on one. */
export function useSyncMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SyncOutcome>(`/v1/crm/mailboxes/${id}/sync`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'engagement'] });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'activities'] });
    },
  });
}

/** The server's own sentence when it has one — "Invalid credentials" tells
 *  someone which half is wrong, and a generic failure tells them nothing. */
export function mailboxErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && /module/i.test(error.message);
}
