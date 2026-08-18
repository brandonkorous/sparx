'use client';

// Picking a CRM record of ANY kind (docs/144 §6).
//
// The association panel can point at a person, a company, a deal or something a
// business invented, and it cannot know at build time which — so the picker is
// parameterised by object key rather than written four times. The alternative
// (a customer picker, a company picker, a deal picker, and nothing at all for
// custom objects) is how a feature that is supposed to work across every record
// type ends up working across three.
//
// Each kind reads from its own list endpoint, because each has its own search:
// a person is found by name or email, a company by company name, a deal by
// title. One "search everything" endpoint would return the wrong shape for all
// three and rank them against each other for no reason.

import { useMemo } from 'react';
import { useQuery } from '@wizeworks/query';
import { Combobox } from '@wizeworks/silicaui-react';
import { api } from '../../lib/api/client';
import { objectLabel } from './associations-data';

interface Option {
  value: string;
  label: string;
}

/** Where each kind of record is listed, and how to name one. */
interface Source {
  path: string;
  label: (row: Record<string, unknown>) => string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const SOURCES: Record<string, Source> = {
  contact: {
    path: '/v1/crm/customers',
    label: (row) => {
      const person = [str(row.firstName), str(row.lastName)].filter(Boolean).join(' ').trim();
      const name = person || str(row.company) || str(row.email);
      const email = str(row.email);
      // The email is what tells apart the two Dave Kellys every real customer
      // list has.
      return email && email !== name ? `${name} · ${email}` : name || 'Unnamed';
    },
  },
  company: {
    path: '/v1/crm/b2b-accounts',
    label: (row) => str(row.companyName) || 'Unnamed company',
  },
  deal: {
    path: '/v1/crm/deals',
    label: (row) => str(row.title) || 'Untitled deal',
  },
};

export interface RecordPickerProps {
  objectKey: string;
  value: string | null;
  /** The record doing the picking, so it cannot pick itself. */
  excludeId?: string;
  onSelect: (recordId: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function RecordPicker({
  objectKey,
  value,
  excludeId,
  onSelect,
  onClear,
  disabled,
}: RecordPickerProps) {
  const source = SOURCES[objectKey];
  // Anything a business invented lives in the generic records table.
  const path = source?.path ?? `/v1/crm/objects/${objectKey}/records`;

  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'record-picker', objectKey],
    queryFn: () => api.list<Record<string, unknown>>(path, { take: 100 }),
    staleTime: 60_000,
  });

  // MEMOISED, and not as an optimisation: <Combobox> keys an effect off the
  // identity of `items`, so rebuilding the array every render schedules a state
  // update that triggers the next render — "Maximum update depth exceeded",
  // caught by the pane's error boundary. Same trap the customer picker
  // documents.
  const options: Option[] = useMemo(
    () =>
      (data?.items ?? [])
        .filter((row) => str(row.id) !== excludeId)
        .map((row) => ({
          value: str(row.id),
          label: source ? source.label(row) : str(row.title) || 'Untitled',
        })),
    [data, excludeId, source]
  );

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const kind = objectLabel(objectKey).toLowerCase();

  return (
    <Combobox
      color="module"
      items={options}
      value={selected}
      disabled={disabled ?? isLoading}
      placeholder={isLoading ? `Loading ${kind}…` : `Search ${kind}…`}
      emptyMessage={`Nothing in ${kind} matches that.`}
      aria-label={objectLabel(objectKey)}
      onValueChange={(next) => {
        if (!next) {
          onClear();
          return;
        }
        onSelect((next as Option).value);
      }}
    />
  );
}
