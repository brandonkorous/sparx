'use client';

// Markup rules: how a cost becomes a price (sparx persona issue 086). A row per
// rule saying what it does, badged by what it prices: quote lines, the catalog.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faCalculator, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useMarkupRuleList } from './markup-rules-data';
import { describeRule, pricesCatalog, pricesQuotes, type MarkupRuleRow } from './markup-rule-words';

/** Registry module, so the empty state draws this app's own picture. */
const MODULE = 'commerce';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function MarkupRulesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const query = useMarkupRuleList();
  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (rule) => term === '' || rule.name.toLowerCase().includes(term)
  );
  // ONE object for the toolbar's button and the empty state's invitation.
  const createFirst = {
    label: 'Add a markup rule',
    onClick: (event: OpenEvent) => {
      ctx.open('commerce.markup-rule.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <RulesToolbar search={search} onSearch={setSearch} createFirst={createFirst} query={query} />
      <Card className="min-h-0 flex-1 overflow-y-auto p-2">
        <ListBody
          query={query}
          rows={rows}
          filtered={term !== ''}
          createFirst={createFirst}
          onOpen={(id, event) => {
            ctx.open('commerce.markup-rule.detail', { id }, { target: targetFor(event) });
          }}
        />
      </Card>
      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

interface CreateAction {
  label: string;
  onClick: (event: OpenEvent) => void;
}

function RulesToolbar({
  search,
  onSearch,
  createFirst,
  query,
}: {
  search: string;
  onSearch: (next: string) => void;
  createFirst: CreateAction;
  query: ReturnType<typeof useMarkupRuleList>;
}) {
  return (
    <PaneToolbar
      label="Markup rules controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search markup rules"
            placeholder="Search markup rules…"
            value={search}
            onValueChange={onSearch}
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
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          {createFirst.label}
        </Button>
      }
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

const ICON = <Icon glyph={faCalculator} className="size-6" aria-hidden />;

/** None that match, or none at all: two different messages (see ListEmptyState). */
function NoRules({ filtered, createFirst }: { filtered: boolean; createFirst: CreateAction }) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={filtered}
      noResults={{
        icon: ICON,
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
  );
}

function ListBody({
  query,
  rows,
  filtered,
  createFirst,
  onOpen,
}: {
  query: ReturnType<typeof useMarkupRuleList>;
  rows: MarkupRuleRow[];
  filtered: boolean;
  createFirst: CreateAction;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  if (query.isError) {
    return (
      <EmptyState
        icon={ICON}
        title="Could not load your markup rules"
        description="This is a problem reaching the server. Your rules are unaffected. Nothing has been lost."
      />
    );
  }
  if (query.isPending) return <PaneWaiting />;
  if (rows.length === 0) return <NoRules filtered={filtered} createFirst={createFirst} />;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((rule) => (
        <RuleRow key={rule.id} rule={rule} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function RuleRow({
  rule,
  onOpen,
}: {
  rule: MarkupRuleRow;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const count = rule.boundVariantCount;
  const products =
    count === 0 ? null : count === 1 ? 'Prices 1 product' : `Prices ${String(count)} products`;
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
        {/* What it prices, in the hue of the app that uses it. */}
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
