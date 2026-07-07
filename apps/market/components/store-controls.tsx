'use client';

// In-store controls for a seller's storefront page: a scoped search box + a sort
// select, both driving the URL (so the server re-renders the merchant's filtered
// catalog). Mirrors the PLP's URL-state pattern, but scoped to one merchant path
// and without category facets (a single store).

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button, Input, NativeSelect } from 'silicaui-react';

import type { MarketSort } from '@/lib/market';

const SORTS: { value: MarketSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'lowest_price', label: 'Price: low to high' },
  { value: 'highest_price', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export function StoreControls({
  basePath,
  q: initialQ,
  sort,
}: {
  basePath: string;
  q?: string;
  sort: MarketSort;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ ?? '');

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    const s = params.toString();
    router.push(s ? `${basePath}?${s}` : basePath);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: q.trim() || undefined });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 gap-2 sm:max-w-sm">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 z-10 text-[var(--color-text-tertiary)]"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this store"
            aria-label="Search this store"
            className="w-full pl-9"
          />
        </div>
        {initialQ ? (
          <Button
            type="button"
            color="neutral"
            variant="ghost"
            size="md"
            shape="square"
            aria-label="Clear search"
            onClick={() => {
              setQ('');
              navigate({ q: undefined });
            }}
          >
            <X size={16} aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            color="primary"
            variant="solid"
            size="md"
            shape="square"
            aria-label="Search"
          >
            <Search size={16} aria-hidden />
          </Button>
        )}
      </form>

      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-text-secondary)]">Sort</span>
        <NativeSelect
          className="w-44"
          value={sort}
          size="sm"
          aria-label="Sort products"
          onChange={(e) => navigate({ sort: e.target.value })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
