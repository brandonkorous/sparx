'use client';

// Who a document is made out to, worked out from the customer picked.
//
// Picking Renée Castañeda, who buys for the wholesale account "Wasatch Front
// Utility Contractors, LLC", printed "Renée Castañeda" as the billing name and
// left the billing address empty, although her default address (delivery and
// billing, "Main office": Accounts Payable, 2275 S 900 W, Suite 200, Salt Lake
// City) was on file (sparx persona issue 077). A business on account is billed
// as the BUSINESS, at its accounts payable address; the person stays the
// contact the email goes to.
//
// `billedParty` is the rule, pure and tested. The two readers around it fetch
// what it needs, through the same query keys the CRM screens use, so a
// customer's address edited there is the one that arrives here.

import { useQuery, type QueryClient } from '@wizeworks/query';
import { localityLine } from '../../lib/address-format';
import { api } from '../../lib/api/client';
import { accountKeys, type Company } from '../crm/companies-data';
import { customerKeys, type CustomerAddress } from '../crm/customers-data';
import { billingName, type CustomerSummary } from './customer-picker-data';

/** What a document prints at the top, and where it is sent. */
export interface BilledPartyFull {
  name: string;
  email: string;
  address: string;
  /** The wholesale account it bills, or null for a retail customer. */
  companyId: string | null;
}

/** The address a bill goes to: the default billing one, else any billing one.
 *  "Both" (delivery and billing) counts as billing. Null when there is none. */
export function billingAddressOf(addresses: readonly CustomerAddress[]): CustomerAddress | null {
  const bills = addresses.filter((a) => a.type === 'billing' || a.type === 'both');
  return bills.find((a) => a.isDefault) ?? bills[0] ?? null;
}

/**
 * An address as the lines of a printed bill-to block.
 *
 * The attention line ("Accounts Payable") and the company come first, except a
 * company that is already the billing name above it, which would otherwise
 * print twice.
 *
 * The country is left off when it is the business's own, the way anyone
 * addresses a letter at home: Gillett's quote to a Salt Lake City customer
 * ended its bill-to block on "US" (sparx persona issue 083). A customer abroad
 * keeps theirs, which is the case the line exists for.
 */
export function addressText(
  address: CustomerAddress | null,
  billedAs: string,
  homeCountry: string | null = null
): string {
  if (!address) return '';
  const same = (value: string | null) =>
    (value ?? '').trim().toLowerCase() === billedAs.trim().toLowerCase();
  const country = (address.country ?? '').trim();
  const home = (homeCountry ?? '').trim().toUpperCase();
  const abroad = country !== '' && country.toUpperCase() !== home;
  return [
    same(address.recipientName) ? '' : address.recipientName,
    same(address.company) ? '' : address.company,
    address.line1,
    address.line2,
    localityLine(address),
    abroad ? country : '',
  ]
    .map((line) => (line ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Who the document is made out to, for this customer.
 *
 * A customer on a wholesale account is billed AS that account; anyone else as
 * themselves (or the business they typed at checkout, `billingName`). The email
 * is always the person's: that is who receives it.
 */
export function billedParty(
  customer: CustomerSummary,
  accountName: string | null,
  addresses: readonly CustomerAddress[],
  homeCountry: string | null = null
): BilledPartyFull {
  const name = customer.companyId && accountName ? accountName : billingName(customer);
  return {
    name,
    email: customer.email ?? '',
    address: addressText(billingAddressOf(addresses), name, homeCountry),
    companyId: customer.companyId,
  };
}

function addressesQuery(customerId: string) {
  return {
    queryKey: customerKeys.addresses(customerId),
    queryFn: () => api.get<CustomerAddress[]>(`/v1/crm/customers/${customerId}/addresses`),
    staleTime: 60_000,
  };
}

/** The business's own country, through the key Business details uses. */
const businessQuery = {
  queryKey: ['tenant', 'business'],
  queryFn: () => api.get<{ country: string | null }>('/v1/tenant/business'),
};

function accountQuery(companyId: string) {
  return {
    queryKey: accountKeys.detail(companyId),
    queryFn: () => api.get<Company>(`/v1/crm/companies/${companyId}`),
    staleTime: 60_000,
  };
}

/** The wholesale account's name, or null while it loads or when there is none. */
export function useAccountName(companyId: string | null): string | null {
  const account = useQuery({ ...accountQuery(companyId ?? ''), enabled: Boolean(companyId) });
  return companyId ? (account.data?.companyName ?? null) : null;
}

/**
 * Who the document is made out to for the customer ALREADY on it, or null while
 * that is still being read. The printed fields are compared against this to
 * tell what was filled in for them from what somebody typed (./bill-to-fill).
 */
export function useBilledParty(customer: CustomerSummary | undefined): BilledPartyFull | null {
  const addresses = useQuery({
    ...addressesQuery(customer?.id ?? ''),
    enabled: Boolean(customer),
  });
  const accountName = useAccountName(customer?.companyId ?? null);
  const business = useQuery(businessQuery);
  if (!customer) return null;
  if (addresses.isPending || business.isPending) return null;
  if (customer.companyId && accountName === null) return null;
  return billedParty(customer, accountName, addresses.data ?? [], business.data?.country ?? null);
}

/**
 * The same answer for a customer just PICKED, fetched on the spot.
 *
 * A failed read of the account or the addresses degrades to what the picker
 * already holds (the person's own name, no address) rather than refusing the
 * pick: the customer is still the right customer.
 */
export async function fetchBilledParty(
  queryClient: QueryClient,
  customer: CustomerSummary
): Promise<BilledPartyFull> {
  const [addresses, account, business] = await Promise.all([
    queryClient.fetchQuery(addressesQuery(customer.id)).catch(() => [] as CustomerAddress[]),
    customer.companyId
      ? queryClient.fetchQuery(accountQuery(customer.companyId)).catch(() => null)
      : Promise.resolve(null),
    queryClient.fetchQuery(businessQuery).catch(() => null),
  ]);
  return billedParty(customer, account?.companyName ?? null, addresses, business?.country ?? null);
}
