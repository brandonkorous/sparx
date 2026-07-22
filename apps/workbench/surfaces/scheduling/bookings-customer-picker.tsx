'use client';

// Choosing the customer a booking (or a waiting-list entry) is for.
//
// Shared by the booking create form and the "add to the waiting list" dialog, so
// the two search the address book the same way. A booking CAN be taken with no
// customer named (a walk-in written down), so the picker is clearable; the
// waiting list requires one, which the caller enforces by whether it accepts a
// null selection — not by the picker.

import { useState } from 'react';
import { Button, SearchInput, Text } from '@wizeworks/silicaui-react';
import { UserRound, X } from 'lucide-react';
import { customerName, useCustomerSearch, type CustomerLite } from './bookings-data';

export function CustomerPicker({
  value,
  onChange,
}: {
  value: CustomerLite | null;
  onChange: (customer: CustomerLite | null) => void;
}) {
  const [query, setQuery] = useState('');
  const { data, isFetching } = useCustomerSearch(query);
  const results = data?.items ?? [];
  const typed = query.trim();

  if (value) {
    return (
      <div className="border-base-300 bg-base-100 flex items-center gap-2 rounded-md border p-2">
        <UserRound className="text-base-content size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{customerName(value)}</span>
          {value.email ? (
            <Text as="span" className="block text-sm">
              {value.email}
            </Text>
          ) : null}
        </span>
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          shape="square"
          aria-label="Choose a different customer"
          onClick={() => {
            onChange(null);
            setQuery('');
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        size="sm"
        aria-label="Search for a customer"
        placeholder="Search by name, email or company…"
        value={query}
        onValueChange={setQuery}
      />
      {typed.length < 2 ? (
        <Text className="text-sm">Type at least two letters to find someone.</Text>
      ) : isFetching && results.length === 0 ? (
        <Text className="text-sm" role="status">
          Searching…
        </Text>
      ) : results.length === 0 ? (
        <Text className="text-sm">No one matches that. Try a different word.</Text>
      ) : (
        <div className="border-base-300 max-h-56 overflow-y-auto rounded-md border p-1">
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-2 text-left"
              onClick={() => {
                onChange(customer);
              }}
            >
              <span className="min-w-0 flex-1 font-medium">{customerName(customer)}</span>
              {customer.email ? (
                <Text as="span" className="shrink-0 text-sm">
                  {customer.email}
                </Text>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
