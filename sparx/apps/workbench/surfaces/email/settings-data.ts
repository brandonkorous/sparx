'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE EMAIL SETTINGS DATA LAYER
//
// This is the ONE door to the email module's per-SITE settings in api-rest.
// Every email-settings surface reads and writes through here, so the cache keys
// and the typed shapes live in one place and can never drift.
//
// ── What lives here ─────────────────────────────────────────────────────────
//   • SETTINGS — the sending identity for THIS site: who email comes from, where
//                replies land, which verified sending domain to send through, and
//                the physical mailing address anti-spam law requires in every
//                email's footer. Keyed (tenantId, propertyId) server-side; the
//                site is resolved from the switcher cookie the client attaches,
//                so this file never threads a propertyId.
//   • DOMAINS  — the site's verified sending addresses, read ONLY to populate the
//                "send through" picker. Provisioning/verifying them lives on the
//                Sending addresses surface, not here.
//
// ── The key contract ────────────────────────────────────────────────────────
//   ['email']                the module root every read nests under
//   ['email','settings']     this site's sending identity
//   ['email','domains']      this site's sending domains (picker source)
//
// Saving settings invalidates the ['email'] ROOT, so a change here also refreshes
// any domains or broadcast pane open beside it that reads the same identity.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── The settings row (dates omitted — this view carries none) ─────────────── */

/** One site's email settings, as `GET /v1/email/settings` returns it. Every
 *  field is nullable: an unconfigured site has none set and sends as the
 *  platform until an owner fills these in. */
export interface EmailSettings {
  tenantId: string;
  propertyId: string;
  /** The name recipients see in the "From" line, e.g. "Acme Supply". */
  fromName: string | null;
  /** The address email is sent from. */
  fromAddress: string | null;
  /** Where a recipient's reply is delivered, when it differs from the sender. */
  replyTo: string | null;
  /** The physical mailing address printed in every email's footer (anti-spam law). */
  physicalAddress: string | null;
  /** The verified sending domain to send through, or null for the shared default. */
  defaultSendingDomainId: string | null;
}

/** The PATCH body — every field optional, only the provided ones change. Null
 *  clears a field back to the platform default. */
export interface UpdateEmailSettingsInput {
  fromName?: string | null;
  fromAddress?: string | null;
  replyTo?: string | null;
  physicalAddress?: string | null;
  defaultSendingDomainId?: string | null;
}

/* ── Sending domains (read-only here — the picker's option source) ─────────── */

/** A sending domain, trimmed to what the picker needs. `state` is 'verified'
 *  when it is proven and safe to send through; anything else is not yet ready. */
export interface SendingDomainOption {
  id: string;
  domain: string;
  state: string;
}

/* ── Query keys ─────────────────────────────────────────────────────────────*/

export const emailKeys = {
  all: ['email'] as const,
  settings: ['email', 'settings'] as const,
  domains: ['email', 'domains'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────────*/

export function useEmailSettings() {
  return useQuery({
    queryKey: emailKeys.settings,
    queryFn: () => api.get<EmailSettings>('/v1/email/settings'),
  });
}

/** The site's sending domains, for the "send through" picker. A failure here is
 *  non-fatal to the form: the picker degrades to the shared-default option only,
 *  so a domains-list outage never blocks saving the rest of the identity. */
export function useSendingDomains() {
  return useQuery({
    queryKey: emailKeys.domains,
    queryFn: () => api.list<SendingDomainOption>('/v1/email/domains', { take: 250 }),
  });
}

/* ── Mutation ───────────────────────────────────────────────────────────────*/

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmailSettingsInput) =>
      api.patch<EmailSettings>('/v1/email/settings', input),
    onSuccess: (result) => {
      queryClient.setQueryData(emailKeys.settings, result);
      // The whole module root: a broadcast or domains pane open beside this one
      // reads the same sending identity and must not show the stale copy.
      void queryClient.invalidateQueries({ queryKey: emailKeys.all });
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────────*/

/** Surface the server's own sentence for a 4xx — it names the exact problem (a
 *  malformed address, an unknown domain) — else a plain fallback. */
export function emailSettingsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
