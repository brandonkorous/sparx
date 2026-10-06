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
//
// The row itself is `customerPickerRow`, next door, and the businesses are
// looked up here because a name is the only part of a wholesale customer this
// control needs: a person who buys for a shop has to READ as that on the screen
// that decides what they are charged (issue 746).

import { useMemo, useState } from 'react';
import { useQueryClient } from '@wizeworks/query';
import { useDebouncedValue } from '../../lib/api/search';
import { SearchPicker } from '../../components/search-picker';
import { useAccounts } from '../crm/companies-data';
import { customerName } from '../crm/customers-data';
import {
  billingName,
  customerPickerKeys,
  customerPickerRow,
  useCustomerOnRecord,
  useCustomerSearch,
  type CustomerSummary,
} from './customer-picker-data';

export { billingName, customerName };
export type { CustomerSummary };

interface CustomerPickerProps {
  value: string | null;
  disabled?: boolean;
  onSelect: (customer: CustomerSummary) => void;
  onClear: () => void;
  /**
   * What to do when nobody matches. Given what was typed, so the screen it
   * opens can arrive with the name already in it.
   *
   * Without it the picker keeps saying "Add them in Customers first", which is
   * true and is still a dead end: she leaves, finds the screen, retypes the
   * name, comes back, finds the record again, and types the name a third time
   * (issue 745). A picker that can only reject is only half a control.
   */
  onAddNew?: (typed: string) => void;
  /**
   * People who cannot be picked here, by customer id, each with the words that
   * say why. They still show in the results, so a search for them does not
   * end in "nobody is called that" and an offer to add them a second time.
   */
  unavailable?: ReadonlyMap<string, string>;
}

export function CustomerPicker({
  value,
  disabled,
  onSelect,
  onClear,
  onAddNew,
  unavailable,
}: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const onRecord = useCustomerOnRecord(value);
  // The box waits a quarter second after each key before it asks. Until it
  // has asked about what is typed now, that is still a search, not "nobody
  // matches": the picker said nobody matched Ravi while it waited (issue 914).
  const term = useDebouncedValue(query, 250);
  const search = useCustomerSearch(term);
  const results = search.data?.items ?? [];

  // The same read the customer editor's Wholesale customer field makes, so both
  // screens name a business identically and neither pays for its own list.
  const { data: accounts } = useAccounts();
  const businesses = useMemo(() => {
    const names: Record<string, string> = {};
    for (const account of accounts?.items ?? []) names[account.id] = account.companyName;
    return names;
  }, [accounts]);

  const toRow = (customer: CustomerSummary) =>
    customerPickerRow(
      customer,
      customer.companyId ? businesses[customer.companyId] : null,
      unavailable?.get(customer.id)
    );

  return (
    <SearchPicker
      chosen={value && onRecord.data ? toRow(onRecord.data) : null}
      loadingChosen={Boolean(value) && onRecord.isPending}
      chosenError={value && onRecord.isError ? 'That customer could not be loaded.' : null}
      results={results.map(toRow)}
      searching={search.isFetching || term !== query}
      query={query}
      onQuery={setQuery}
      disabled={disabled}
      label="Search customers"
      placeholder="Search by name, email or company…"
      tooShort="Type at least two letters to find someone."
      nothingFound={
        onAddNew
          ? 'Nobody you already know is called that.'
          : 'No customer matches that. Add them in Customers first.'
      }
      {...(onAddNew
        ? {
            nothingFoundAction: {
              label: (typed: string) => `Add ${typed} as a customer`,
              onAct: onAddNew,
            },
          }
        : {})}
      clearLabel="Choose a different customer"
      onSelect={(id) => {
        const picked = results.find((customer) => customer.id === id);
        if (!picked || unavailable?.has(id)) return;
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
