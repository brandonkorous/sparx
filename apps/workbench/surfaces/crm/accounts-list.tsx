'use client';

// The wholesale accounts list — the businesses that buy on agreed terms.
//
// An account is a multi-attribute record (its status, what it may owe, its
// discount, its terms), so it earns a table: each column answers a question an
// owner scans for. Status leads on the right because "who is on credit hold" is
// the thing this list gets opened to answer.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Table,
} from '@wizeworks/silicaui-react';
import { Building2, Plus } from 'lucide-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import {
  ACCOUNT_STATUSES,
  accountStatusMeta,
  formatMoney,
  paymentTermsLabel,
  useAccounts,
  type B2BAccount,
  type B2BAccountStatus,
} from './accounts-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function WholesaleAccountsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | B2BAccountStatus>('all');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAccounts({
    q: search,
    status: status === 'all' ? undefined : status,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || status !== 'all';

  const statusItems = useMemo(() => {
    const items: Record<string, string> = { all: 'All accounts' };
    for (const s of ACCOUNT_STATUSES) items[s] = accountStatusMeta(s).label;
    return items;
  }, []);

  const open = (account: B2BAccount, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.account.detail', { id: account.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Wholesale account list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search wholesale accounts"
            placeholder="Search by company…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <div className="hidden w-40 shrink-0 @lg:block">
          <Select
            size="sm"
            aria-label="Show which accounts"
            value={status}
            items={statusItems}
            onValueChange={(next) => {
              setStatus(next as 'all' | B2BAccountStatus);
            }}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          title="Add an account — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('crm.account.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add an account
        </Button>
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<Building2 className="size-6" aria-hidden />}
            title="Could not load your accounts"
            description="Something went wrong reaching the server. It may be a temporary problem — try again in a moment."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            filtered={filtered}
            noResults={{
              icon: <Building2 className="size-6" aria-hidden />,
              title: 'No accounts match those filters',
              description: 'Try a different word, or clear the filters to see them all.',
            }}
            firstRun={{
              title: 'No wholesale accounts yet',
              description:
                'Businesses that buy from you at agreed prices live here. Add your first account to set its credit limit, discount and payment terms.',
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Company</th>
                <th className="text-right">Credit limit</th>
                <th className="hidden text-right @md:table-cell">Discount</th>
                <th className="hidden @xl:table-cell">Terms</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = accountStatusMeta(row.status);
                const discount = Number(row.discountPercent);
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
                    <td className="text-right font-mono text-sm tabular-nums">
                      {formatMoney(row.creditLimit)}
                    </td>
                    <td className="hidden text-right font-mono text-sm tabular-nums @md:table-cell">
                      {discount > 0 ? `${String(discount)}%` : '—'}
                    </td>
                    <td className="hidden text-sm @xl:table-cell">
                      {paymentTermsLabel(row.paymentTerms)}
                    </td>
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
        <p className="text-xs">
          Click to open · Shift-click to open alongside · Alt-click for a new window
        </p>
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
