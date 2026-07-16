'use client';

// PLP facet sidebar (client). All state lives in the URL — this reads the current
// searchParams and pushes new ones. Controls: active-filter chips, free-text
// search, category links WITH result counts, a price-range mini-form, an in-stock
// toggle (with its remaining count), and the sort select (mobile only; the desktop
// toolbar carries sort). On mobile the whole panel collapses behind a "Filters"
// button so it never crowds the grid. The grid is server-rendered by the parent.

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { MARKET_CATEGORIES, marketCategoryLabel } from '@sparx/commerce-schemas';
import { Badge, Button, Input, NativeSelect } from '@wizeworks/silicaui-react';
import { cx } from '@wizeworks/silicaui-react/server';

import type { MarketSort, MarketFacets } from '@/lib/market';

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

const LEGEND = 'text-xs font-semibold uppercase tracking-[0.04em] text-base-content';

function FacetGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className={LEGEND}>{legend}</span>
      {children}
    </div>
  );
}

/** A removable active-filter pill (composes silicaui <Badge> — never re-skinned). */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge color="neutral" variant="soft" size="sm">
      <span className="max-w-[10rem] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="text-base-content hover:text-base-content -mr-1 ml-0.5 inline-flex items-center rounded-full p-0.5 transition-colors"
      >
        <X size={12} aria-hidden />
      </button>
    </Badge>
  );
}

/** When true, the category facet is fixed (a category landing page) and hidden. */
export function PlpFacets({
  basePath,
  state,
  counts,
  lockCategory = false,
}: {
  basePath: string;
  state: PlpFacetState;
  counts: MarketFacets;
  lockCategory?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const minId = useId();
  const maxId = useId();

  const [q, setQ] = useState(state.q ?? '');
  const [minPrice, setMinPrice] = useState(state.minPrice ?? '');
  const [maxPrice, setMaxPrice] = useState(state.maxPrice ?? '');
  const [open, setOpen] = useState(false);

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

  // Category counts honor every filter but the category axis; "All" is their sum.
  const countBySlug = new Map(counts.categories.map((c) => [c.slug, c.count]));
  const allCount = counts.categories.reduce((sum, c) => sum + c.count, 0);
  const visibleCategories = MARKET_CATEGORIES.filter(
    (c) => (countBySlug.get(c.slug) ?? 0) > 0 || state.category === c.slug
  );

  // Active-filter chips (drives the "clear" affordances + the mobile count).
  const priceLabel =
    state.minPrice || state.maxPrice
      ? `$${state.minPrice ?? '0'}–${state.maxPrice ? `$${state.maxPrice}` : 'any'}`
      : null;
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (state.q)
    chips.push({ key: 'q', label: `“${state.q}”`, onRemove: () => navigate({ q: undefined }) });
  if (!lockCategory && state.category)
    chips.push({
      key: 'category',
      label: marketCategoryLabel(state.category),
      onRemove: () => navigate({ category: undefined }),
    });
  if (priceLabel)
    chips.push({
      key: 'price',
      label: priceLabel,
      onRemove: () => navigate({ minPrice: undefined, maxPrice: undefined }),
    });
  if (state.inStock)
    chips.push({
      key: 'inStock',
      label: 'In stock',
      onRemove: () => navigate({ inStock: undefined }),
    });

  function clearAll() {
    navigate({
      q: undefined,
      ...(lockCategory ? {} : { category: undefined }),
      minPrice: undefined,
      maxPrice: undefined,
      inStock: undefined,
    });
  }

  const catLink = (active: boolean) =>
    cx(
      '-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
      active
        ? 'bg-primary/10 font-semibold text-primary'
        : 'text-base-content hover:bg-base-200 hover:text-base-content'
    );

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile disclosure toggle — the panel is always shown from lg up. */}
      <Button
        type="button"
        color="neutral"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="justify-between lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={15} aria-hidden />
          Filters
        </span>
        {chips.length > 0 ? (
          <Badge color="primary" variant="soft" size="sm">
            {chips.length}
          </Badge>
        ) : null}
      </Button>

      <div className={cx('flex-col gap-6', open ? 'flex' : 'hidden', 'lg:flex')}>
        {/* Active filters */}
        {chips.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={LEGEND}>Filters</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-primary text-xs font-medium hover:underline"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <FilterChip key={c.key} label={c.label} onRemove={c.onRemove} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Search */}
        <FacetGroup legend="Search">
          <form className="flex gap-2" onSubmit={submitSearch}>
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
          </form>
        </FacetGroup>

        {/* Category */}
        {!lockCategory ? (
          <FacetGroup legend="Category">
            <div className="flex flex-col">
              <button
                type="button"
                className={catLink(!state.category)}
                onClick={() => navigate({ category: undefined })}
              >
                <span>All categories</span>
                <span className="text-base-content">{allCount.toLocaleString()}</span>
              </button>
              {visibleCategories.map((category) => {
                const active = state.category === category.slug;
                return (
                  <button
                    key={category.slug}
                    type="button"
                    className={catLink(active)}
                    onClick={() => navigate({ category: category.slug })}
                  >
                    <span>{category.name}</span>
                    <span className="text-base-content">
                      {(countBySlug.get(category.slug) ?? 0).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </FacetGroup>
        ) : null}

        {/* Price range */}
        <FacetGroup legend="Price">
          <form className="flex flex-col gap-2.5" onSubmit={submitPrice}>
            <div className="flex gap-2">
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
        </FacetGroup>

        {/* Availability */}
        <FacetGroup legend="Availability">
          <label className="text-base-content flex cursor-pointer items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary"
                checked={state.inStock}
                onChange={(e) => navigate({ inStock: e.target.checked ? 'true' : undefined })}
              />
              In stock only
            </span>
            <span className="text-base-content">{counts.inStockCount.toLocaleString()}</span>
          </label>
        </FacetGroup>

        {/* Sort (mobile-only; the desktop toolbar carries sort). The whole group is
            hidden from lg up via a plain wrapper — never a display utility on the
            silicaui <NativeSelect> itself. */}
        <div className="lg:hidden">
          <FacetGroup legend="Sort">
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
          </FacetGroup>
        </div>
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
      <span className="text-base-content text-sm">Sort</span>
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
