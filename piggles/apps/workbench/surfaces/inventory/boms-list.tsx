'use client';

// RECIPES — what your made things are made of.
//
// Called "recipes" and not "bills of materials" because that is what they are,
// and because the person setting one up in a workshop or a kitchen has never
// used the other phrase. The industry term is in the keywords so the palette
// still finds it.
//
// A recipe moves no stock. It says what a finished thing is made of; a RUN built
// to it is what actually takes parts off a shelf. Keeping them apart is what
// lets a recipe be edited and versioned without touching anything already made,
// and it is why this list and the runs list are two surfaces rather than one.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { Badge, Button, Card, NativeSelect, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faPlus, faPotFood } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';

/** Registry module for this pane, so the brand draws Stock's own picture rather
 *  than the generic one. */
const MODULE = 'inventory';
import { formatCents, plural } from './data';
import { bomState, useBoms, type Bom } from './assembly-data';

const PAGE = 50;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function BomsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [skip, setSkip] = useState(0);

  const boms = useBoms({ q, status, take: PAGE, skip });
  const rows = boms.data?.items ?? [];
  const total = boms.data?.total ?? 0;

  const open = (bom: Bom, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.boms.detail', { id: bom.id }, { target: targetFor(event) });
  };

  const body = () => {
    if (boms.isError) {
      return (
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faPotFood} className="size-6" aria-hidden />}
          title="Could not load your recipes"
          description="This is a problem reaching the server. Your recipes are unaffected."
          onRetry={() => {
            void boms.refetch();
          }}
        />
      );
    }
    if (boms.isPending) {
      return <PaneWaiting module={MODULE} />;
    }
    if (rows.length === 0) {
      return (
        <ListEmptyState
          module={MODULE}
          filtered={Boolean(q || status)}
          noResults={{
            icon: <Icon glyph={faPotFood} className="size-6" aria-hidden />,
            title: 'Nothing matches that',
            description: 'Try a different search, or clear the filters.',
          }}
          firstRun={{
            title: 'No recipes yet',
            description:
              'A recipe says what a finished thing is made of — the parts, how many of each, and how much gets wasted making it. Once you have one, you can see how many you could make right now and record it when you do.',
            actions: (
              <Button
                color="module"
                onClick={() => {
                  ctx.open('inventory.boms.detail', { id: 'new' }, { target: 'tab' });
                }}
              >
                <Icon glyph={faPlus} className="size-4" aria-hidden />
                Write a recipe
              </Button>
            ),
          }}
        />
      );
    }

    return (
      <Table hover>
        <thead>
          <tr>
            <th>Makes</th>
            <th className="hidden @lg:table-cell">Recipe</th>
            <th className="text-right whitespace-nowrap">Per run</th>
            <th className="hidden text-right whitespace-nowrap @md:table-cell">Parts</th>
            <th className="hidden text-right whitespace-nowrap @xl:table-cell">Costs about</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((bom) => {
            const state = bomState(bom.status);
            return (
              <tr
                key={bom.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                onClick={(event) => {
                  open(bom, event);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  open(bom, event);
                }}
              >
                <td className="w-full max-w-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {bom.outputTitle ?? 'Untitled product'}
                    </span>
                    <span className="truncate font-mono text-sm">{bom.outputSku ?? 'No code'}</span>
                  </span>
                </td>
                <td className="hidden max-w-48 @lg:table-cell">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{bom.name}</span>
                    {/* Version matters: it is how a recall gets scoped to the
                        batches built to a particular recipe. */}
                    <span className="truncate text-sm">Version {bom.version}</span>
                  </span>
                </td>
                <td className="text-right tabular-nums">{bom.outputQuantity}</td>
                <td className="hidden text-right tabular-nums @md:table-cell">
                  {bom.componentCount}
                </td>
                <td className="hidden text-right tabular-nums @xl:table-cell">
                  {formatCents(bom.laborCostCents)}
                </td>
                <td className="text-right">
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Recipe list controls"
        search={
          <SearchInput
            value={q}
            placeholder="Search recipes"
            onValueChange={(value) => {
              setQ(value);
              setSkip(0);
            }}
          />
        }
        primaryAction={{
          label: 'Write a recipe',
          icon: faPlus,
          onClick: (event) => {
            ctx.open(
              'inventory.boms.detail',
              { id: 'new' },
              { target: event.shiftKey ? 'beside' : 'tab' }
            );
          },
        }}
        controls={
          <NativeSelect
            size="sm"
            className="max-w-36 shrink"
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setSkip(0);
            }}
          >
            <option value="">Any status</option>
            <option value="active">In use</option>
            <option value="draft">Draft</option>
            <option value="archived">Retired</option>
          </NativeSelect>
        }
        views={{
          target: '/inventory/boms',
          params: { q, status },
          onApply: (next) => {
            setQ(next.q ?? '');
            setStatus(next.status ?? '');
            setSkip(0);
          },
        }}
        refresh={
          <RefreshButton
            isFetching={boms.isFetching}
            updatedAt={boms.dataUpdatedAt}
            onRefresh={() => {
              void boms.refetch();
            }}
          />
        }
      />

      {/* ONE card around the whole conditional — loading, failure, empty and the
          table all fill the same content region, so the pane never jumps. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">{body()}</Card>

      {total > PAGE ? (
        <div className="border-base-300 flex items-center justify-between gap-2 border-t px-3 py-2">
          <Text className="text-sm">
            {plural(total, 'recipe', 'recipes')} · showing {skip + 1}–{Math.min(skip + PAGE, total)}
          </Text>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              disabled={skip === 0}
              onClick={() => {
                setSkip(Math.max(0, skip - PAGE));
              }}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              disabled={skip + PAGE >= total}
              onClick={() => {
                setSkip(skip + PAGE);
              }}
            >
              Next
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
