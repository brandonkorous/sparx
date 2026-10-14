'use client';

// SHELVES: where inside each location your stock actually sits, in the order
// someone walks past them. The table, its rows and the warnings each live in a
// bins-list-* file beside this one; the state lives in use-bins-list.ts.

import { Card } from '@wizeworks/silicaui-react';
import { ListPagination, MAX_TAKE } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { BinsListAlerts } from './bins-list-alerts';
import { BinsListBody } from './bins-list-body';
import type { OpenBin } from './bins-list-table';
import { BinsListToolbar } from './bins-list-toolbar';
import { useBinsList } from './use-bins-list';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function BinsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const list = useBinsList(ctx);
  const { rows, skip, pageSize, setPage, setPageSize, setTake } = list;

  const open: OpenBin = (bin, event) => {
    ctx.open('inventory.bins.detail', { id: bin.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <BinsListToolbar ctx={ctx} list={list} />

      <BinsListAlerts noDefault={list.noDefault} emptyNote={list.emptyNote} />

      {/* ONE card around the whole conditional: loading, failure, empty and the
          table all fill the same content region, so the pane never jumps. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <BinsListBody list={list} onOpen={open} />
      </Card>

      <ListPagination
        shown={rows.length}
        firstRow={rows.length === 0 ? 0 : skip + 1}
        total={list.total}
        page={list.page}
        pageSize={pageSize}
        canLoadMore={list.take < MAX_TAKE}
        busy={list.isFetching}
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
    </div>
  );
}
