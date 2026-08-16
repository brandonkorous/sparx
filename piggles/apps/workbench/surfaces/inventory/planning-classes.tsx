'use client';

// WHAT MATTERS — where the money is, and what can be predicted.
//
// Two questions, deliberately kept apart. "Worth" ranks lines by what you
// actually consume in a year at cost, so the top of the list is where buying
// attention pays; "Demand" says whether that line's sales are steady enough to
// forecast at all. Neither answers the other: a top-value line with erratic
// demand is the one that needs a person, and a long-tail line with steady demand
// is the one that can be left to a reorder level and forgotten.
//
// The PAIR is what carries the advice on every row.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  EmptyState,
  NativeSelect,
  SearchInput,
  Table,
} from '@wizeworks/silicaui-react';
import { faBoxOpen, faGauge } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents } from './data';
import {
  abcLabel,
  abcTone,
  useClassifications,
  xyzLabel,
  xyzTone,
  type AbcClass,
  type XyzClass,
} from './planning-data';
import { PlanningShell, targetFor, useHasBeenMeasured } from './planning-shell';

export function PlanningClassesSurface({ ctx }: { ctx: SurfaceContext }) {
  // Filter state lives up here so the controls can sit in the pane's ONE
  // toolbar rather than in a second bar of their own above the table.
  const [search, setSearch] = useState('');
  const [abc, setAbc] = useState<'' | AbcClass>('');
  const [xyz, setXyz] = useState<'' | XyzClass | 'unknown'>('');

  const classifications = useClassifications({ take: 1, skip: 0 });

  return (
    <PlanningShell
      label="What matters controls"
      isFetching={classifications.isFetching}
      updatedAt={classifications.data ? classifications.dataUpdatedAt : undefined}
      onRefresh={() => {
        void classifications.refetch();
      }}
      filters={
        <>
          {/* Width sits on a WRAPPER — SearchInput forwards className to its
              inner input, not to the field. */}
          <div className="max-w-56 min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search items"
              placeholder="Product name or code…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <NativeSelect
            size="sm"
            className="max-w-36 shrink"
            aria-label="Show items worth"
            value={abc}
            onChange={(event) => {
              setAbc(event.target.value as '' | AbcClass);
            }}
          >
            <option value="">Any value</option>
            <option value="A">Top value</option>
            <option value="B">Mid value</option>
            <option value="C">Long tail</option>
          </NativeSelect>
          <NativeSelect
            size="sm"
            className="max-w-36 shrink"
            aria-label="Show items whose demand is"
            value={xyz}
            onChange={(event) => {
              setXyz(event.target.value as '' | XyzClass | 'unknown');
            }}
          >
            <option value="">Any demand</option>
            <option value="X">Steady</option>
            <option value="Y">Uneven</option>
            <option value="Z">Erratic</option>
            <option value="unknown">Not enough history</option>
          </NativeSelect>
        </>
      }
    >
      {(locationId) => (
        <ClassesPanel ctx={ctx} locationId={locationId} search={search} abc={abc} xyz={xyz} />
      )}
    </PlanningShell>
  );
}

function ClassesPanel({
  ctx,
  locationId,
  search,
  abc,
  xyz,
}: {
  ctx: SurfaceContext;
  locationId: string;
  search: string;
  abc: '' | AbcClass;
  xyz: '' | XyzClass | 'unknown';
}) {
  const measured = useHasBeenMeasured();

  const classifications = useClassifications({
    ...(locationId ? { warehouseId: locationId } : {}),
    ...(abc ? { abcClass: abc } : {}),
    ...(xyz ? { xyzClass: xyz } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    take: 100,
    skip: 0,
  });

  const rows = classifications.data?.items ?? [];
  const filtered = Boolean(abc || xyz || search.trim());
  const multiLocation = new Set(rows.map((row) => row.warehouseId)).size > 1;
  // A whole column of "Not enough history" is honest but mute. When that is the
  // state of every row, say WHY once at the top instead of leaving the reader to
  // infer that half the screen is broken.
  const noneJudged = rows.length > 0 && rows.every((row) => row.xyzClass === null);

  return (
    <div className="flex flex-col gap-3">
      {noneJudged ? (
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>Worth is ranked; steadiness is not, yet</AlertTitle>
            <AlertDescription>
              The left-hand column is real — it ranks your stock by what you actually use in a year,
              and that only needs totals. The right-hand one needs a pattern: about six separate
              selling days per item, over at least four weeks. Nothing here has reached that, so
              rather than guess, it says so. Value is enough to act on in the meantime.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Alert color="module" variant="soft">
          <AlertContent>
            <AlertTitle>Two questions, not one</AlertTitle>
            <AlertDescription>
              Where the money is (top value, mid value, long tail — by what you actually use in a
              year) and whether demand can be predicted (steady, uneven, erratic). The PAIR tells
              you what to do: a steady top-value line earns a tight reorder level and a monthly
              count; an erratic long-tail one earns buying when someone asks.
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {/* Ahead of every empty state: a failed request is not a finding about
          the catalogue, and all three messages below would read as one. */}
      {classifications.isError ? (
        <EmptyState
          icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
          title="Could not rank your stock"
          description="This is a problem reaching the server, not a finding about what you hold. Try again in a moment."
        />
      ) : classifications.isLoading ? (
        <PaneWaiting label="Ranking your stock…" />
      ) : rows.length === 0 ? (
        // Three different empties: a filter that matched nothing, a tenant whose
        // stock has never been ranked, and one whose stock genuinely has no usage
        // to rank. Only the middle one is fixed by pressing a button.
        filtered ? (
          <EmptyState
            icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
            title="No items match those filters"
            description="Widen the value or demand filter, or clear the search, to see the rest of your stock."
          />
        ) : measured ? (
          <EmptyState
            icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
            title="Nothing has been used yet"
            description="Ranking works from what you have actually consumed. Once items start selling or being built into something, they will appear here in order of what they are worth to you."
          />
        ) : (
          <EmptyState
            icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
            title="Nothing ranked yet"
            description="Ranking needs a pass over what you have used. It runs overnight, or press “Work it out now” above."
          />
        )
      ) : (
        <Card className="overflow-x-auto">
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Item</th>
                <th className="whitespace-nowrap">Worth</th>
                <th className="whitespace-nowrap">Demand</th>
                <th className="hidden text-right whitespace-nowrap @lg:table-cell">Used a year</th>
                <th className="hidden text-right whitespace-nowrap @xl:table-cell">Value a year</th>
                <th className="hidden text-right whitespace-nowrap @2xl:table-cell">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.variantId}:${row.warehouseId}`}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  onClick={(event) => {
                    ctx.open(
                      'inventory.planning.explain',
                      { variantId: row.variantId, warehouseId: row.warehouseId },
                      { target: targetFor(event) }
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    ctx.open('inventory.planning.explain', {
                      variantId: row.variantId,
                      warehouseId: row.warehouseId,
                    });
                  }}
                >
                  <td className="w-full max-w-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{row.title ?? 'Untitled product'}</span>
                      <span className="truncate text-sm">
                        <span className="font-mono">{row.sku ?? 'No code'}</span>
                        {/* Only when the list actually spans locations. The same
                            SKU stocked in two places is two rows here, and
                            without this they are indistinguishable. */}
                        {multiLocation && row.warehouseName ? (
                          <span> · {row.warehouseName}</span>
                        ) : null}
                      </span>
                      {/* The advice is a property of the WORTH × DEMAND pair, so
                          on a list sorted by value it repeats down long runs of
                          the same pair. Printing it once per run keeps the
                          instruction without the wall of identical sentences —
                          the badges on every row still carry the pair. */}
                      {row.advice !== rows[index - 1]?.advice ? (
                        <span className="truncate text-sm">{row.advice}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge color={abcTone(row.abcClass)} variant="soft" size="sm">
                      {abcLabel(row.abcClass)}
                    </Badge>
                    {row.abcOverride ? (
                      <span className="block text-sm">
                        you set this · measured {abcLabel(row.measuredAbcClass).toLowerCase()}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge color={xyzTone(row.xyzClass)} variant="soft" size="sm">
                      {xyzLabel(row.xyzClass)}
                    </Badge>
                  </td>
                  <td className="hidden text-right tabular-nums @lg:table-cell">
                    {row.annualUsageUnits}
                  </td>
                  <td className="hidden text-right tabular-nums @xl:table-cell">
                    {formatCents(row.annualUsageValueCents)}
                  </td>
                  <td className="hidden text-right tabular-nums @2xl:table-cell">
                    {row.valueSharePct < 0.01 && row.valueSharePct > 0
                      ? '<0.01%'
                      : `${row.valueSharePct.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
