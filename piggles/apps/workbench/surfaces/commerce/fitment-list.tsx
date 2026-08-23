'use client';

// The compatibility lists a business keeps — its fitment domains.
//
// This is the MANAGEMENT side of fitment: where an owner sets up the kinds of
// things their products fit (vehicles, phones, machines) and the tree of values
// inside each. The product-scoped pane (product-fitment.tsx) is the other side —
// it marks ONE product against these lists.
//
// A domain is a structured record with a shape and a node count, not a one-line
// thing, so this is a real table: name, what it narrows down through, and how
// many top-level entries it holds. Nothing is global — a business installs or
// builds every list itself, so an empty catalog is the norm on day one and the
// empty state leads with the ready-made library rather than a blank form.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, EmptyState, SearchInput, useToast } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faPlus, faPuzzlePiece, faSparkles } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { EmptyStateActions } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import { afterPaneChange } from '../../lib/defer';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { FitmentDictionaryPicker } from './fitment-dictionary-picker';
import { resolveFitmentIcon } from './fitment-icons';
import {
  dimensionSummary,
  rootCountLabel,
  useFitmentDomains,
  type FitmentDomain,
} from './fitment-data';
import { RowOpenHint } from '../../components/row-open-hint';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function FitmentListSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useFitmentDomains();
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const domains = useMemo(() => data ?? [], [data]);
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? domains.filter(
        (domain) =>
          domain.displayName.toLowerCase().includes(needle) ||
          domain.dimensions.some((dimension) => dimension.label.toLowerCase().includes(needle))
      )
    : domains;

  const open = (domain: FitmentDomain, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.fitment.domain.detail', { id: domain.id }, { target: targetFor(event) });
  };

  const create = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.fitment.domain.detail', { id: 'new' }, { target: targetFor(event) });
  };

  const onInstalled = (domainId: string, name: string) => {
    // Close the picker and land on the freshly-installed list so its tree is
    // right there to inspect and extend. The toast fires AFTER the pane change
    // settles, never in the same tick — see afterPaneChange.
    setPickerOpen(false);
    ctx.open('commerce.fitment.domain.detail', { id: domainId }, { target: 'tab' });
    afterPaneChange(() => {
      toast.add({ title: `${name} installed`, type: 'success' });
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Compatibility list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search compatibility lists"
              placeholder="Search lists…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        controls={
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 whitespace-nowrap"
            title="Start from a ready-made list"
            onClick={() => {
              setPickerOpen(true);
            }}
          >
            <Icon glyph={faSparkles} className="size-4" aria-hidden />
            <span>Starter library</span>
          </Button>
        }
        // Save is `primary`, never `controls`: `controls` relocates into the
        // overflow popover under 672px, and a commit action must be reachable
        // at every width. Enforced by scripts/check-toolbar-primary.mjs.
        primaryAction={{
          label: 'Add a list',
          icon: faPlus,
          onClick: create,
          title: 'Build a list from scratch — hold Shift to open alongside, Alt for a new window',
        }}
        views={{
          target: '/commerce/fitment',
          params: { q: search.trim() },
          onApply: (next) => {
            setSearch(next.q ?? '');
          },
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <PaneLoadError
            icon={<Icon glyph={faPuzzlePiece} className="size-6" aria-hidden />}
            title="Could not load your compatibility lists"
            description="This is a problem reaching the server. Your lists are unaffected — nothing has been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : matches.length === 0 && needle ? (
          // "Nothing matches" and "you have none" are different facts — telling
          // someone to set up their first list when they have twelve and mistyped
          // is the worse mistake.
          <EmptyState
            icon={<Icon glyph={faPuzzlePiece} className="size-6" aria-hidden />}
            title="No lists match that"
            description="Try part of the list's name or one of its levels — or clear the search to see them all."
          />
        ) : domains.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faPuzzlePiece} className="size-6" aria-hidden />}
            title="No compatibility lists yet"
            description="A compatibility list lets shoppers filter to just the products that fit what they own — a vehicle, a phone, a machine. Start from a ready-made list, or build your own."
            actions={
              <EmptyStateActions>
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    setPickerOpen(true);
                  }}
                >
                  <Icon glyph={faSparkles} className="size-4" aria-hidden />
                  Start from a ready-made list
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    create({ shiftKey: false, altKey: false });
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Build one from scratch
                </Button>
              </EmptyStateActions>
            }
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>List</th>
                <th className="hidden @xl:table-cell">What it narrows down</th>
                <th className="text-right">Entries</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((domain) => {
                const glyph = resolveFitmentIcon(domain.iconKey);
                return (
                  <tr
                    key={domain.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(domain, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(domain, event);
                    }}
                  >
                    <td>
                      <span className="flex items-center gap-2">
                        <Icon glyph={glyph} className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate font-medium">{domain.displayName}</span>
                      </span>
                      {/* On a narrow pane the "what it narrows down" column is
                          hidden, so the shape rides under the name instead — at
                          full ink, it is there to be read. */}
                      <span className="mt-0.5 block truncate text-sm @xl:hidden">
                        {dimensionSummary(domain)}
                      </span>
                    </td>
                    <td className="hidden max-w-80 truncate @xl:table-cell">
                      {dimensionSummary(domain)}
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {rootCountLabel(domain)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <RowOpenHint what="a list to manage it" />

      {pickerOpen ? (
        <FitmentDictionaryPicker
          onClose={() => {
            setPickerOpen(false);
          }}
          onInstalled={onInstalled}
        />
      ) : null}
    </div>
  );
}
