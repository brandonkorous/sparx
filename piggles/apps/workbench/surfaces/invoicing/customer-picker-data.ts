'use client';

// Finding a customer to put on a document.
//
// The search runs on the SERVER (issue 183). It used to pull a hundred rows
// once and filter them in the browser, which made "no customer matches that" a
// statement about those hundred rows rather than about the address book.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';

export interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

// Both keys stay under ['crm','customers'], which is what `useInvalidateCustomers`
// invalidates — so a customer added elsewhere is findable here immediately.
export const customerPickerKeys = {
  search: (q: string) => ['crm', 'customers', 'picker', 'search', q] as const,
  one: (id: string) => ['crm', 'customers', 'picker', 'one', id] as const,
};

/** How a person is named on an invoice: the company if there is one, otherwise
 *  the person, otherwise whatever we can identify them by. */
export function customerLabel(customer: CustomerSummary): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return customer.company ?? (person || customer.email) ?? 'Unnamed customer';
}

/** The address book, searched where it lives. Two letters before it asks. */
export function useCustomerSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: customerPickerKeys.search(q),
    queryFn: () => api.list<CustomerSummary>('/v1/crm/customers', { q, take: 20 }),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

/**
 * Who is on the document already, read by id rather than found in a list.
 *
 * A customer named on a document reopened months later may be nowhere near the
 * first page of anything, and a picker that could not name them would show an
 * empty field over a document that has one.
 */
export function useCustomerOnRecord(id: string | null) {
  return useQuery({
    queryKey: customerPickerKeys.one(id ?? ''),
    queryFn: () => api.get<CustomerSummary>(`/v1/crm/customers/${id ?? ''}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}
