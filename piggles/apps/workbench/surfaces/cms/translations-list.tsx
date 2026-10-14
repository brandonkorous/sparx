'use client';

// Your products, and which languages each one is written in: a worklist for "what
// still needs translating". Registered under Content, but it works on COMMERCE
// products, so the surface wears the commerce hue via <ModuleScope module="commerce">.

import { useState } from 'react';
import { Card } from '@wizeworks/silicaui-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ModuleScope } from '../../components/module-scope';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  useCoverage,
  useTranslatableProducts,
  type TranslatableProduct,
} from './translations-data';
import { RowOpenHint } from '../../components/row-open-hint';
import {
  STATUS_FILTERS,
  TranslationsToolbar,
  type StatusFilterValue,
} from './translations-list-toolbar';
import { TranslationsBody } from './translations-list-body';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

// Search and paging are server-side: the page, its size, and how far "Load more" has
// reached. Any change to the question starts again at page one.
function usePaging() {
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(25);
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };
  const paging = { pageSize, page, take, skip: (page - 1) * pageSize };
  return { ...paging, setPageSize, setPage, setTake, resetWindow };
}

type Paging = ReturnType<typeof usePaging>;

function TranslationsPagination(props: {
  paging: Paging;
  shown: number;
  total: number | undefined;
  busy: boolean;
}) {
  const { paging, shown } = props;
  return (
    <ListPagination
      shown={shown}
      firstRow={shown === 0 ? 0 : paging.skip + 1}
      total={props.total}
      page={paging.page}
      pageSize={paging.pageSize}
      canLoadMore={paging.take < MAX_TAKE}
      busy={props.busy}
      onLoadMore={() => {
        paging.setTake((current) => Math.min(current + paging.pageSize, MAX_TAKE));
      }}
      onPageChange={(next) => {
        paging.setPage(next);
        paging.setTake(paging.pageSize);
      }}
      onPageSizeChange={(size) => {
        paging.setPageSize(size);
        paging.setPage(1);
        paging.setTake(size);
      }}
    />
  );
}

function useTranslationsView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const paging = usePaging();
  const active = STATUS_FILTERS.find((entry) => entry.value === statusFilter) ?? STATUS_FILTERS[0];
  const query = useTranslatableProducts({
    q: search.trim(),
    ...(active.status ? { status: active.status } : {}),
    includeArchived: active.includeArchived,
    take: paging.take,
    skip: paging.skip,
  });
  const rows = query.data?.items ?? [];
  // Coverage for the rows on screen: one light, cached request each, bounded by the
  // page, so a bigger page is a cost the operator chose with the size picker.
  const { byProduct, loading: coverageLoading } = useCoverage(rows.map((row) => row.id));
  const onSearch = (next: string) => {
    setSearch(next);
    paging.resetWindow();
  };
  const onStatusFilter = (next: StatusFilterValue) => {
    setStatusFilter(next);
    paging.resetWindow();
  };
  const coverage = { byProduct, coverageLoading };
  return { search, onSearch, statusFilter, onStatusFilter, paging, query, rows, ...coverage };
}

export function TranslationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const view = useTranslationsView();
  const { search, statusFilter, paging, query, rows } = view;
  const { data, isFetching, refetch } = query;
  const retry = () => {
    void refetch();
  };

  return (
    <ModuleScope module="commerce" className={PANE_SHELL}>
      <TranslationsToolbar
        search={search}
        onSearch={view.onSearch}
        statusFilter={statusFilter}
        onStatusFilter={view.onStatusFilter}
        isFetching={isFetching}
        updatedAt={data ? query.dataUpdatedAt : undefined}
        onRefresh={retry}
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <TranslationsBody
          error={query.error}
          isLoading={query.isLoading}
          narrowed={statusFilter !== 'all' || search.trim() !== ''}
          rows={rows}
          byProduct={view.byProduct}
          coverageLoading={view.coverageLoading}
          onRetry={retry}
          onOpen={(product: TranslatableProduct, event) => {
            ctx.open('cms.translations.detail', { id: product.id }, { target: targetFor(event) });
          }}
        />
      </Card>
      <div className="shrink-0">
        <TranslationsPagination
          paging={paging}
          shown={rows.length}
          total={data?.total}
          busy={isFetching}
        />
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </ModuleScope>
  );
}
