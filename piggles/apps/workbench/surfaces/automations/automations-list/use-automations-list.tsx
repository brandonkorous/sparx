'use client';

import { useMemo, useState } from 'react';
import { useReaderClock } from '../../../lib/business-timezone';
import { useAutomations } from '../automations-data';
import { sortedRows, type Dir, type SortKey } from './rows';

/** The list's filters, sort and rows: filtering by status / origin is server-side; search and
 *  sort are local, which is correct because the API returns the whole (bounded) set. */
export function useAutomationsList() {
  const clock = useReaderClock();
  const [status, setStatus] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: 'lastRun', dir: 'desc' });

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAutomations({
    status,
    origin,
  });

  const needle = search.trim().toLowerCase();

  const rows = useMemo(() => sortedRows(data, needle, sort, clock), [data, needle, sort, clock]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Text ascends; counts and recency descend (busiest / newest first).
          { key, dir: key === 'name' || key === 'trigger' ? 'asc' : 'desc' }
    );
  };

  const filtering = status !== 'all' || origin !== 'all' || needle !== '';

  return {
    ...{ clock, status, setStatus, origin, setOrigin, search, setSearch, sort, setSort },
    ...{ data, isPending, isError, isFetching, dataUpdatedAt, refetch },
    ...{ rows, toggleSort, filtering },
  };
}

export type AutomationsList = ReturnType<typeof useAutomationsList>;
