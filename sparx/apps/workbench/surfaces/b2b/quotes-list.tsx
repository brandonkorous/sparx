'use client';

// Quotes — what a business asked a job or a bulk order would cost.
//
// A quote lands here when a trade customer asks for a price. You open it to price
// the lines and move it along; they accept or decline. This list is the queue you
// scan: who asked, for how much, and where each one stands right now. Pricing and
// responding happen in the quote itself (the invoicing editor it opens into),
// because a quote IS a billing document under the hood.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Table } from '@wizeworks/silicaui-react';
import { FileText, Plus, X } from 'lucide-react';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  QUOTE_STATES,
  formatDate,
  formatMoney,
  isExpired,
  quoteAsker,
  quoteBusiness,
  quoteEmptyAdvice,
  quoteTone,
  useQuotes,
  type QuoteRow,
  type QuoteStateValue,
} from './quotes-data';
import { RowOpenHint } from '../../components/row-open-hint';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function QuotesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const accountId = typeof ctx.params.accountId === 'string' ? ctx.params.accountId : undefined;
  const accountName =
    typeof ctx.params.accountName === 'string' ? ctx.params.accountName : undefined;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuoteStateValue>('all');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const active = QUOTE_STATES.find((entry) => entry.value === filter) ?? QUOTE_STATES[0];
  const skip = (page - 1) * pageSize;
  const narrowed = filter !== 'all' || search.trim() !== '';

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuotes({
    accountId,
    q: search.trim(),
    state: active.state,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const open = (quote: QuoteRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('b2b.quote.detail', { id: quote.id }, { target: targetFor(event) });
  };

  // One action object, handed to both the toolbar button and the empty state,
  // so the two can never drift into calling the same errand different things.
  //
  // It opens the INVOICING editor, because a quote is a billing document on the
  // system `b2b-quotes` workflow and that editor is the screen that prices one.
  // `workflow` is what makes it open as a quote rather than an invoice.
  const priceUpAQuote = {
    label: 'Price up a quote',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open(
        'invoicing.invoice.edit',
        { id: 'new', workflow: B2B_QUOTE_WORKFLOW_SLUG },
        { target: targetFor(event) }
      );
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Quotes controls"
        // A search box and the three answers, the same way the two lists beside
        // this one in Trade already work. This pane had NEITHER — its toolbar
        // held one word, "Quotes", repeating the tab directly above it — so the
        // queue it exists to help her scan could only be read top to bottom.
        // The filter is a real capability front to back: `state` on
        // `GET /v1/b2b/quotes` asks the stage's TYPE, so it survives a tenant
        // renaming their own stages, which the older `stage`-by-name could not.
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search quotes"
              placeholder="Quote number, business or person…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        filters={[
          {
            label: 'Show',
            key: 'state',
            value: filter,
            onValueChange: (next) => {
              setFilter((next as QuoteStateValue | null) ?? 'all');
              resetWindow();
            },
            options: QUOTE_STATES,
          },
        ]}
        // `state` is a filter GROUP, so the bar saves and re-applies it itself.
        // Only the search text has to be handed over here.
        views={{
          target: '/b2b/quotes',
          params: { q: search.trim() },
          onApply: (next) => {
            setSearch(next.q ?? '');
            resetWindow();
          },
        }}
        primary={
          <Button
            color="module"
            size="sm"
            className="shrink-0"
            title="Price up a quote: hold Shift to open alongside, Alt for a new window"
            onClick={priceUpAQuote.onClick}
          >
            <Plus className="size-4" aria-hidden />
            {priceUpAQuote.label}
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

      {accountId && accountName ? (
        <div className="flex items-center gap-2">
          <Badge color="module" variant="soft">
            {accountName}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            onClick={() => {
              ctx.open('b2b.quotes.list', {}, { target: 'replace' });
            }}
          >
            <X className="size-4" aria-hidden />
            Show all quotes
          </Button>
        </div>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title="Could not load your quotes"
            description="This is a problem reaching the server. Your quotes are unaffected. Nothing has been lost."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading quotes…
          </p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            // Narrowed counts as filtered too. Without this a search that found
            // nothing dropped through to the first-run card, which explains what
            // a quote IS to someone who already has two of them on the screen
            // behind the box she just typed in.
            filtered={narrowed || Boolean(accountId)}
            noResults={{
              icon: <FileText className="size-6" aria-hidden />,
              title: narrowed ? 'No quotes match that' : 'No quotes for this business yet',
              // Name only what is actually on. The list beside this one told a
              // person who had typed nothing to "try a different word", which
              // sends her looking for a search box she never used.
              description: narrowed
                ? quoteEmptyAdvice(search.trim(), filter === 'all' ? null : active.label)
                : accountName
                  ? `${accountName} has not asked for a quote, and you have not priced one up for them. Show all quotes to see the rest.`
                  : 'Show all quotes to see the rest.',
              actions: (
                <Button color="module" size="sm" onClick={priceUpAQuote.onClick}>
                  {priceUpAQuote.label}
                </Button>
              ),
            }}
            firstRun={{
              icon: <FileText className="size-6" aria-hidden />,
              title: 'No quotes yet',
              // Both ways in, because both happen. A trade customer asks through
              // their account on your website, and you also price one up
              // yourself when a business rings and asks what a bulk order costs.
              // The old wording described only the first, so the screen told
              // them to wait for something and gave them nothing to press.
              description:
                'A quote is a price you send a business before they buy. They can ask for one from their account on your website, or you can price one up here when someone rings and asks what a bulk order would cost.',
              action: priceUpAQuote,
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Quote</th>
                {/* "Who asked", not "Business". Fourteen of the sixteen quotes
                    on this machine have no trade account on them, so the column
                    headed Business was printing a PERSON'S NAME on almost every
                    row — and on the two rows of Juniper Row's own list the same
                    woman appeared as the business on one and not at all on the
                    other. The header now covers what the column can hold. */}
                <th className="hidden @lg:table-cell">Who asked</th>
                <th className="hidden @2xl:table-cell">Valid until</th>
                <th className="hidden text-right @xl:table-cell">Total</th>
                <th className="text-right">Standing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((quote) => {
                const expired = isExpired(quote) && quote.stage.stageType === 'draft';
                const business = quoteBusiness(quote);
                const asker = quoteAsker(quote);
                return (
                  <tr
                    key={quote.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(quote, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(quote, event);
                    }}
                  >
                    <td className="font-mono text-sm">
                      {quote.number ?? 'Draft'}
                      {/* On a phone this table keeps a number and a badge and
                          drops everything else, so the whole list read
                          "Q-000016 · Draft" — no name on it and no price, on the
                          one screen whose entire job is what a job would cost.
                          Who asked comes back below @lg, the money below @xl. */}
                      <span className="block font-sans @xl:hidden">
                        <span className="@lg:hidden">{business ?? asker ?? 'Nobody on it'} · </span>
                        {formatMoney(quote.total, quote.currency)}
                      </span>
                    </td>
                    <td className="hidden max-w-48 @lg:table-cell">
                      {/* The business on top and who rang under it, the way the
                          wholesale orders list next door already does it. Both
                          facts are on the row either way; only one was drawn. */}
                      <span className="block truncate">{business ?? asker ?? 'Nobody on it'}</span>
                      {business && asker ? (
                        <span className="block truncate text-sm">{asker}</span>
                      ) : null}
                    </td>
                    <td className="hidden @2xl:table-cell">{formatDate(quote.validUntil)}</td>
                    <td className="hidden text-right font-medium tabular-nums @xl:table-cell">
                      {formatMoney(quote.total, quote.currency)}
                    </td>
                    <td className="text-right">
                      {expired ? (
                        // NOT the word "Expired". One of this workflow's own
                        // stages is called Expired, and it renders in this same
                        // column in a different color — so the same word meant
                        // two things and disagreed with itself about how much it
                        // mattered. This one is the date on the quote going by
                        // while it still sits unanswered.
                        <Badge color="warning" variant="soft" size="sm">
                          Date has passed
                        </Badge>
                      ) : (
                        <Badge color={quoteTone(quote.stage.stageType)} variant="soft" size="sm">
                          {quote.stage.name}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
