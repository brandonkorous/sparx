'use client';

// The report builder's state: the draft, the live preview, and saving (docs/144 §8).

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useToast } from '@wizeworks/silicaui-react';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDirtySource } from '../../lib/workbench/dirty';
import { failureMessage } from '../../lib/api/write-failure';
import {
  allowedVisualizations,
  useCreateReport,
  useDuplicateReport,
  usePreview,
  useReport,
  useReportFields,
  useUpdateReport,
  type ReportField,
  type Visualization,
} from './report-builder-data';
import {
  EMPTY,
  toDateRange,
  toDraft,
  toFilters,
  toGroupBy,
  type Draft,
} from './report-builder-draft';

function useReportDraft(saved: Draft) {
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);
  const edit = useCallback((change: (current: Draft) => Draft) => {
    setTouched(true);
    setDraft(change);
  }, []);
  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  return { draft, setDraft, edit, dirty, markSaved: () => setTouched(false) };
}

/** What can be reported on, and the fields of the records being looked at. */
function useCatalog(objectKey: string) {
  const catalogQuery = useReportFields();
  const objects = catalogQuery.data?.objects ?? [];
  const object = objects.find((o) => o.objectKey === objectKey);
  const fields = useMemo(() => object?.fields ?? [], [object]);
  return { catalogQuery, objects, fields };
}

function useDefinition(draft: Draft, fields: ReportField[]) {
  return useMemo(
    () => ({
      name: draft.name || 'Untitled',
      objectKey: draft.objectKey,
      filters: toFilters(draft),
      groupBy: toGroupBy(draft, fields),
      measures: draft.measures,
      dateRange: toDateRange(draft),
      visualization: draft.visualization,
    }),
    [draft, fields]
  );
}

/** Keeps the chosen shape drawable as the definition changes (a breakdown added to
 *  "a single number", a second measure on a pie). Correcting it silently beats an
 *  error on save. */
function useHonestShape(
  hasGroupBy: boolean,
  draft: Draft,
  setDraft: Dispatch<SetStateAction<Draft>>
): Visualization[] {
  const allowed = allowedVisualizations(hasGroupBy, draft.measures.length);
  useEffect(() => {
    if (!allowed.includes(draft.visualization)) {
      setDraft((current) => ({ ...current, visualization: allowed[0] ?? 'table' }));
    }
  }, [allowed, draft.visualization, setDraft]);
  return allowed;
}

function useReportSave(
  ctx: SurfaceContext,
  id: string,
  body: () => Record<string, unknown>,
  markSaved: () => void
) {
  const create = useCreateReport();
  const update = useUpdateReport(id);
  const duplicate = useDuplicateReport();
  const toast = useToast();
  async function handleSave(): Promise<void> {
    try {
      if (id === 'new') {
        const created = await create.mutateAsync(body());
        markSaved();
        toast.add({ title: `“${created.name}” saved.`, type: 'success' });
        ctx.open('crm.report.builder', { id: created.id }, { target: 'replace' });
      } else {
        await update.mutateAsync(body());
        markSaved();
        toast.add({ title: 'Report saved.', type: 'success' });
      }
    } catch (error) {
      toast.add({ title: failureMessage(error, 'Could not save that report.'), type: 'error' });
    }
  }
  async function handleDuplicate(): Promise<void> {
    const copy = await duplicate.mutateAsync({ id });
    toast.add({ title: 'Copied. This one is yours to change.', type: 'success' });
    ctx.open('crm.report.builder', { id: copy.id }, { target: 'replace' });
  }
  return { handleSave, handleDuplicate, saving: create.isPending || update.isPending };
}

export function useReportBuilder(ctx: SurfaceContext) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';
  const reportQuery = useReport(id);
  const report = reportQuery.data;
  const saved = useMemo(() => (report ? toDraft(report) : EMPTY), [report]);
  const { draft, setDraft, edit, dirty, markSaved } = useReportDraft(saved);
  const readOnly = Boolean(report?.builtinSlug);
  useDirtySource(dirty, 'This report has unsaved changes. Close anyway?');
  useEffect(() => {
    ctx.setTitle(isNew ? 'New report' : (report?.name ?? 'Report'));
  }, [ctx, isNew, report]);

  const { catalogQuery, objects, fields } = useCatalog(draft.objectKey);
  const definition = useDefinition(draft, fields);
  const preview = usePreview(definition);
  const allowed = useHonestShape(Boolean(definition.groupBy), draft, setDraft);
  const save = useReportSave(
    ctx,
    id,
    () => ({
      ...definition,
      description: draft.description.trim() ? draft.description.trim() : null,
    }),
    markSaved
  );
  return {
    isNew,
    reportQuery,
    catalogQuery,
    draft,
    edit,
    dirty,
    readOnly,
    objects,
    fields,
    preview,
    allowed,
    save,
  };
}

export type ReportBuilderState = ReturnType<typeof useReportBuilder>;
