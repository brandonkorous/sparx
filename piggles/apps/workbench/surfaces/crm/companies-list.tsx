'use client';

// The companies list — the organisations this business works with (docs/144 §11).
//
// THE COLUMNS DEPEND ON WHETHER THIS BUSINESS SELLS ON ACCOUNT. A company is a
// CRM record first: for a dental practice or a design studio it is simply the
// firm their contacts work for, and the questions are how many people we know
// there, which email addresses belong to them, and whether the relationship is
// live. Credit limit, discount and payment terms are answers to a question only
// a trade supplier asks — shown to everyone else they are three columns of
// $0.00 and "No agreed terms", which reads as a business with no credit rather
// than a column that does not apply. So the trade columns arrive with the `b2b`
// module and leave with it, exactly as the detail pane's trade panel does.
//
// Either way this earns a table rather than cards: every column is a value an
// owner scans down, and status leads on the right because "who is on hold" is
// what the list gets opened to answer.
//
// THE CREDIT COLUMN SAYS WHAT IS OWED AND WHAT IS STILL ALLOWED. It printed
// the limit alone, so the 11 of 29 companies sitting at the column's
// `DEFAULT 0` read `$0.00`, which looks like a rounding error and is in fact
// a closed door: the checkout refuses every order on terms against a zero. The
// balance beside it was already being fetched and drawn nowhere, which is how a
// company could owe $1,193 under a cell reading `$0.00`. `creditStanding` in
// lib/credit-standing.ts settles which of the three things is true; the trade
// app's list answers the same question about the same record the same way.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faBuilding, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useModuleStates } from '../../lib/api/shell-data';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import { SavedViewsMenu, viewFilterValue, viewFilters } from './saved-views-menu';
import type { SavedView } from './workspace-data';
import {
  ACCOUNT_STATUSES,
  accountStatusMeta,
  formatMoney,
  paymentTermsLabel,
  useAccounts,
  type Company,
  type CompanyStatus,
} from './companies-data';
import { RowOpenHint } from '../../components/row-open-hint';
import { creditStanding } from '../../lib/credit-standing';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * What this company owes, and whether a ceiling was ever recorded.
 *
 * This column used to print the limit alone, so every company nobody had given
 * one read `$0.00`, a database default wearing the face of a figure. It also
 * threw away `creditUsed`, which the list has already fetched and which is the
 * number an owner opens this screen to see. The trade app's list answers the
 * same question about the same record, so both now say it the same way.
 *
 * A zero limit is a closed door, not a blank: the checkout refuses every order
 * placed on terms against one. So both states below a real ceiling say so,
 * rather than reporting an absence.
 *
 * Two parts rather than one sentence, because this column is 107px wide in a
 * docked pane at 360px, where a whole clause wraps to four ragged lines. Split,
 * the figure keeps its own line and the qualifier sits under it, which is the
 * shape the trade list already uses for the company cell.
 */
function creditCell(row: Company): { amount: string; note: string | null } {
  switch (creditStanding(row.creditLimit, row.creditUsed)) {
    case 'limit':
      return { amount: formatMoney(row.creditUsed), note: `of ${formatMoney(row.creditLimit)}` };
    case 'owing':
      return { amount: formatMoney(row.creditUsed), note: 'no more on terms' };
    default:
      return { amount: 'None on terms', note: null };
  }
}

export function CompaniesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | CompanyStatus>('all');
  const [viewId, setViewId] = useState<string | null>(null);

  const currentFilters = viewFilters([
    search.trim() !== '' && { field: 'company.search', operator: 'contains', value: search.trim() },
    status !== 'all' && { field: 'company.status', operator: 'eq', value: status },
  ]);

  const applyView = (view: SavedView | null): void => {
    setViewId(view?.id ?? null);
    setSearch(viewFilterValue(view, 'company.search'));
    const nextStatus = viewFilterValue(view, 'company.status');
    setStatus(nextStatus === '' ? 'all' : (nextStatus as CompanyStatus));
  };

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAccounts({
    q: search,
    status: status === 'all' ? undefined : status,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || status !== 'all';

  const modules = useModuleStates();
  const tradeEnabled = (modules.data ?? []).some((m) => m.slug === 'b2b' && m.enabled);

  const statusItems = useMemo(() => {
    const items: Record<string, string> = { all: 'All companies' };
    for (const s of ACCOUNT_STATUSES) items[s] = accountStatusMeta(s).label;
    return items;
  }, []);

  const open = (account: Company, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.account.detail', { id: account.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Companies controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              color="module"
              size="sm"
              aria-label="Search companies"
              placeholder="Search by company…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            title="Add a company: hold Shift to open alongside, Alt for a new window"
            onClick={(event) => {
              ctx.open('crm.account.detail', { id: 'new' }, { target: targetFor(event) });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add a company
          </Button>
        }
        controls={
          <>
            <div className="w-40 shrink-0">
              <Select
                color="module"
                size="sm"
                aria-label="Show which companies"
                value={status}
                items={statusItems}
                onValueChange={(next) => {
                  setStatus(next as 'all' | CompanyStatus);
                }}
              />
            </div>
            <SavedViewsMenu
              objectKey="company"
              current={currentFilters}
              baseline={viewFilters([])}
              nameHint="On hold"
              selectedId={viewId}
              onApply={applyView}
            />
          </>
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

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <PaneLoadError
            icon={<Icon glyph={faBuilding} className="size-6" aria-hidden />}
            title="Could not load your companies"
            description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={filtered}
            noResults={{
              icon: <Icon glyph={faBuilding} className="size-6" aria-hidden />,
              title: 'No companies match those filters',
              description: 'Try a different word, or clear the filters to see them all.',
            }}
            firstRun={{
              title: 'No companies yet',
              description: tradeEnabled
                ? 'The businesses you work with live here, each one holding its own credit limit, discount and payment terms, and the people you deal with there.'
                : 'The businesses your contacts work for live here. Add one and you can see everyone you know there in a single place, and let new contacts from their email domain be recognized automatically.',
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Company</th>
                <th className="text-right">People</th>
                {tradeEnabled ? (
                  <>
                    <th className="text-right">Credit used</th>
                    <th className="hidden text-right @md:table-cell">Discount</th>
                    <th className="hidden @xl:table-cell">Terms</th>
                  </>
                ) : (
                  <th className="hidden @md:table-cell">Email domains</th>
                )}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = accountStatusMeta(row.status);
                const discount = Number(row.discountPercent);
                const credit = creditCell(row);
                // A zero is worth saying out loud — "nobody here yet" is a
                // prompt to add somebody, and an em-dash would read as unknown.
                const people = row._count?.customers ?? 0;
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(row, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(row, event);
                    }}
                  >
                    <td className="font-medium">{row.companyName}</td>
                    <td className="text-right tabular-nums">{people}</td>
                    {tradeEnabled ? (
                      <>
                        {/* `tabular-nums` keeps the figures in a column; the
                            monospace that used to be here turned "no more on terms"
                            into something that reads like a terminal. */}
                        <td className="text-right text-sm tabular-nums">
                          <span className="block">{credit.amount}</span>
                          {credit.note === null ? null : (
                            <span className="block">{credit.note}</span>
                          )}
                        </td>
                        <td className="hidden text-right font-mono text-sm tabular-nums @md:table-cell">
                          {discount > 0 ? `${String(discount)}%` : '—'}
                        </td>
                        <td className="hidden text-sm @xl:table-cell">
                          {paymentTermsLabel(row.paymentTerms)}
                        </td>
                      </>
                    ) : (
                      <td className="hidden text-sm @md:table-cell">
                        {row.domains.length === 0 ? (
                          '—'
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {row.domains.map((domain) => (
                              <Badge key={domain} color="module" variant="soft" size="sm">
                                {domain}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      <Badge color={meta.tone} variant="soft" size="sm">
                        {meta.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="flex shrink-0 items-center justify-between px-1">
        {rows.length > 0 ? <RowOpenHint /> : null}
        {typeof total === 'number' && !isPending ? (
          <p className="text-xs">
            {filtered
              ? `${rows.length.toLocaleString()} shown`
              : `${total.toLocaleString()} in total`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
