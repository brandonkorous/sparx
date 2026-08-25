'use client';

// Choosing the customer a booking (or a waiting-list entry) is for.
//
// Shared by the booking create form and the "add to the waiting list" dialog, so
// the two search the address book the same way. A booking CAN be taken with no
// customer named (a walk-in written down), so the picker is clearable; the
// waiting list requires one, which the caller enforces by whether it accepts a
// null selection — not by the picker.

import { useState } from 'react';
import { useDebouncedValue } from '../../lib/api/search';
import { SearchPicker, type PickerRow } from '../../components/search-picker';
import { customerName, useCustomerSearch, type CustomerLite } from './bookings-data';

function toRow(customer: CustomerLite): PickerRow {
  const primary = customerName(customer);
  return {
    id: customer.id,
    primary,
    secondary: customer.email && customer.email !== primary ? customer.email : null,
  };
}

export function CustomerPicker({
  value,
  onChange,
}: {
  value: CustomerLite | null;
  onChange: (customer: CustomerLite | null) => void;
}) {
  const [query, setQuery] = useState('');
  const search = useCustomerSearch(useDebouncedValue(query, 250));
  const results = search.data?.items ?? [];

  return (
    <SearchPicker
      chosen={value ? toRow(value) : null}
      results={results.map(toRow)}
      searching={search.isFetching}
      query={query}
      onQuery={setQuery}
      label="Search for a customer"
      placeholder="Search by name, email or company…"
      tooShort="Type at least two letters to find someone."
      nothingFound="No one matches that. Try a different word."
      clearLabel="Choose a different customer"
      onSelect={(id) => {
        const picked = results.find((customer) => customer.id === id);
        if (picked) onChange(picked);
      }}
      onClear={() => {
        setQuery('');
        onChange(null);
      }}
    />
  );
}
