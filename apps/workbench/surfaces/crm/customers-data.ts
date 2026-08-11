'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CUSTOMER DATA LAYER
//
// A customer is anyone in the address book: a PROSPECT who has shown interest
// but not bought, a RETAIL buyer, or a B2B contact who belongs to a wholesale
// account. It is one record with a `type`, promoted between the three by editing
// that field — never a separate table. The write shapes mirror the CRM's own
// `CreateCustomerInput` / `UpdateCustomerInput` (Zod in `@sparx/crm-schemas`),
// named locally because that package is not a dependency of this app; the server
// runs that Zod on every write and has the final say on anything malformed.
//
// ── The key contract ──────────────────────────────────────────────────────
//
//   ['crm','customers']                 the root every read nests under
//   ['crm','customers','list',{…}]      one list window (search + filters)
//   ['crm','customers', id]             one customer, in full
//   ['crm','customers', id,'addresses'] that customer's postal addresses
//
// Every write invalidates the ROOT prefix, so a new, edited or removed customer
// shows correctly in the list and the detail at once.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type { CustomerType, LeadStatus, LifecycleStage } from '@sparx/crm-schemas';
import { api } from '../../lib/api/client';

// Classification is three orthogonal axes (docs/137), each enum straight from
// `@sparx/crm-schemas` (the server's own Zod) so nothing can drift: `type` is the
// RELATIONSHIP (retail/b2b/partner/vendor), `lifecycleStage` is where they are in
// the journey, `leadStatus` is the micro work-state. `CustomerInput` below stays a
// local, narrow write PAYLOAD (only the fields this pane sends) on purpose — the
// same house pattern as `DiscountInput` in commerce.
export type { CustomerType, LifecycleStage, LeadStatus };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One customer in full, as the detail pane edits it. Mirrors the serialized
 *  Prisma `Customer` the CRM customer-service returns — money is a Decimal, so
 *  it arrives as a STRING (coerce with `Number`), and every date is an ISO
 *  string. Only the fields this app reads are named, so a wider row can never
 *  quietly become a dependency. */
export interface Customer {
  id: string;
  type: CustomerType;
  lifecycleStage: LifecycleStage;
  leadStatus: LeadStatus | null;
  propertyId: string | null;
  companyId: string | null;
  assignedRepId: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  preferredContactMethod: string | null;
  doNotContact: boolean;
  tags: string[];
  /** The extra details this business declared on contacts (docs/144 §3). Its
   *  shape is per-tenant, so it stays an open bag here and is rendered by
   *  reading the tenant's own property schema. */
  customProperties: Record<string, unknown>;
  /** Optional profile photo — a MediaAsset id, resolved to a URL for display. */
  avatarMediaAssetId: string | null;
  /** Serialized Prisma Decimal — a string like `"1234.50"`. */
  totalSpent: string;
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  /** What this business's own scoring rules make of them (docs/144 §10). Zero
   *  until a tenant writes a model, which is why the score panel says so rather
   *  than showing a confident 0. */
  score: number;
  /** When the score was last worked out. Null means it never has been. */
  scoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One postal address on a customer. Added, edited and removed from the
 *  customer's Details tab. */
export interface CustomerAddress {
  id: string;
  type: string;
  label: string | null;
  isDefault: boolean;
  recipientName: string | null;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
}

export type CustomerSort = 'score' | 'lastOrderAt' | 'totalSpent' | 'updatedAt' | 'createdAt';

export interface CustomerListParams {
  q?: string;
  type?: CustomerType;
  lifecycleStage?: LifecycleStage;
  leadStatus?: LeadStatus;
  sortBy?: CustomerSort;
  assignedRepId?: string;
  companyId?: string;
}

/** One file attached to a customer. The bytes live in the media pipeline; this
 *  is the link + a label. Resolve `mediaAssetId` to a name/URL with the media
 *  hooks. */
export interface CustomerDocument {
  id: string;
  mediaAssetId: string;
  label: string | null;
  createdAt: string;
}

export const customerKeys = {
  all: ['crm', 'customers'] as const,
  list: (params: CustomerListParams) => [...customerKeys.all, 'list', params] as const,
  detail: (id: string) => [...customerKeys.all, id] as const,
  addresses: (id: string) => [...customerKeys.all, id, 'addresses'] as const,
  documents: (id: string) => [...customerKeys.all, id, 'documents'] as const,
};

/* ── Identity + presentation ────────────────────────────────────────────── */

/** The best human name for a customer — real name, else company, else email,
 *  else a plain fallback. Never an empty string, so a row is never blank. */
export function customerName(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (c.company?.trim()) return c.company.trim();
  if (c.email?.trim()) return c.email.trim();
  return 'Unnamed contact';
}

interface AxisMeta {
  label: string;
  color: string;
  description: string;
}

/* ── Axis 1: relationship type (`type`) ─────────────────────────────────────
 * How a contact transacts. `b2b` (Wholesale) is the one kind with behaviour —
 * trade pricing + A/R — so it is only offered when the B2B module is on (the
 * caller gates it); the rest are label-only. */
export const RELATIONSHIP_TYPES: CustomerType[] = ['retail', 'b2b', 'partner', 'vendor'];

export function customerTypeMeta(type: CustomerType): AxisMeta {
  switch (type) {
    case 'retail':
      return {
        label: 'Individual',
        color: 'commerce',
        description: 'A regular customer at your standard prices.',
      };
    case 'b2b':
      return {
        label: 'Wholesale',
        color: 'b2b',
        description: 'A business on a trade account, at agreed prices.',
      };
    case 'partner':
      return {
        label: 'Partner',
        color: 'accent',
        description: 'A referral, affiliate, or reseller you work with.',
      };
    case 'vendor':
      return {
        label: 'Vendor',
        color: 'neutral',
        description: 'A supplier you buy from.',
      };
  }
}

/* ── Axis 2: lifecycle stage (`lifecycleStage`) ─────────────────────────────
 * Where the contact is in the journey — the primary "where are they" signal.
 * A completed order advances them to `customer` automatically. Ordered as the
 * ladder progresses. */
export const LIFECYCLE_STAGES: LifecycleStage[] = [
  'subscriber',
  'lead',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist',
  'other',
];

export function lifecycleStageMeta(stage: LifecycleStage): AxisMeta {
  switch (stage) {
    case 'subscriber':
      return {
        label: 'Subscriber',
        color: 'neutral',
        description: 'Opted in to hear from you — a newsletter or updates — nothing more yet.',
      };
    case 'lead':
      return {
        label: 'Lead',
        color: 'info',
        description: 'Made contact or enquired, beyond just subscribing.',
      };
    case 'marketing_qualified_lead':
      return {
        label: 'Marketing qualified',
        color: 'primary',
        description: 'Marketing judged them ready to hand to sales.',
      };
    case 'sales_qualified_lead':
      return {
        label: 'Sales qualified',
        color: 'primary',
        description: 'Sales judged them a real potential customer.',
      };
    case 'opportunity':
      return {
        label: 'Opportunity',
        color: 'warning',
        description: 'Has an open deal in progress.',
      };
    case 'customer':
      return {
        label: 'Customer',
        color: 'success',
        description: 'Has at least one completed order.',
      };
    case 'evangelist':
      return {
        label: 'Evangelist',
        color: 'accent',
        description: 'A customer who actively advocates for you.',
      };
    case 'other':
      return {
        label: 'Other',
        color: 'neutral',
        description: "Doesn't fit the ladder.",
      };
  }
}

/* ── Axis 3: lead status (`leadStatus`) ─────────────────────────────────────
 * The micro work-state — what someone is doing about this contact right now.
 * Only meaningful while a lead is being worked, so it can be unset. */
export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'open',
  'in_progress',
  'open_deal',
  'unqualified',
  'attempted_to_contact',
  'connected',
  'bad_timing',
];

export function leadStatusMeta(status: LeadStatus): AxisMeta {
  switch (status) {
    case 'new':
      return { label: 'New', color: 'info', description: 'Not worked yet.' };
    case 'open':
      return { label: 'Open', color: 'info', description: 'Being worked.' };
    case 'in_progress':
      return { label: 'In progress', color: 'primary', description: 'Actively in conversation.' };
    case 'open_deal':
      return { label: 'Open deal', color: 'success', description: 'A deal is on the table.' };
    case 'unqualified':
      return { label: 'Unqualified', color: 'neutral', description: 'Not a fit right now.' };
    case 'attempted_to_contact':
      return {
        label: 'Attempted to contact',
        color: 'warning',
        description: 'Reached out, no reply yet.',
      };
    case 'connected':
      return { label: 'Connected', color: 'success', description: 'Two-way contact made.' };
    case 'bad_timing':
      return { label: 'Bad timing', color: 'neutral', description: 'Interested, but not now.' };
  }
}

/** Money for display. Accepts the wire string or a number; `—` when unknown. */
export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

/** Two letters for a monogram, from whatever identity is present — name, then
 *  company, then email — so a chip is never an empty circle. Takes the loose
 *  shape so it serves both a saved `Customer` and an in-progress edit draft. */
export function customerInitials(c: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
}): string {
  const first = c.firstName?.trim() ?? '';
  const last = c.lastName?.trim() ?? '';
  const fromName = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
  if (fromName) return fromName;
  // company, then email — `.find(Boolean)` picks the first non-empty (a trimmed
  // blank must fall through, which `??` would not do), so no `||` on strings.
  const fallback = [c.company, c.email].map((value) => value?.trim()).find(Boolean) ?? '';
  return fallback ? fallback.slice(0, 2).toUpperCase() : '?';
}

/** A full, spelled-out date — for facts someone might quote ("first order"). */
export function longDate(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Month + year — the resolution "customer since" actually wants. */
export function joinedMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** How long ago an order was, in words a person actually uses — days, weeks,
 *  months, years. Recency is the signal that says whether a customer is still
 *  active, so it is worth saying properly rather than as a raw date. */
export function describeOrderRecency(iso: string | null): string {
  if (!iso) return 'No orders yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No orders yet';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${String(days)} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? 'a week ago' : `${String(weeks)} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'a month ago' : `${String(months)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'a year ago' : `${String(years)} years ago`;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () =>
      api.list<Customer>('/v1/crm/customers', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.lifecycleStage ? { lifecycle_stage: params.lifecycleStage } : {}),
        ...(params.leadStatus ? { lead_status: params.leadStatus } : {}),
        ...(params.sortBy ? { sort_by: params.sortBy } : {}),
        ...(params.assignedRepId ? { assigned_rep_id: params.assignedRepId } : {}),
        ...(params.companyId ? { b2b_account_id: params.companyId } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => api.get<Customer>(`/v1/crm/customers/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useCustomerAddresses(id: string) {
  return useQuery({
    queryKey: customerKeys.addresses(id),
    queryFn: () => api.get<CustomerAddress[]>(`/v1/crm/customers/${id}/addresses`),
    enabled: id !== 'new',
  });
}

/* ── Address writes ─────────────────────────────────────────────────────── */

/** The write payload for one address. Optionals are OMITTED when empty rather
 *  than sent as `null` — the server's Zod treats these as `.optional()` (absent),
 *  not nullable, so a blank must be an absent key. `type`, `line1`, `city` and
 *  `country` are the fields it requires. */
export interface CustomerAddressInput {
  type: 'shipping' | 'billing' | 'both';
  label?: string;
  isDefault?: boolean;
  recipientName?: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "US". */
  country: string;
  phone?: string;
}

export function useAddAddress(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerAddressInput) =>
      api.post<CustomerAddress>(`/v1/crm/customers/${customerId}/addresses`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.addresses(customerId) });
    },
  });
}

export function useUpdateAddress(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId, input }: { addressId: string; input: CustomerAddressInput }) =>
      api.patch<CustomerAddress>(`/v1/crm/customers/${customerId}/addresses/${addressId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.addresses(customerId) });
    },
  });
}

export function useDeleteAddress(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) =>
      api.delete(`/v1/crm/customers/${customerId}/addresses/${addressId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.addresses(customerId) });
    },
  });
}

/* ── Documents ──────────────────────────────────────────────────────────── */

export function useCustomerDocuments(id: string) {
  return useQuery({
    queryKey: customerKeys.documents(id),
    queryFn: () => api.get<CustomerDocument[]>(`/v1/crm/customers/${id}/documents`),
    enabled: id !== 'new',
  });
}

export function useAddDocument(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mediaAssetId: string; label?: string }) =>
      api.post<CustomerDocument>(`/v1/crm/customers/${customerId}/documents`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.documents(customerId) });
    },
  });
}

export function useDeleteDocument(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      api.delete(`/v1/crm/customers/${customerId}/documents/${documentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.documents(customerId) });
    },
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateCustomers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: customerKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** The exact write payload — a subset of `CreateCustomerInput`. `null` clears a
 *  field; an absent key leaves it untouched on a PATCH. */
export interface CustomerInput {
  type: CustomerType;
  lifecycleStage: LifecycleStage;
  leadStatus?: LeadStatus | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  companyId?: string | null;
  assignedRepId?: string | null;
  preferredContactMethod?: 'email' | 'phone' | 'sms' | null;
  doNotContact?: boolean;
  tags?: string[];
  /** Merged onto what is stored — sending one detail changes only that one. */
  customProperties?: Record<string, unknown>;
  /** A MediaAsset id for the profile photo; `null` clears it. */
  avatarMediaAssetId?: string | null;
}

export function useCreateCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (input: CustomerInput) => api.post<Customer>('/v1/crm/customers', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateCustomer(id: string) {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (patch: Partial<CustomerInput>) =>
      api.patch<Customer>(`/v1/crm/customers/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteCustomer(id: string) {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/customers/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx is worth showing verbatim (it names the
 *  exact field); a 5xx has no such sentence, so it falls back to the caller's. */
export function customerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
