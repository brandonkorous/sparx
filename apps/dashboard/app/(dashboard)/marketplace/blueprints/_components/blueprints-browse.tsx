'use client';

// Blueprints browse (docs/60 §5): facet rail + sort + active-filter chips + a
// paged grid with "Load more". Filter/sort/search live in the URL — changing one
// navigates, and the server refetches page 1 (the parent remounts this component
// via a key, resetting the accumulated list). "Load more" appends the next cursor
// page via the fetchBlueprintsPage server action.

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

import { BlueprintCard } from '../../_components/blueprint-card';
import type { BrowseFacets, CatalogItem } from '../../_types';
import type { SortSpec } from '../../_registry';
import { fetchBlueprintsPage } from '../actions';

const ACRONYMS: Record<string, string> = { b2b: 'B2B', cms: 'CMS', crm: 'CRM', seo: 'SEO' };
function humanize(v: string): string {
  return ACRONYMS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

interface Props {
  // Only serializable fields cross the server→client boundary — NOT the registry
  // entry itself (its `icon` is a function and can't be passed to a client component).
  singular: string;
  sorts: SortSpec[];
  initialItems: CatalogItem[];
  facets: BrowseFacets;
  total: number;
  initialCursor: string | null;
  canInstall: boolean;
}

export function BlueprintsBrowse({
  singular,
  sorts,
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
  const status = searchParams.get('status');
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

  function toggleMulti(key: string, value: string) {
    const cur = selectedOf(key);
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    updateParams({ [key]: cur.size ? [...cur].join(',') : null });
  }

  function setStatus(value: 'installed' | 'available') {
    updateParams({ status: status === value ? null : value });
  }

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const query: Record<string, string> = {};
      searchParams.forEach((v, k) => {
        query[k] = v;
      });
      query.cursor = cursor;
      const res = await fetchBlueprintsPage(query);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    });
  }

  // active-filter chips
  const chips: { key: string; value: string; label: string }[] = [];
  for (const key of ['vertical', 'modules']) {
    for (const v of selectedOf(key)) chips.push({ key, value: v, label: humanize(v) });
  }
  if (status) {
    chips.push({
      key: 'status',
      value: status,
      label: status === 'installed' ? 'Installed' : 'Available',
    });
  }

  const rail = (
    <Stack gap={5}>
      <FacetBlock title="Vertical">
        {sortedEntries(facets.vertical).map(([val, count]) => (
          <FacetRow
            key={val}
            label={humanize(val)}
            count={count}
            checked={selectedOf('vertical').has(val)}
            onToggle={() => toggleMulti('vertical', val)}
          />
        ))}
      </FacetBlock>
      <FacetBlock title="Requires module">
        {sortedEntries(facets.modules).map(([val, count]) => (
          <FacetRow
            key={val}
            label={humanize(val)}
            count={count}
            checked={selectedOf('modules').has(val)}
            onToggle={() => toggleMulti('modules', val)}
          />
        ))}
      </FacetBlock>
      <FacetBlock title="Status">
        <FacetRow
          label="Installed"
          count={facets.status.installed}
          checked={status === 'installed'}
          onToggle={() => setStatus('installed')}
        />
        <FacetRow
          label="Available"
          count={facets.status.available}
          checked={status === 'available'}
          onToggle={() => setStatus('available')}
        />
      </FacetBlock>
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
              aria-label="Sort blueprints"
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
                  c.key === 'status' ? updateParams({ status: null }) : toggleMulti(c.key, c.value)
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
            <Text variant="muted">No blueprints match these filters.</Text>
            <Button variant="outline" size="sm" onClick={() => router.push(pathname)}>
              Clear filters
            </Button>
          </Stack>
        ) : (
          <>
            <Grid minItemWidth="14rem" gap={4}>
              {items.map((item) => (
                <BlueprintCard key={item.key} item={item} canInstall={canInstall} />
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
