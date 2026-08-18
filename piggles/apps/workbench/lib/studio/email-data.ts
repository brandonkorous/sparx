'use client';

// One email's reads and writes.
//
// Every call here names an email. Nothing loads or saves "the emails", which is
// what lets two email panes stay open at once — an order confirmation beside the
// welcome note — without either holding a rival copy of the other's draft.
//
// The catalog is SEEDED on first read, so the list is never genuinely empty: a
// business always has the provisioned defaults. An empty result means the module
// is off, never "make your first one".

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import type { EmailColorDefaults, EmailDocument } from '@wizeworks/silicaui-builder/email';
import { api } from '../api/client';

export const EMAILS_KEY = ['studio', 'emails'] as const;
export const emailKey = (id: string) => ['studio', 'email', id] as const;

/** An email in the list — everything the picker shows. */
export interface EmailSummary {
  id: string;
  name: string;
  subject: string;
  published: boolean;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  position: number;
  /** The built-in identity of a provisioned default, or null for a custom one. */
  key: string | null;
  /** `tenant` — shared by every site; `site` — this site's own version. */
  scope: 'tenant' | 'site';
}

/** One email, as the builder opens it. */
export interface EmailRow extends EmailSummary {
  preheader: string | null;
  /** The DRAFT document. Typed here, because this is the studio. */
  silicaDoc: EmailDocument;
}

export function useEmails() {
  return useQuery({
    queryKey: EMAILS_KEY,
    queryFn: () => api.get<{ emails: EmailSummary[] }>('/v1/builder/emails').then((r) => r.emails),
    staleTime: 30_000,
  });
}

/**
 * One email's document.
 *
 * Not refetched on focus, for the same reason a page is not: the pane holds the
 * authoritative draft from the moment it opens, so a successful refetch changes
 * nothing and a failed one would take unsaved work with it.
 */
export function useEmail(id: string | null) {
  return useQuery({
    queryKey: emailKey(id ?? 'none'),
    queryFn: () => api.get<EmailRow>(`/v1/builder/emails/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Save one email — its document, and the name that lives on the row beside it.
 *
 * The document goes first: a failure there stops before the name claims a state
 * the document never reached.
 */
export function useSaveEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; doc: EmailDocument; name: string }) => {
      const path = `/v1/builder/emails/${encodeURIComponent(input.id)}`;
      await api.put<unknown>(`${path}/silica`, { doc: input.doc });
      await api.patch<unknown>(path, { name: input.name });
    },
    onSuccess: (_result, input) => {
      // The LIST changes — a new subject, a rename, an unpublished marker. The
      // email's own query is not refetched: this pane is the authority on it.
      void queryClient.invalidateQueries({ queryKey: EMAILS_KEY });
      void queryClient.invalidateQueries({ queryKey: emailKey(input.id), refetchType: 'none' });
    },
  });
}

/** Put one email live, leaving every other email's draft where it is. */
export function usePublishEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ publishedAt: string | null }>(
        `/v1/builder/emails/${encodeURIComponent(id)}/silica/publish`
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMAILS_KEY });
    },
  });
}

/** Add an email. The service seeds it from the blank starter, so the builder opens
 *  on a real (empty) document rather than on nothing. */
export function useCreateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.post<EmailSummary>('/v1/builder/emails', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMAILS_KEY });
    },
  });
}

/** Remove an email for good. */
export function useDeleteEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/builder/emails/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMAILS_KEY });
    },
  });
}

/**
 * Fork a shared default into a version belonging to just this site.
 *
 * Idempotent server-side — asking twice returns the version that already exists —
 * and keyed by the default's built-in `key`, which is why only a provisioned
 * default can be forked. A custom email already belongs to whoever made it.
 */
export function useCustomiseForSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { propertyId: string; key: string }) =>
      api.post<EmailSummary>(
        `/v1/builder/emails/site/${encodeURIComponent(input.propertyId)}/customize`,
        {
          key: input.key,
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMAILS_KEY });
    },
  });
}

/**
 * The exact colours a real send paints with, resolved server-side from this
 * site's brand.
 *
 * Feeding these to the canvas is what makes a NEW block land on brand. They are
 * literal hex on purpose — an email cannot ship a CSS custom property, so every
 * colour in a sent email is frozen when it is authored.
 */
export function useEmailColors() {
  return useQuery({
    queryKey: ['studio', 'email-colors'],
    queryFn: () =>
      api
        .get<{ colors: EmailColorDefaults }>('/v1/builder/emails/frame')
        .then((response) => response.colors),
    staleTime: 300_000,
  });
}
