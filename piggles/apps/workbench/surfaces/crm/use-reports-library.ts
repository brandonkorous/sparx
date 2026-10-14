'use client';

import { useState } from 'react';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useConfirm } from '../../lib/confirm';
import {
  useArchiveReport,
  useDuplicateReport,
  useReportFields,
  useReports,
  type SavedReport,
} from './report-builder-data';
import { makeFieldLabel } from './reports-library-describe';

/** The search box applied, then split into the tenant's own and the built-ins. */
function filterReports(all: SavedReport[], needle: string) {
  const rows = needle
    ? all.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.description ?? '').toLowerCase().includes(needle)
      )
    : all;
  const builtins = rows.filter((r) => r.builtinSlug);
  const mine = rows.filter((r) => !r.builtinSlug);
  return { rows, builtins, mine };
}

/** Delete one of the tenant's own reports, once they confirm it. */
function useRemoveReport() {
  const archive = useArchiveReport();
  const confirm = useConfirm();

  return async function remove(report: SavedReport): Promise<void> {
    const ok = await confirm({
      title: `Delete “${report.name}”?`,
      description: 'It will be removed from any dashboards it appears on. This cannot be undone.',
      confirmLabel: 'Delete report',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (ok) await archive.mutateAsync(report.id);
  };
}

/** The library's data, search and per-row actions. */
export function useReportsLibrary(ctx: SurfaceContext) {
  const { data, isPending, isFetching, dataUpdatedAt, refetch } = useReports();
  const { data: catalog } = useReportFields();
  const fieldLabel = makeFieldLabel(catalog?.objects ?? []);
  const duplicate = useDuplicateReport();
  const remove = useRemoveReport();
  const [q, setQ] = useState('');

  const needle = q.trim().toLowerCase();
  const { rows, builtins, mine } = filterReports(data?.items ?? [], needle);

  function open(report: SavedReport, shiftKey: boolean): void {
    ctx.open('crm.report.builder', { id: report.id }, { target: shiftKey ? 'beside' : 'tab' });
  }

  function copy(report: SavedReport): void {
    void duplicate
      .mutateAsync({ id: report.id })
      .then((made) => ctx.open('crm.report.builder', { id: made.id }, { target: 'tab' }));
  }

  return {
    data,
    isFetching,
    dataUpdatedAt,
    refetch,
    q,
    setQ,
    body: {
      isPending,
      needle,
      rows,
      builtins,
      mine,
      fieldLabel,
      onOpen: open,
      onCopy: copy,
      onRemove: remove,
    },
  };
}
