'use client';

// Invoices — the receivables surface.
//
// Two things shape this beyond a normal list.
//
// FIRST: opening a row does not navigate this pane away. The list stays exactly
// where it is and the invoice opens as its own pane, because in a workbench
// "open" and "go to" are different things. Someone working a receivables list
// wants the list to survive opening the fifth invoice on it.
//
// SECOND: it lives in a pane of unknown width — 320px beside an editor, or the
// full window. So columns disclose progressively with @container, never a
// viewport query: pane width and screen width are unrelated here, and a
// viewport breakpoint would leave a narrow pane on a wide monitor showing six
// columns in 300px.

import { useState } from 'react';
import { useQuery } from '@sparx/query';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    Filter,
    FilterItem,
    SearchInput,
    Table,
    ToolbarSeparator,
} from '@wizeworks/silicaui-react';
import { ArrowDown, ArrowUp, FileText, Plus } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
    describeDue,
    formatMoney,
    normalizeDocument,
    statusTone,
    type BillingDocument,
} from './types';

/**
 * Sortable columns — and this list is EXACTLY the server's whitelist.
 *
 * Sorting had to move to the server the moment this list could page: a
 * client-side sort of the loaded window silently sorts one page and presents it
 * as the answer, so asking for your largest balance hands you the largest
 * balance on page 3.
 *
 * 'customer' sorts on the LIVE customer/account relation rather than on the
 * frozen bill-to name the column displays, because frozen bill-to is JSON and
 * cannot be ordered by. The two agree except where a customer has been renamed
 * since a document was issued — at which point the document still displays the
 * name it was issued under, which is the behaviour that matters.
 */
type SortKey = 'number' | 'customer' | 'status' | 'dueAt' | 'total' | 'balance';
type SortDir = 'asc' | 'desc';

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'overdue', label: 'Late' },
    { value: 'paid', label: 'Paid' },
] as const;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
    if (event.altKey) return 'window';
    if (event.shiftKey) return 'beside';
    return 'tab';
}

export function InvoiceListSurface({ ctx }: { ctx: SurfaceContext }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    // Due soonest first — the question a receivables list exists to answer, and
    // the reason the endpoint needed a real `order` param rather than the
    // platform's usual hardcoded 'desc'.
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'dueAt', dir: 'asc' });

    const [pageSize, setPageSize] = useState<PageSize>(50);
    const [page, setPage] = useState(1);
    // How many rows the current window has grown to. "Load more" raises this;
    // anything that changes WHICH rows match resets it.
    const [take, setTake] = useState<number>(50);

    const activeStatus = status;
    const skip = (page - 1) * pageSize;

    /**
     * One query for the whole visible window, rather than accumulating pages in
     * component state.
     *
     * "Load more" widens `take` and refetches, so what is on screen is always
     * exactly one server answer. Accumulating would mean merging pages, deduping
     * them, and deciding what happens to already-loaded rows when the sort
     * changes underneath — three ways to show a list that never existed in the
     * database. Refetching 100 rows to add 50 is a few KB of JSON against a
     * correctness guarantee, which is a trade worth making every time.
     */
    const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useQuery({
        queryKey: [
            'invoicing',
            'documents',
            { q: search, status: activeStatus, sort: sort.key, dir: sort.dir, take, skip },
        ],
        queryFn: () =>
            api
                .list<BillingDocument>('/v1/invoicing/documents', {
                    ...(search ? { q: search } : {}),
                    ...(activeStatus === 'all' ? {} : { status: activeStatus }),
                    sort_by: sort.key,
                    order: sort.dir,
                    take,
                    skip,
                })
                .then((result) => ({
                    items: result.items.map(normalizeDocument),
                    total: result.total,
                })),
        // Keeps the previous window on screen while the next one loads, so paging
        // and re-sorting don't blink the table out to an empty state and back.
        placeholderData: (previous) => previous,
    });

    const rows = data?.items ?? [];
    const total = data?.total;

    /** Anything that changes which rows match has to return to the first window —
     *  staying on page 5 of a result set that now has two pages shows nothing. */
    const resetWindow = () => {
        setPage(1);
        setTake(pageSize);
    };

    const toggleSort = (key: SortKey) => {
        setSort((current) =>
            current.key === key
                ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                : // Text ascends, money descends. Two exceptions, both because the
                // useful direction is "most urgent first": dueAt ascending is
                // soonest-due, and status ascending is overdue-then-unpaid (the
                // column sorts on a generated urgency rank, not the status text).
                { key, dir: key === 'total' || key === 'balance' ? 'desc' : 'asc' }
        );
        resetWindow();
    };

    const header = (key: SortKey, label: string, extra = '') => (
        <th
            className={extra}
            aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <button
                type="button"
                className="link link-hover inline-flex items-center gap-1"
                onClick={() => {
                    toggleSort(key);
                }}
            >
                {label}
                {sort.key === key ? (
                    sort.dir === 'asc' ? (
                        <ArrowUp className="size-3" aria-hidden />
                    ) : (
                        <ArrowDown className="size-3" aria-hidden />
                    )
                ) : null}
            </button>
        </th>
    );

    return (
        // Surfaces, not one slab. The pane is base-200; the toolbar and the table
        // are base-100 cards lifted onto it, separated by the gap between them
        // rather than by hairline rules. Padding lives on the pane so the cards
        // themselves stay full-bleed — a table wants its rows edge to edge.
        //
        // The gutter shrinks to nothing under 30rem: in a pane docked beside an
        // editor, 12px a side is real column width, and at that size the surfaces
        // already read apart by color alone.
        <div className={PANE_SHELL}>
            {/* silicaui's Toolbar, not a hand-rolled flex row: it brings the bar's
          height, gap, alignment and — the part you can't see — roving arrow-key
          focus, so the whole bar is one tab stop that you then arrow across.
          The previous row was three controls of three different heights with a
          `flex-1` spacer shoving the button at the far wall.

          The width has to be set on a WRAPPER. SearchInput forwards className to
          its inner <input>, so sizing classes aimed at the control never reach
          the .input-group element that actually lays out — which is why search
          swallowed the entire row (measured: 1208px) and pushed everything else
          onto a second line. */}
            <PaneToolbar label="Invoice list controls" wrap>
                <div className="max-w-xs min-w-0 flex-1">
                    <SearchInput
                        size="sm"
                        aria-label="Search invoices"
                        placeholder="Search invoices…"
                        value={search}
                        onValueChange={(next) => {
                            setSearch(next);
                            resetWindow();
                        }}
                    />
                </div>

                <ToolbarSeparator className="hidden @xl:block" />

                {/* Filter, not ToggleGroup. Both would work the control, but this IS a
            faceted filter — single-select chips with radio semantics — and the
            component says so, which buys the module accent on the chosen chip
            and drops the `string[]` juggling a multi-select control forced on a
            question that only ever has one answer.
            `showReset={false}` because "All" already IS the reset; a × beside it
            would be two controls for one idea. */}
                <Filter
                    color="module"
                    value={status}
                    onValueChange={(next) => {
                        setStatus(next ?? 'all');
                        resetWindow();
                    }}
                    showReset={false}
                    aria-label="Filter by status"
                >
                    {STATUS_FILTERS.map((filter) => (
                        <FilterItem key={filter.value} value={filter.value}>
                            {filter.label}
                        </FilterItem>
                    ))}
                </Filter>

                {/* ml-auto, not a flex-1 spacer div — the same result without a phantom
            element in the middle of the bar's focus order. */}
                <Button
                    color="module"
                    size="sm"
                    className="ml-auto"
                    title="New invoice — hold Shift to open alongside, Alt for a new window"
                    onClick={(event) => {
                        ctx.open('invoicing.invoice.edit', { id: 'new' }, { target: targetFor(event) });
                    }}
                >
                    <Plus className="size-4" aria-hidden />
                    <span className="hidden @lg:inline">New invoice</span>
                </Button>

                {/* ALWAYS the last child of a list toolbar — see RefreshButton. Inside
            the Toolbar rather than beside it, so it joins the roving arrow-key
            focus instead of becoming a stray extra tab stop.

            If the receivables band (./ar-summary.tsx) is ever mounted here — it
            is written to ride alongside this list, but nothing imports it today
            — this must also invalidate ['invoicing','aging']. Refreshing the
            rows while "Outstanding" kept an older figure would be the pane
            disagreeing with itself. */}
                <RefreshButton
                    isFetching={isFetching}
                    updatedAt={data ? dataUpdatedAt : undefined}
                    onRefresh={() => {
                        void refetch();
                    }}
                />
            </PaneToolbar>

            <Card className="min-h-0 flex-1 overflow-y-auto">
                {error ? (
                    <EmptyState
                        title="Could not load invoices"
                        description="Something went wrong reaching the server. It may be temporary — try again in a moment."
                    />
                ) : isLoading ? (
                    <p className="p-4 text-sm" role="status">
                        Loading invoices…
                    </p>
                ) : rows.length === 0 ? (
                    <ListEmptyState
                        filtered={Boolean(search) || activeStatus !== 'all'}
                        noResults={{
                            icon: <FileText className="size-6" aria-hidden />,
                            title: 'Nothing matches those filters',
                            description: 'Try a different word, or switch back to All.',
                        }}
                        firstRun={{
                            title: 'No invoices yet',
                            description: 'When you create your first invoice it will show up here.',
                        }}
                    />
                ) : (
                    <Table size="sm" hover>
                        <thead>
                            <tr>
                                {header('number', 'Number')}
                                {header('customer', 'Customer', 'hidden @lg:table-cell')}
                                {header('dueAt', 'Due', 'hidden @2xl:table-cell')}
                                {header('status', 'Status')}
                                {header('total', 'Total', 'hidden @3xl:table-cell text-right')}
                                {header('balance', 'Balance', 'text-right')}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((doc) => {
                                const due = describeDue(doc.dueAt, doc.overdueDays);
                                return (
                                    <tr
                                        key={doc.id}
                                        className="cursor-pointer"
                                        tabIndex={0}
                                        role="button"
                                        onClick={(event) => {
                                            ctx.open(
                                                'invoicing.invoice.edit',
                                                { id: doc.id },
                                                { target: targetFor(event) }
                                            );
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter' && event.key !== ' ') return;
                                            event.preventDefault();
                                            ctx.open(
                                                'invoicing.invoice.edit',
                                                { id: doc.id },
                                                { target: targetFor(event) }
                                            );
                                        }}
                                    >
                                        <td className="font-mono text-sm">{doc.number ?? 'Draft'}</td>
                                        <td className="hidden max-w-48 truncate @lg:table-cell">
                                            {/* Server-resolved: the frozen bill-to where the document
                          has one, otherwise the live customer or account. */}
                                            {doc.billedToName ?? doc.billTo?.name ?? '—'}
                                        </td>
                                        <td
                                            className={[
                                                'hidden text-sm @2xl:table-cell',
                                                due.tone === 'danger'
                                                    ? 'text-danger font-medium'
                                                    : due.tone === 'warning'
                                                        ? 'text-warning'
                                                        : '',
                                            ].join(' ')}
                                            title={due.title}
                                        >
                                            {due.label}
                                        </td>
                                        <td>
                                            <Badge color={statusTone(doc.status)} variant="soft" size="sm">
                                                {doc.status}
                                            </Badge>
                                        </td>
                                        <td className="hidden text-right tabular-nums @3xl:table-cell">
                                            {formatMoney(doc.total, doc.currency)}
                                        </td>
                                        <td
                                            className={[
                                                'text-right tabular-nums',
                                                doc.balance > 0 ? 'font-medium' : '',
                                            ].join(' ')}
                                        >
                                            {formatMoney(doc.balance, doc.currency)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                )}
            </Card>

            {/* Sits on the pane, not in a card — it describes the table rather than
          being part of it, which is exactly what the recessed surface says. */}
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
                        // A jump REPLACES the window, so any growth from "load more"
                        // belongs to the window you just left, not the one you land on.
                        setTake(pageSize);
                    }}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                        setTake(size);
                    }}
                />
                {/* The open gestures, and only where there is a pointer to do them
            with — on the stack these three modifiers do not exist. */}
                <p className="hidden px-1 pb-1 text-sm @xl:block">
                    Click to open · Shift-click alongside · Alt-click new window
                </p>
            </div>
        </div>
    );
}
