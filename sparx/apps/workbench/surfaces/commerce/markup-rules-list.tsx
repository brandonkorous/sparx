'use client';

// Markup rules: how a cost becomes a price (sparx persona issue 086).
//
// The /b2b page says "set line-item pricing (markup rules help)", and the quote
// line editor listed rules nobody could make: until this screen, a rule only
// existed if someone wrote one through the API. A rule is a one-line idea ("add
// 40% to the cost"), so it is a row per rule saying exactly that, with what it
// prices (quote lines, the catalog, or both) as the badge that tells rows apart.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Percent, Plus } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useMarkupRuleList } from './markup-rules-data';
import { describeRule, pricesCatalog, pricesQuotes, type MarkupRuleRow } from './markup-rule-words';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function MarkupRulesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useMarkupRuleList();

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((rule) => term === '' || rule.name.toLowerCase().includes(term));

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.markup-rule.detail', { id }, { target: targetFor(event) });
  };
  // ONE object for the toolbar's button and the empty state's invitation, so
  // the two can never say different things.
  const createFirst = {
    label: 'Add a markup rule',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('commerce.markup-rule.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Markup rules controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search markup rules"
              placeholder="Search markup rules…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            title="Add a markup rule: hold Shift to open alongside, Alt for a new window"
            onClick={createFirst.onClick}
          >
            <Plus className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
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

      <Card className="min-h-0 flex-1 overflow-y-auto p-2">
        {isError ? (
          <EmptyState
            icon={<Percent className="size-6" aria-hidden />}
            title="Could not load your markup rules"
            description="This is a problem reaching the server. Your rules are unaffected. Nothing has been lost."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            filtered={term !== ''}
            noResults={{
              icon: <Percent className="size-6" aria-hidden />,
              title: 'No rules match that',
              description: 'Try a different word, or clear the search to see every rule.',
            }}
            firstRun={{
              title: 'No markup rules yet',
              description:
                'A markup rule turns what something cost you into the price you charge, like "add 40% to the cost". Pick it on a quote line and the price works itself out, with your margin beside it.',
              action: createFirst,
            }}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onOpen={open} />
            ))}
          </ul>
        )}
      </Card>

      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

function RuleRow({
  rule,
  onOpen,
}: {
  rule: MarkupRuleRow;
  onOpen: (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const products =
    rule.boundVariantCount === 0
      ? null
      : rule.boundVariantCount === 1
        ? 'Prices 1 product'
        : `Prices ${String(rule.boundVariantCount)} products`;

  return (
    <li>
      <button
        type="button"
        className="hover:bg-base-200 flex w-full items-center gap-3 rounded p-3 text-left"
        onClick={(event) => {
          onOpen(rule.id, event);
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{rule.name}</span>
          <Text as="span" className="block truncate text-sm">
            {describeRule(rule)}
          </Text>
        </span>
        {products ? (
          <Text as="span" className="hidden shrink-0 text-sm @md:inline">
            {products}
          </Text>
        ) : null}
        {/* What it prices, in the hue of the app that uses it: quotes and
            invoices are Invoicing's, the catalog is Commerce's. */}
        {pricesQuotes(rule.appliesTo) ? (
          <Badge color="module-invoicing" variant="soft" size="sm" className="shrink-0">
            Quotes
          </Badge>
        ) : null}
        {pricesCatalog(rule.appliesTo) ? (
          <Badge color="module-commerce" variant="soft" size="sm" className="shrink-0">
            Catalog
          </Badge>
        ) : null}
        {rule.isActive ? null : (
          <Badge color="warning" variant="soft" size="sm" className="shrink-0">
            Turned off
          </Badge>
        )}
      </button>
    </li>
  );
}
