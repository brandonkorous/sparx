'use client';

// PLP facet sidebar + toolbar (client). All state lives in the URL — this just
// reads the current searchParams and pushes new ones. Controls: free-text search,
// category links, a price-range mini-form, an in-stock toggle, and the sort
// select (auto-navigates on change). The grid itself is server-rendered by the
// parent; only the control surface is interactive.

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button, Input, NativeSelect } from '@sparx/ui';

import type { MarketSort } from '@/lib/market';

const SORTS: { value: MarketSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'lowest_price', label: 'Price: low to high' },
  { value: 'highest_price', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export interface PlpFacetState {
  q?: string;
  category?: string;
  sort: MarketSort;
  minPrice?: string;
  maxPrice?: string;
  inStock: boolean;
}

/** When true, the category facet is fixed (a category landing page) and hidden. */
export function PlpFacets({
  basePath,
  state,
  lockCategory = false,
}: {
  basePath: string;
  state: PlpFacetState;
  lockCategory?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const minId = useId();
  const maxId = useId();

  const [q, setQ] = useState(state.q ?? '');
  const [minPrice, setMinPrice] = useState(state.minPrice ?? '');
  const [maxPrice, setMaxPrice] = useState(state.maxPrice ?? '');

  // Build a fresh URL from the current params, overriding the given keys and
  // always resetting pagination to page 1.
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

  function submitPrice(e: React.FormEvent) {
    e.preventDefault();
    navigate({ minPrice: minPrice.trim() || undefined, maxPrice: maxPrice.trim() || undefined });
  }

  return (
    <div className="mx-facets">
      {/* Search */}
      <form className="mx-facet__group" onSubmit={submitSearch}>
        <span className="mx-facet__legend">Search</span>
        <div className="mx-facet__row">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
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
        </div>
      </form>

      {/* Category */}
      {!lockCategory ? (
        <div className="mx-facet__group">
          <span className="mx-facet__legend">Category</span>
          <a
            href={basePath}
            className="mx-facet__link"
            data-active={!state.category ? 'true' : 'false'}
            onClick={(e) => {
              e.preventDefault();
              navigate({ category: undefined });
            }}
          >
            All categories
          </a>
          {MARKET_CATEGORIES.map((category) => (
            <a
              key={category.slug}
              href={`${basePath}?category=${category.slug}`}
              className="mx-facet__link"
              data-active={state.category === category.slug ? 'true' : 'false'}
              onClick={(e) => {
                e.preventDefault();
                navigate({ category: category.slug });
              }}
            >
              {category.name}
            </a>
          ))}
        </div>
      ) : null}

      {/* Price range */}
      <form className="mx-facet__group" onSubmit={submitPrice}>
        <span className="mx-facet__legend">Price</span>
        <div className="mx-facet__row">
          <label className="sr-only" htmlFor={minId}>
            Minimum price
          </label>
          <Input
            id={minId}
            type="number"
            min={0}
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min $"
          />
          <label className="sr-only" htmlFor={maxId}>
            Maximum price
          </label>
          <Input
            id={maxId}
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max $"
          />
        </div>
        <Button type="submit" color="neutral" variant="soft" size="sm">
          Apply price
        </Button>
      </form>

      {/* Availability */}
      <div className="mx-facet__group">
        <span className="mx-facet__legend">Availability</span>
        <label className="mx-facet__check">
          <input
            type="checkbox"
            checked={state.inStock}
            onChange={(e) => navigate({ inStock: e.target.checked ? 'true' : undefined })}
          />
          In stock only
        </label>
      </div>

      {/* Sort (mobile-visible here; the toolbar also exposes it on desktop) */}
      <div className="mx-facet__group lg:hidden">
        <span className="mx-facet__legend">Sort</span>
        <NativeSelect
          value={state.sort}
          onChange={(e) => navigate({ sort: e.target.value })}
          aria-label="Sort products"
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

/** The sort select rendered in the desktop results toolbar (hidden on mobile,
 *  where the sidebar carries it). */
export function PlpSort({ basePath, sort }: { basePath: string; sort: MarketSort }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.delete('page');
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <span className="mx-facet__legend">Sort</span>
      <NativeSelect
        className="w-48"
        value={sort}
        onChange={(e) => onChange(e.target.value)}
        size="sm"
        aria-label="Sort products"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
