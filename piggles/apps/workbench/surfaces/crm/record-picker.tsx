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
// Each kind reads from its own list endpoint and each one searches on the
// SERVER (issue 183): a person is found by name or email, a company by company
// name, a deal by title, and the answer covers every record rather than the
// first page of them.

import { useMemo, useState } from 'react';
import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { useDebouncedValue } from '../../lib/api/search';
import { MIN_QUERY, SearchPicker, type PickerRow } from '../../components/search-picker';
import { objectLabel } from './associations-data';

type Row = Record<string, unknown>;

/** Where each kind of record is listed, and how to name one. */
interface Source {
  path: string;
  row: (row: Row) => PickerRow;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const SOURCES: Record<string, Source> = {
  contact: {
    path: '/v1/crm/customers',
    row: (row) => {
      const person = [str(row.firstName), str(row.lastName)].filter(Boolean).join(' ').trim();
      const name = person || str(row.company) || str(row.email);
      const email = str(row.email);
      // The email is what tells apart the two Dave Kellys every real customer
      // list has.
      return {
        id: str(row.id),
        primary: name || 'Unnamed',
        secondary: email && email !== name ? email : null,
      };
    },
  },
  company: {
    path: '/v1/crm/b2b-accounts',
    row: (row) => ({
      id: str(row.id),
      primary: str(row.companyName) || 'Unnamed company',
      secondary: str(row.accountNumber) || null,
    }),
  },
  deal: {
    path: '/v1/crm/deals',
    row: (row) => ({
      id: str(row.id),
      primary: str(row.title) || 'Untitled deal',
      secondary: null,
    }),
  },
};

/** Anything a business invented lives in the generic records table. */
function sourceFor(objectKey: string): Source {
  return (
    SOURCES[objectKey] ?? {
      path: `/v1/crm/objects/${objectKey}/records`,
      row: (row) => ({ id: str(row.id), primary: str(row.title) || 'Untitled', secondary: null }),
    }
  );
}

function useRecordSearch(objectKey: string, source: Source, term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['crm', 'record-picker', objectKey, q] as const,
    queryFn: () => api.list<Row>(source.path, { q, take: 20 }),
    enabled: q.length >= MIN_QUERY,
    staleTime: 30_000,
  });
}

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
  const [query, setQuery] = useState('');
  // The only value this picker ever receives is one it just produced, so the
  // chosen row is remembered rather than re-read.
  const [picked, setPicked] = useState<PickerRow | null>(null);
  const source = sourceFor(objectKey);
  const search = useRecordSearch(objectKey, source, useDebouncedValue(query, 250));

  const results = useMemo(
    () =>
      (search.data?.items ?? []).map(source.row).filter((row) => row.id && row.id !== excludeId),
    [search.data, source, excludeId]
  );

  const kind = objectLabel(objectKey).toLowerCase();

  return (
    <SearchPicker
      chosen={picked?.id === value ? picked : null}
      results={results}
      searching={search.isFetching}
      query={query}
      onQuery={setQuery}
      disabled={disabled}
      label={`Search ${kind}`}
      placeholder={`Search ${kind}…`}
      tooShort={`Type at least two letters to search ${kind}.`}
      nothingFound={`Nothing in ${kind} matches that.`}
      clearLabel="Choose a different record"
      onSelect={(id) => {
        setPicked(results.find((row) => row.id === id) ?? null);
        onSelect(id);
      }}
      onClear={() => {
        setPicked(null);
        setQuery('');
        onClear();
      }}
    />
  );
}
