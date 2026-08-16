'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SENDING-ADDRESSES DATA LAYER
//
// A "sending address" is a domain you own that email goes OUT from — so your
// customers see mail from hello@yourbusiness.com instead of a generic sparx
// address, and it lands in inboxes rather than spam. Proving you own it means
// adding a few DNS records at whoever you bought the domain from; sparx then
// asks the email provider (Mailgun) to check them and flips the address to
// verified.
//
// This file is the ONE door to the email sending-domains API in api-rest. The
// list, the detail pane and the per-site default all read and write through
// here, so the cache keys and the typed wire shapes live in one place and can
// never drift between surfaces.
//
// ── The endpoints (services/api-rest/.../email/domains.ts) ─────────────────
//   GET    /v1/email/domains            → the tenant's sending domains
//   POST   /v1/email/domains            → provision one in Mailgun (+ DNS records)
//   GET    /v1/email/domains/:id        → one, including its DNS records
//   POST   /v1/email/domains/:id/verify → re-check DNS now, flip the state
//   POST   /v1/email/domains/:id/default→ make it the default sender FOR THIS SITE
//   DELETE /v1/email/domains/:id        → remove it
//
// "Default" is per-SITE, not per-domain (docs/131 §3.4): the domain is a
// tenant-owned resource more than one site may send from, and which one is the
// default is a fact on THIS site's EmailSettings. So the default marker is read
// from GET /v1/email/settings, and the site is resolved server-side from the
// switcher cookie — no propertyId is threaded from here.
//
// ── The key contract ───────────────────────────────────────────────────────
//   ['email']                          the root every read nests under
//   ['email','domains','list']         the sending-addresses list
//   ['email','domains','detail', id]   one sending address, in full
//   ['email','settings']               this site's email settings (holds the
//                                      per-site default sending-domain id)
//
// Every write invalidates the ['email'] ROOT, so a provision, verify,
// set-default or delete is reflected across the list, the detail and the
// default marker at once.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { productCopy } from '../../lib/product';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/** Where a sending domain's email is processed. Chosen at provision time and
 *  fixed thereafter — the provider hosts the domain in one region or the other. */
export type SendingRegion = 'us' | 'eu';

/** The lifecycle of a sending domain, as api-rest reports it.
 *  pending → verifying → verified, plus failed / disabled. */
export type SendingDomainState = 'pending' | 'verifying' | 'verified' | 'failed' | 'disabled';

/** One DNS record the owner must add at their registrar, verbatim from the
 *  provider. `recordType` is TXT | CNAME | MX; `valid` is the provider's last
 *  check result (valid | unknown | invalid). */
export interface DnsRecord {
    recordType: string;
    name: string;
    value: string;
    valid: string;
    /** Present only on MX records. */
    priority?: string;
}

/** One sending domain, as the domains routes return it (dates are ISO strings,
 *  Prisma Decimal-free). `dnsRecords` is the verbatim provider record set. */
export interface SendingDomain {
    id: string;
    tenantId: string;
    domain: string;
    mailgunDomainId: string | null;
    region: SendingRegion;
    state: SendingDomainState;
    dnsRecords: DnsRecord[];
    dkimSelector: string | null;
    lastCheckedAt: string | null;
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

/** This site's email settings — we read it only for the per-site default. */
export interface EmailSettingsView {
    tenantId: string;
    propertyId: string;
    fromName: string | null;
    fromAddress: string | null;
    replyTo: string | null;
    physicalAddress: string | null;
    defaultSendingDomainId: string | null;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const emailDomainKeys = {
    all: ['email'] as const,
    list: ['email', 'domains', 'list'] as const,
    detail: (id: string) => ['email', 'domains', 'detail', id] as const,
    settings: ['email', 'settings'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** Every sending domain on the account. One request, not one per row: a tenant
 *  has a handful of these, and the search below is applied client-side. */
export function useSendingDomains() {
    return useQuery({
        queryKey: emailDomainKeys.list,
        queryFn: () => api.get<SendingDomain[]>('/v1/email/domains'),
    });
}

export function useSendingDomain(id: string) {
    return useQuery({
        queryKey: emailDomainKeys.detail(id),
        queryFn: () => api.get<SendingDomain>(`/v1/email/domains/${id}`),
        enabled: id !== 'new',
        retry: (failureCount, error) =>
            error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
    });
}

/** This site's email settings, read only for `defaultSendingDomainId`. Its own
 *  key so the settings surface (when built) shares this cache entry. */
export function useEmailSettings() {
    return useQuery({
        queryKey: emailDomainKeys.settings,
        queryFn: () => api.get<EmailSettingsView>('/v1/email/settings'),
    });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidate() {
    const queryClient = useQueryClient();
    return (id?: string) => {
        // The ROOT covers the list, the settings (default marker) and every detail
        // at once — a set-default changes a badge on the list AND on this pane.
        void queryClient.invalidateQueries({ queryKey: emailDomainKeys.all });
        if (id) void queryClient.invalidateQueries({ queryKey: emailDomainKeys.detail(id) });
    };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface ProvisionInput {
    domain: string;
    region: SendingRegion;
}

export function useProvisionSendingDomain() {
    const invalidate = useInvalidate();
    return useMutation({
        mutationFn: (input: ProvisionInput) => api.post<SendingDomain>('/v1/email/domains', input),
        onSuccess: (created) => {
            invalidate(created.id);
        },
    });
}

/**
 * Ask the provider to re-check DNS right now and flip the state.
 *
 * A check that still can't find the records comes back on the row as
 * `verifying` / `failed` rather than as an error, and a genuine 4xx carries the
 * provider's own sentence — so this invalidates on success and lets the caller
 * surface the message; it never swallows it.
 */
export function useVerifySendingDomain(id: string) {
    const invalidate = useInvalidate();
    return useMutation({
        mutationFn: () => api.post<SendingDomain>(`/v1/email/domains/${id}/verify`),
        onSuccess: () => {
            invalidate(id);
        },
    });
}

/** Make this the address THIS SITE sends from by default (per-site — writes to
 *  the site's EmailSettings, not to the shared domain row). */
export function useSetDefaultSendingDomain(id: string) {
    const invalidate = useInvalidate();
    return useMutation({
        mutationFn: () => api.post<SendingDomain>(`/v1/email/domains/${id}/default`),
        onSuccess: () => {
            invalidate(id);
        },
    });
}

export function useDeleteSendingDomain(id: string) {
    const invalidate = useInvalidate();
    return useMutation({
        mutationFn: () => api.delete(`/v1/email/domains/${id}`),
        onSuccess: () => {
            invalidate();
        },
    });
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** How a sending domain is doing, in plain words. `tone` feeds `<Badge color>`
 *  so state carries its own color, per the platform rule. */
export function sendingDomainState(domain: Pick<SendingDomain, 'state'>): {
    label: string;
    tone: Tone;
    detail: string;
} {
    switch (domain.state) {
        case 'verified':
            return {
                label: 'Verified',
                tone: 'success',
                detail: productCopy(
                    'email.domain.proven',
                    'This address is proven, so Piggles can send your email from it.'
                ),
            };
        case 'verifying':
            return {
                label: 'Checking',
                tone: 'info',
                detail:
                    'We asked for the records and they have not appeared yet. Changes at a domain provider can take a few minutes — occasionally a few hours — to spread across the internet. Add them if you have not, then check again.',
            };
        case 'failed':
            return {
                label: 'Records not found',
                tone: 'error',
                detail:
                    'We looked for the records and they were not there. That usually means they have not been added yet, or they were added moments ago and have not spread across the internet.',
            };
        case 'disabled':
            return {
                label: 'Turned off',
                tone: 'neutral',
                detail: 'This address is switched off with the email provider and cannot send.',
            };
        default:
            return {
                label: 'Needs setup',
                tone: 'warning',
                detail: 'Add the records below at your domain provider, then choose Check now.',
            };
    }
}

/** What a DNS record DOES, in plain language — because "CNAME" and "DKIM" mean
 *  nothing to someone who bought a domain once. Matched on the record's own
 *  contents so it survives the provider re-ordering or renaming them. */
export function recordPurpose(record: DnsRecord): string {
    const name = record.name.toLowerCase();
    const value = record.value.toLowerCase();
    if (name.startsWith('_dmarc')) {
        return 'Tells other email systems what to do with a message that fails these checks.';
    }
    if (name.includes('_domainkey') || value.includes('k=rsa') || value.includes('p=mig')) {
        return 'Adds a hidden signature that proves a message really came from you.';
    }
    if (value.includes('v=spf1')) {
        return productCopy('email.domain.spf', 'Lists sparx as allowed to send email on your behalf.');
    }
    if (record.recordType.toUpperCase() === 'CNAME') {
        return productCopy(
            'email.domain.tracking',
            'Lets Piggles handle your links and track opens and clicks.'
        );
    }
    if (record.recordType.toUpperCase() === 'MX') {
        return 'Directs email for this address to the right place.';
    }
    return 'Part of proving this address belongs to you.';
}

export function regionLabel(region: SendingRegion): string {
    return region === 'eu' ? 'Europe' : 'United States';
}

/**
 * The server's own sentence for a 4xx, shown verbatim: these routes explain the
 * exact problem (a domain that already exists, a provider rejection, records
 * that are not there yet) far better than anything inferred from a status code.
 * A 5xx has no such sentence, so it falls back to the caller's wording.
 */
export function emailDomainErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return error.message;
    }
    return fallback;
}
