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

import { useMemo } from 'react';
import { useQuery } from '@wizeworks/query';
import { Combobox } from '@wizeworks/silicaui-react';
import { api } from '../../lib/api/client';

export interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

interface Option {
  value: string;
  label: string;
  customer: CustomerSummary;
}

/** How a person is named on an invoice: the company if there is one, otherwise
 *  the person, otherwise whatever we can identify them by. */
export function customerLabel(customer: CustomerSummary): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return customer.company ?? (person || customer.email) ?? 'Unnamed customer';
}

interface CustomerPickerProps {
  value: string | null;
  disabled?: boolean;
  onSelect: (customer: CustomerSummary) => void;
  onClear: () => void;
}

export function CustomerPicker({ value, disabled, onSelect, onClear }: CustomerPickerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'customers', 'picker'],
    queryFn: () => api.get<CustomerSummary[]>('/v1/crm/customers', { take: 100 }),
    staleTime: 60_000,
  });

  // MEMOISED, and it is not an optimisation. <Combobox> keys an effect off the
  // identity of `items`, so rebuilding the array every render schedules a state
  // update that causes the next render — "Maximum update depth exceeded", with
  // the pane's error boundary catching it.
  //
  // It survived on desktop only by luck: a docked pane re-renders rarely enough
  // that the loop never got going. The mobile stack re-renders on every host
  // emit and the crash was immediate. The bug was always here; one presentation
  // just happened not to poke it.
  const options: Option[] = useMemo(
    () =>
      (data ?? []).map((customer) => {
        const label = customerLabel(customer);
        return {
          value: customer.id,
          // Email disambiguates the two Dave Kellys a real customer list always has.
          label:
            customer.email && customer.email !== label ? `${label} · ${customer.email}` : label,
          customer,
        };
      }),
    [data]
  );

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  return (
    <Combobox
      color="module"
      items={options}
      value={selected}
      disabled={disabled ?? isLoading}
      placeholder={isLoading ? 'Loading customers…' : 'Search customers…'}
      emptyMessage="No customer matches that. Add them in Customers first."
      aria-label="Customer"
      onValueChange={(next) => {
        if (!next) {
          onClear();
          return;
        }
        onSelect((next as Option).customer);
      }}
    />
  );
}
