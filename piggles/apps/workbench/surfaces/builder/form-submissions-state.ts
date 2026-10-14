// The inbox's filters, cursor stack and query. TENANT-WIDE (every site), and paged
// by a keyset CURSOR, not offset: new submissions arrive at the top while she reads.

import { useEffect, useMemo, useState } from 'react';
import type { PageSize } from '../../components/list-pagination';
import { useSites } from '../../lib/api/shell-data';
import { surfaceTitle, type SurfaceContext } from '../../lib/surfaces/registry';
import { useSubmissions } from './form-submissions-data';
import { formLabel, formNamer } from './form-submissions-words';
import {
  parseStatusFilter,
  STATUS_FILTERS,
  type StatusFilterValue,
} from './form-submissions-filters';

function useSiteNames() {
  const { data: sites } = useSites();
  const siteName = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites ?? []) map.set(site.id, site.name);
    return map;
  }, [sites]);
  // On the single site most owners have, a site column is her own business name
  // down the page: the repeat RULE #4 says to demote.
  return { siteName, manySites: (sites?.length ?? 0) > 1 };
}

function useInboxFilters(ctx: SurfaceContext) {
  // Seeded from the address so "2 people wrote to you" opens on those two; read ONCE.
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(() =>
    parseStatusFilter(ctx.params.status)
  );
  const [formNodeId, setFormNodeId] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  // One cursor per step back; empty is the newest window. A stack, so "Newer" is a pop.
  const [cursors, setCursors] = useState<string[]>([]);
  const activeStatus =
    STATUS_FILTERS.find((entry) => entry.value === statusFilter) ?? STATUS_FILTERS[0];

  // A narrowed pane opens as a SECOND tab beside the inbox, so it says which it is.
  useEffect(() => {
    const base = surfaceTitle('builder.forms') ?? 'Form replies';
    ctx.setTitle(statusFilter === 'all' ? base : `${base} · ${activeStatus.label.toLowerCase()}`);
  }, [ctx, statusFilter, activeStatus.label]);

  return {
    ...{ statusFilter, setStatusFilter, formNodeId, setFormNodeId },
    ...{ pageSize, setPageSize, cursors, setCursors, activeStatus },
  };
}

export function useFormSubmissionsList(ctx: SurfaceContext) {
  const filters = useInboxFilters(ctx);
  const { activeStatus, formNodeId, cursors, pageSize, statusFilter } = filters;
  const cursor = cursors[cursors.length - 1];
  const query = useSubmissions({
    ...(activeStatus.status ? { status: activeStatus.status } : {}),
    ...(formNodeId ? { formNodeId } : {}),
    ...(cursor ? { cursor } : {}),
    limit: pageSize,
  });
  const sites = useSiteNames();

  const rows = query.data?.submissions ?? [];
  const forms = query.data?.forms ?? [];
  const picked = forms.find((form) => form.formNodeId === formNodeId);
  return {
    ...filters,
    ...sites,
    query,
    rows,
    forms,
    // Every tenant measured on 2026-09-28 had one form, so naming it per row repeated.
    manyForms: forms.length > 1,
    // Rows are named from `forms`, each form's CURRENT name, so the column and the
    // picker cannot disagree (issue 372).
    nameForm: formNamer(forms),
    activeFormName: formNodeId ? (picked ? formLabel(picked) : 'this form') : null,
    narrowed: statusFilter !== 'all' || formNodeId !== '',
    staleAfterFailure: Boolean(query.error) && rows.length > 0,
  };
}

export type FormSubmissionsList = ReturnType<typeof useFormSubmissionsList>;
