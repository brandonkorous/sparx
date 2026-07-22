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
import type { CustomerType } from '@sparx/crm-schemas';
import { api } from '../../lib/api/client';

// The customer TYPE enum comes straight from `@sparx/crm-schemas` (the server's
// own Zod), so it can't drift. `CustomerInput` below stays a local, narrow write
// PAYLOAD (only the fields this pane sends) on purpose — the same house pattern as
// `DiscountInput` in commerce — because the full `CreateCustomerInput` carries
// fields the pane deliberately doesn't manage.
export type { CustomerType };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One customer in full, as the detail pane edits it. Mirrors the serialized
 *  Prisma `Customer` the CRM customer-service returns — money is a Decimal, so
 *  it arrives as a STRING (coerce with `Number`), and every date is an ISO
 *  string. Only the fields this app reads are named, so a wider row can never
 *  quietly become a dependency. */
export interface Customer {
  id: string;
  type: CustomerType;
  propertyId: string | null;
  b2bAccountId: string | null;
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
  /** Serialized Prisma Decimal — a string like `"1234.50"`. */
  totalSpent: string;
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One postal address on a customer. Read-only in this surface. */
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

export type CustomerSort = 'lastOrderAt' | 'totalSpent' | 'updatedAt' | 'createdAt';

export interface CustomerListParams {
  q?: string;
  type?: CustomerType;
  sortBy?: CustomerSort;
  assignedRepId?: string;
  b2bAccountId?: string;
}

export const customerKeys = {
  all: ['crm', 'customers'] as const,
  list: (params: CustomerListParams) => [...customerKeys.all, 'list', params] as const,
  detail: (id: string) => [...customerKeys.all, id] as const,
  addresses: (id: string) => [...customerKeys.all, id, 'addresses'] as const,
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

export const CUSTOMER_TYPES: CustomerType[] = ['prospect', 'retail', 'b2b'];

/**
 * How a customer's TYPE reads — its plain-language label, a colour that gives it
 * an identity, and a sentence explaining it.
 *
 * Type is an identity axis, not a status, so the colours are chosen to say what
 * kind of relationship this is rather than good/bad: a prospect is `info` (a
 * lead, not yet a buyer), a retail buyer wears the Commerce hue (they buy from
 * the shop), and a wholesale contact wears the B2B hue (they belong to a trade
 * account). All three are real silica colour slots.
 */
export function customerTypeMeta(type: CustomerType): {
  label: string;
  color: string;
  description: string;
} {
  switch (type) {
    case 'prospect':
      return {
        label: 'Prospect',
        color: 'info',
        description: 'Someone who has shown interest but has not bought anything yet.',
      };
    case 'retail':
      return {
        label: 'Retail',
        color: 'commerce',
        description: 'A regular customer who buys at your normal prices.',
      };
    case 'b2b':
      return {
        label: 'Wholesale',
        color: 'b2b',
        description: 'A business contact who buys at agreed trade prices.',
      };
  }
}

/** Money for display. Accepts the wire string or a number; `—` when unknown. */
export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () =>
      api.list<Customer>('/v1/crm/customers', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.sortBy ? { sort_by: params.sortBy } : {}),
        ...(params.assignedRepId ? { assigned_rep_id: params.assignedRepId } : {}),
        ...(params.b2bAccountId ? { b2b_account_id: params.b2bAccountId } : {}),
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
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  b2bAccountId?: string | null;
  assignedRepId?: string | null;
  preferredContactMethod?: 'email' | 'phone' | 'sms' | null;
  doNotContact?: boolean;
  tags?: string[];
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
