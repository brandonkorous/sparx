'use client';

// Finding a customer to put on a document.
//
// The search runs on the SERVER (issue 183). It used to pull a hundred rows
// once and filter them in the browser, which made "no customer matches that" a
// statement about those hundred rows rather than about the address book.
//
// ── TWO NAMES, TWO JOBS ───────────────────────────────────────────────────
//
// A person has a NAME, and a document has an ADDRESSEE, and they are not the
// same string. `customerName` (the CRM's own, used by the Customers list and
// the customer pane) answers "who is this"; `billingName` below answers "what
// goes at the top of the invoice", which for somebody buying on behalf of a
// shop is the shop.
//
// Using the second where the first belonged is issue 746. The picker named
// every row with the employer they had TYPED at checkout, so a private shopper
// who wrote "Loom & Larder" in a box appeared to BE that business, while the
// two people who really buy for it appeared to be nobody in particular — on the
// screen where picking the wrong one decides what they are charged.

import { useQuery } from '@wizeworks/query';
import type { CustomerType } from '@wizeworks/crm-schemas';
import { api } from '../../lib/api/client';
import { customerName, customerTypeMeta } from '../crm/customer-display';
import type { PickerMark, PickerRow } from '../../components/search-picker';

export interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  /**
   * The employer they TYPED — free text out of a checkout box, "Acme". It is
   * NOT the wholesale customer that prices them, and the two routinely
   * disagree (docs/144 §11). 605 of the 745 contacts on this machine have one.
   */
  company: string | null;
  email: string | null;
  /** How they transact. `b2b` is the only value that changes what they pay. */
  type: CustomerType;
  /**
   * The wholesale customer this person buys for, when there is one.
   *
   * This is the fact the pricing engine reads (issue 744) and the fact
   * `company` above gets mistaken for.
   */
  companyId: string | null;
}

// Both keys stay under ['crm','customers'], which is what `useInvalidateCustomers`
// invalidates — so a customer added elsewhere is findable here immediately.
export const customerPickerKeys = {
  search: (q: string) => ['crm', 'customers', 'picker', 'search', q] as const,
  one: (id: string) => ['crm', 'customers', 'picker', 'one', id] as const,
};

/**
 * How a document is ADDRESSED: the business if there is one, else the person.
 *
 * An invoice for somebody buying on behalf of a shop is made out to the shop,
 * which is why this prefers the typed employer. That makes it the wrong name
 * for a person, so it has exactly one caller — the bill-to field — and every
 * screen naming a HUMAN uses `customerName` instead.
 */
export function billingName(customer: CustomerSummary): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return customer.company ?? (person || customer.email) ?? 'Unnamed customer';
}

/**
 * One row of the picker: who they are, what tells them apart, and whether
 * anything about them changes what happens next.
 *
 * `businessName` is the wholesale customer this person buys for, resolved by
 * the caller from `companyId`. It leads the second line because at a till it is
 * the fact that sets the price; the typed employer stands in when there is
 * none, and the email follows either so the two Dave Kellys every real address
 * book has stay apart.
 *
 * The mark repeats the Customers list's own rule — worn only when the
 * relationship is noteworthy, since a retail individual is the unremarkable
 * default — so one person reads the same in both places.
 */
export function customerPickerRow(
  customer: CustomerSummary,
  businessName?: string | null,
  unavailable?: string | null
): PickerRow {
  const primary = customerName(customer);
  const meta = customerTypeMeta(customer.type);
  const mark: PickerMark | null =
    customer.type && customer.type !== 'retail' ? { label: meta.label, color: meta.color } : null;

  const where = businessName?.trim() ?? customer.company?.trim() ?? '';
  const email = customer.email?.trim() ?? '';
  const secondary = [where, email === primary ? '' : email].filter(Boolean).join(' · ') || null;

  return { id: customer.id, primary, secondary, mark, ...(unavailable ? { unavailable } : {}) };
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
