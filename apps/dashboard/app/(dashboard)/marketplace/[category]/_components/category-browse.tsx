'use client';

// Generic category browse (docs/60 §5): a registry-driven facet rail + sort +
// active-filter chips + a paged grid with "Load more", for ANY category. The
// facet dimensions come from the category's registry spec (key + label + multi/
// single), and their counts come from the API's faceted response — so themes,
// components, and integrations get the same browse with no new code once they're
// live. Filter/sort/search live in the URL — changing one navigates and the
// server refetches page 1 (the parent remounts this via a key, resetting the
// accumulated list). "Load more" appends the next cursor page via the
// fetchCategoryPage server action.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import {
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Grid,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';
import type { MarketplaceFacetBucket, MarketplaceListing } from '../../_types';

import { ListingCard } from '../../_components/listing-card';
import type { FacetSpec, SortSpec } from '../../_registry';
import { fetchCategoryPage } from '../actions';

const ACRONYMS: Record<string, string> = { b2b: 'B2B', cms: 'CMS', crm: 'CRM', seo: 'SEO' };
function humanize(v: string): string {
  return ACRONYMS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

interface Props {
  // Only serializable fields cross the server→client boundary — NOT the registry
  // entry itself (its `icon` is a function and can't be passed to a client component).
  categoryId: string;
  singular: string;
  sorts: SortSpec[];
  facetSpecs: FacetSpec[];
  initialItems: MarketplaceListing[];
  facets: Record<string, MarketplaceFacetBucket>;
  total: number;
  initialCursor: string | null;
  canInstall: boolean;
}

export function CategoryBrowse({
  categoryId,
  singular,
  sorts,
  facetSpecs,
  initialItems,
  facets,
  total,
  initialCursor,
  canInstall,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, startTransition] = React.useTransition();
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const sort = searchParams.get('sort') ?? 'popular';
  const selectedOf = (key: string) =>
    new Set((searchParams.get(key) ?? '').split(',').filter(Boolean));

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, val] of Object.entries(updates)) {
      if (val === null || val === '') params.delete(k);
      else params.set(k, val);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // A `multi` facet toggles a value in/out of a comma-joined set; a `single`
  // facet replaces (or clears) the param.
  function toggleFacet(spec: FacetSpec, value: string) {
    if (spec.type === 'single') {
      updateParams({ [spec.key]: searchParams.get(spec.key) === value ? null : value });
      return;
    }
    const cur = selectedOf(spec.key);
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    updateParams({ [spec.key]: cur.size ? [...cur].join(',') : null });
  }

  function isChecked(spec: FacetSpec, value: string): boolean {
    return spec.type === 'single'
      ? searchParams.get(spec.key) === value
      : selectedOf(spec.key).has(value);
  }

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const query: Record<string, string> = {};
      searchParams.forEach((v, k) => {
        query[k] = v;
      });
      query.cursor = cursor;
      const res = await fetchCategoryPage(categoryId, query);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    });
  }

  // active-filter chips, across every facet dimension
  const chips: { key: string; value: string; label: string }[] = [];
  for (const spec of facetSpecs) {
    for (const v of selectedOf(spec.key))
      chips.push({ key: spec.key, value: v, label: humanize(v) });
  }

  const rail = (
    <Stack gap={5}>
      {facetSpecs.map((spec) => {
        const counts = facets[spec.key] ?? {};
        const entries = sortedEntries(counts);
        if (entries.length === 0) return null;
        return (
          <FacetBlock key={spec.key} title={spec.label}>
            {entries.map(([val, count]) => (
              <FacetRow
                key={val}
                label={humanize(val)}
                count={count}
                checked={isChecked(spec, val)}
                onToggle={() => toggleFacet(spec, val)}
              />
            ))}
          </FacetBlock>
        );
      })}
    </Stack>
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[232px_1fr]">
      <aside className="hidden md:block">
        <div className="sticky top-24">{rail}</div>
      </aside>

      <div className="min-w-0">
        <Stack direction="row" align="center" gap={3} className="mb-4 flex-wrap">
          <Text size="sm" variant="muted">
            {total.toLocaleString()} {total === 1 ? singular : `${singular}s`}
          </Text>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Filters
            </Button>
            <NativeSelect
              aria-label={`Sort ${singular}s`}
              value={sort}
              onChange={(e) =>
                updateParams({ sort: e.target.value === 'popular' ? null : e.target.value })
              }
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>
                  {`Sort: ${s.label}`}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Stack>

        {chips.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <Button
                key={`${c.key}:${c.value}`}
                color="neutral"
                variant="soft"
                size="sm"
                onClick={() =>
                  updateParams({ [c.key]: removeFromCsv(searchParams.get(c.key), c.value) })
                }
              >
                {c.label}
                <span aria-hidden className="ml-1.5">
                  ×
                </span>
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
              Clear all
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <Stack
            gap={3}
            align="center"
            className="rounded-lg border border-[var(--color-border)] p-10 text-center"
          >
            <Text variant="muted">No {singular}s match these filters.</Text>
            <Button variant="outline" size="sm" onClick={() => router.push(pathname)}>
              Clear filters
            </Button>
          </Stack>
        ) : (
          <>
            <Grid minItemWidth="14rem" gap={4}>
              {items.map((item) => (
                <ListingCard key={item.slug} item={item} canInstall={canInstall} />
              ))}
            </Grid>
            {cursor ? (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={loadMore} loading={loading} disabled={loading}>
                  Load more
                </Button>
                <Text size="sm" variant="muted" className="mt-2">
                  Showing {items.length} of {total.toLocaleString()}
                </Text>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent side="bottom" className="max-h-[85vh] rounded-t-xl pt-2">
          <DrawerTitle className="px-4 pt-2 pb-1">Filters</DrawerTitle>
          <div className="overflow-y-auto p-4">{rail}</div>
          <div className="border-t border-[var(--color-border)] p-4">
            <Button color="primary" className="w-full" onClick={() => setFiltersOpen(false)}>
              Show {total.toLocaleString()} results
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** Remove one value from a comma-joined param, returning the new value (or null
 *  when empty) — used to dismiss an active-filter chip. */
function removeFromCsv(current: string | null, value: string): string | null {
  const next = (current ?? '').split(',').filter((v) => v && v !== value);
  return next.length ? next.join(',') : null;
}

function sortedEntries(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function FacetBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" variant="muted" weight="medium" className="mb-2 tracking-wide uppercase">
        {title}
      </Text>
      <div>{children}</div>
    </div>
  );
}

function FacetRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} />
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">
        {count.toLocaleString()}
      </span>
    </label>
  );
}
