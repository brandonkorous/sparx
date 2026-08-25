'use client';

// Choosing who the invoice is for.
//
// This is a real requirement, not a nicety: a billing document must reference a
// customer or a B2B account (a schema-level refine in crm-schemas), so an
// invoice addressed only to a typed-in name cannot be saved. The picker exists
// so that constraint surfaces as "pick the customer" rather than as a 400.
//
// Picking someone also fills in the billing name and email when those are still
// empty — filling them is almost always what was wanted, overwriting something
// already typed almost never is.

import { useState } from 'react';
import { useQueryClient } from '@wizeworks/query';
import { useDebouncedValue } from '../../lib/api/search';
import { SearchPicker, type PickerRow } from '../../components/search-picker';
import {
  customerLabel,
  customerPickerKeys,
  useCustomerOnRecord,
  useCustomerSearch,
  type CustomerSummary,
} from './customer-picker-data';

export { customerLabel };
export type { CustomerSummary };

/** Two lines: who they are, then the email that tells apart the two Dave Kellys
 *  every real customer list has. */
function toRow(customer: CustomerSummary): PickerRow {
  const primary = customerLabel(customer);
  return {
    id: customer.id,
    primary,
    secondary: customer.email && customer.email !== primary ? customer.email : null,
  };
}

interface CustomerPickerProps {
  value: string | null;
  disabled?: boolean;
  onSelect: (customer: CustomerSummary) => void;
  onClear: () => void;
}

export function CustomerPicker({ value, disabled, onSelect, onClear }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const onRecord = useCustomerOnRecord(value);
  const search = useCustomerSearch(useDebouncedValue(query, 250));
  const results = search.data?.items ?? [];

  return (
    <SearchPicker
      chosen={value && onRecord.data ? toRow(onRecord.data) : null}
      loadingChosen={Boolean(value) && onRecord.isPending}
      chosenError={value && onRecord.isError ? 'That customer could not be loaded.' : null}
      results={results.map(toRow)}
      searching={search.isFetching}
      query={query}
      onQuery={setQuery}
      disabled={disabled}
      label="Search customers"
      placeholder="Search by name, email or company…"
      tooShort="Type at least two letters to find someone."
      nothingFound="No customer matches that. Add them in Customers first."
      clearLabel="Choose a different customer"
      onSelect={(id) => {
        const picked = results.find((customer) => customer.id === id);
        if (!picked) return;
        // Seed the by-id read with the row just chosen, so the field names them
        // straight away instead of blanking to "Loading" on every pick.
        queryClient.setQueryData(customerPickerKeys.one(id), picked);
        onSelect(picked);
      }}
      onClear={() => {
        setQuery('');
        onClear();
      }}
    />
  );
}
