'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CRM WORKSPACE DATA LAYER
//
// Four things that are about how a business WORKS its CRM rather than about
// any customer: what it has decided, how each person likes to look at a list,
// how a rep hands out their calendar, and where a quote is up to.
//
// They share a file because they share a shape — small settings-ish reads with
// one or two writes each — and splitting four of those across four files makes
// the import list longer without making anything clearer.
//
//   ['crm','settings']        what this business has decided
//   ['crm','saved-views',…]   mine + the team's
//   ['crm','meeting-links']   the team's booking links
//   ['crm','duplicates']      likely duplicate clusters
//   ['crm','signatures', id]  what has been asked of one document
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { Customer } from './customers-data';

/* ── Settings ───────────────────────────────────────────────────────────── */

export type DuplicateMatchRule = 'email' | 'phone' | 'name_company';

export interface CrmSettings {
  domainAssociation: boolean;
  duplicateMatchRules: DuplicateMatchRule[];
  /** null = never merge without a person looking. */
  autoMergeThreshold: number | null;
}

/** How each match rule reads, and how far it can be trusted. The confidence
 *  numbers are the server's and are repeated here so the surface can explain the
 *  threshold in the same terms the scan reports it. */
export const MATCH_RULES: {
  value: DuplicateMatchRule;
  label: string;
  description: string;
  confidence: number;
}[] = [
  {
    value: 'email',
    label: 'The same email address',
    description: 'Two records with one address are the same person by any definition.',
    confidence: 100,
  },
  {
    value: 'phone',
    label: 'The same phone number',
    description:
      'Nearly always the same person — shared office lines and family mobiles are real but rare.',
    confidence: 90,
  },
  {
    value: 'name_company',
    label: 'The same surname and employer',
    description:
      'A guess. Two brothers at one firm look exactly like this, so it can never merge on its own.',
    confidence: 60,
  },
];

export const settingsKeys = { all: ['crm', 'settings'] as const };

export function useCrmSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => api.get<CrmSettings>('/v1/crm/settings'),
    staleTime: 60_000,
  });
}

export function useUpdateCrmSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CrmSettings>) => api.patch<unknown>('/v1/crm/settings', patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      // The duplicate scan reads these rules, so its answer changes the moment
      // they do. Leaving the old clusters on screen under new rules is the kind
      // of stale that reads as a bug in the scan.
      void queryClient.invalidateQueries({ queryKey: duplicateKeys.all });
    },
  });
}

/* ── Saved views ────────────────────────────────────────────────────────── */

export interface SavedView {
  id: string;
  userId: string;
  objectKey: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  isShared: boolean;
  isDefault: boolean;
}

export const viewKeys = {
  all: ['crm', 'saved-views'] as const,
  forObject: (objectKey: string) => ['crm', 'saved-views', objectKey] as const,
};

export function useSavedViews(objectKey: string) {
  return useQuery({
    queryKey: viewKeys.forObject(objectKey),
    queryFn: () => api.list<SavedView>('/v1/crm/saved-views', { object_key: objectKey }),
    staleTime: 60_000,
  });
}

export interface SavedViewInput {
  objectKey: string;
  name: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort?: { field: string; direction: 'asc' | 'desc' } | null;
  isShared?: boolean;
  isDefault?: boolean;
}

export function useSaveView(objectKey: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: viewKeys.forObject(objectKey) });
  return {
    create: useMutation({
      mutationFn: (input: SavedViewInput) => api.post<SavedView>('/v1/crm/saved-views', input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<SavedViewInput> }) =>
        api.patch<SavedView>(`/v1/crm/saved-views/${id}`, patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/v1/crm/saved-views/${id}`),
      onSuccess: invalidate,
    }),
    duplicate: useMutation({
      mutationFn: (id: string) => api.post<SavedView>(`/v1/crm/saved-views/${id}/duplicate`, {}),
      onSuccess: invalidate,
    }),
  };
}

/* ── Meeting links ──────────────────────────────────────────────────────── */

export interface MeetingLink {
  id: string;
  userId: string;
  serviceId: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  bookingCount: number;
  archivedAt: string | null;
}

export const meetingKeys = { all: ['crm', 'meeting-links'] as const };

export function useMeetingLinks() {
  return useQuery({
    queryKey: meetingKeys.all,
    queryFn: () => api.list<MeetingLink>('/v1/crm/meeting-links', {}),
  });
}

export interface MeetingLinkInput {
  serviceId: string;
  slug: string;
  name: string;
  description?: string | null;
  userId?: string;
  isActive?: boolean;
}

export function useMeetingLinkMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: meetingKeys.all });
  return {
    create: useMutation({
      mutationFn: (input: MeetingLinkInput) =>
        api.post<MeetingLink>('/v1/crm/meeting-links', input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<MeetingLinkInput> }) =>
        api.patch<MeetingLink>(`/v1/crm/meeting-links/${id}`, patch),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.delete(`/v1/crm/meeting-links/${id}`),
      onSuccess: invalidate,
    }),
  };
}

/* ── Duplicates ─────────────────────────────────────────────────────────── */

export interface DuplicateGroup {
  reason: 'email' | 'phone' | 'name+company';
  customers: Customer[];
  confidence: number;
}

export const duplicateKeys = { all: ['crm', 'duplicates'] as const };

export function reasonLabel(reason: DuplicateGroup['reason']): string {
  if (reason === 'email') return 'Same email address';
  if (reason === 'phone') return 'Same phone number';
  return 'Same surname and employer';
}

/** How sure reads, as a colour and a word. Below 70 is a guess and says so —
 *  a grey "60%" beside a red "100%" would tell somebody nothing about which to
 *  act on. */
export function confidenceMeta(confidence: number): {
  tone: 'success' | 'warning' | 'info';
  label: string;
} {
  if (confidence >= 100) return { tone: 'success', label: 'Certain' };
  if (confidence >= 80) return { tone: 'info', label: 'Very likely' };
  return { tone: 'warning', label: 'Worth a look' };
}

export function useDuplicates() {
  return useQuery({
    queryKey: duplicateKeys.all,
    queryFn: () => api.list<DuplicateGroup>('/v1/crm/duplicates', {}),
  });
}

export interface BulkMergeResult {
  merged: number;
  absorbed: number;
  skipped: { reason: string; count: number }[];
}

export function useBulkMerge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (minConfidence: number) =>
      api.post<BulkMergeResult>('/v1/crm/duplicates/bulk-merge', { minConfidence }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: duplicateKeys.all });
      // A merge moves orders, deals and tasks onto the survivor and retires the
      // others, so every customer-shaped list on screen is now wrong.
      void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    },
  });
}

/* ── Signatures ─────────────────────────────────────────────────────────── */

export interface DocumentSignature {
  id: string;
  signerName: string;
  signerEmail: string;
  status: 'pending' | 'signed' | 'declined' | 'expired' | 'revoked';
  requestedAt: string;
  expiresAt: string;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
}

export const signatureKeys = {
  forDocument: (documentId: string) => ['crm', 'signatures', documentId] as const,
};

export function useSignatures(documentId: string) {
  return useQuery({
    queryKey: signatureKeys.forDocument(documentId),
    queryFn: () => api.list<DocumentSignature>(`/v1/crm/documents/${documentId}/signatures`, {}),
    enabled: documentId !== 'new',
  });
}

export interface RequestSignatureResult {
  signature: DocumentSignature;
  /** Shown ONCE. Not stored anywhere and not re-issuable. */
  signingUrl: string;
  emailed: boolean;
}

export function useSignatureMutations(documentId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: signatureKeys.forDocument(documentId) });
    // Signing moves the document to its approved stage, so the document itself
    // and any list it appears on are stale too.
    void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
  };
  return {
    request: useMutation({
      mutationFn: (input: { signerName: string; signerEmail: string; notify: boolean }) =>
        api.post<RequestSignatureResult>(`/v1/crm/documents/${documentId}/signatures`, input),
      onSuccess: invalidate,
    }),
    revoke: useMutation({
      mutationFn: (signatureId: string) =>
        api.post<DocumentSignature>(`/v1/crm/signatures/${signatureId}/revoke`, {}),
      onSuccess: invalidate,
    }),
  };
}

/** How a signature request reads. `pending` is deliberately `info` rather than
 *  neutral — "waiting on the customer" is a state somebody chases, not an
 *  absence of state. */
export function signatureTone(
  status: DocumentSignature['status']
): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'signed':
      return 'success';
    case 'declined':
      return 'danger';
    case 'expired':
      return 'warning';
    case 'revoked':
      return 'neutral';
    default:
      return 'info';
  }
}

export function workspaceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return error.message;
  return fallback;
}
