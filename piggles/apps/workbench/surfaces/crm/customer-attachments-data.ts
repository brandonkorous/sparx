'use client';

// A customer's postal addresses and attached files.
//
// Both hang OFF a customer rather than being part of one, and both are read and
// written on their own endpoints, so they keep their own module. The query keys
// still come from `customerKeys` — one root, so a write anywhere invalidates the
// customer everything else is reading.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';

import { api } from '../../lib/api/client';
import { customerKeys, type CustomerAddress, type CustomerDocument } from './customers-data';

/* ── Addresses ─────────────────────────────────────────────────────────── */

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
