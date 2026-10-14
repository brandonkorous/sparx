'use client';

// Build a report (docs/144 §8). Read down the left column, the controls make the
// question as a sentence in plain words; the answer beside it moves on every
// change, which is what makes this a builder rather than a form.

import { Alert, Badge, Button, Text } from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { productCopy } from '../../lib/product';
import { useModuleColor } from '../analytics/charts';
import { toFilters, type Draft } from './report-builder-draft';
import { emptyAnswer } from './report-group-words';
import {
  BreakdownSection,
  LookAtSection,
  NameSection,
  ShowAsSection,
} from './report-builder-sections';
import { FiltersSection } from './report-filters-section';
import { MeasuresSection } from './report-measures-section';
import { ResultView } from './report-result-view';
import { useReportBuilder, type ReportBuilderState } from './use-report-builder';

function BuilderToolbar({ state }: { state: ReportBuilderState }) {
  const { readOnly, dirty, draft, save, preview, reportQuery, catalogQuery } = state;
  return (
    <PaneToolbar
      label="Report controls"
      primary={
        readOnly ? (
          <Button color="module" onClick={() => void save.handleDuplicate()}>
            Make a copy to edit
          </Button>
        ) : (
          <Button
            color="module"
            disabled={!dirty || !draft.name.trim() || save.saving}
            onClick={() => void save.handleSave()}
          >
            {save.saving ? 'Saving…' : 'Save'}
          </Button>
        )
      }
      refresh={
        <RefreshButton
          isFetching={preview.isFetching || reportQuery.isFetching || catalogQuery.isFetching}
          updatedAt={preview.data ? preview.dataUpdatedAt : undefined}
          onRefresh={() => {
            void preview.refetch();
            void reportQuery.refetch();
            void catalogQuery.refetch();
          }}
        />
      }
    />
  );
}

/** The answer, always on screen. */
function ReportAnswer(props: {
  preview: ReportBuilderState['preview'];
  draft: Draft;
  accent: string | undefined;
  labelPlural: string;
}) {
  const { preview, draft, accent, labelPlural } = props;
  const narrowed = toFilters(draft).conditions.length > 0 || draft.rangeKind !== 'all';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Text>The answer, right now</Text>
        {preview.isFetching ? (
          <Badge color="neutral" variant="soft">
            Working…
          </Badge>
        ) : null}
      </div>
      {preview.isError ? (
        <Alert color="warning">
          {preview.error instanceof Error
            ? preview.error.message
            : 'That combination cannot be worked out.'}
        </Alert>
      ) : preview.data ? (
        <>
          <ResultView
            result={preview.data}
            visualization={draft.visualization}
            accent={accent}
            objectKey={draft.objectKey}
            groupField={draft.groupByField || undefined}
            empty={emptyAnswer({ narrowed, labelPlural })}
          />
          {preview.data.truncated ? (
            <Alert color="info">
              Showing the first {preview.data.rows.length} rows: narrow the period or add a filter
              to see a complete answer.
            </Alert>
          ) : null}
        </>
      ) : (
        <div className="border-base-300 rounded-box border p-8 text-center">
          <Text>Choose what to look at and what to work out, and the answer appears here.</Text>
        </div>
      )}
    </div>
  );
}

/** The question, read top to bottom as a sentence. */
function ReportQuestion({ state }: { state: ReportBuilderState }) {
  const { draft, readOnly, fields, edit, objects, allowed } = state;
  const props = { draft, readOnly, fields, edit };
  return (
    <div className="flex flex-col gap-5">
      {readOnly ? (
        <Alert color="info">
          {productCopy(
            'crm.report.readOnly',
            'This is one of the reports Piggles ships. Make a copy to change anything. Your copy is yours entirely.'
          )}
        </Alert>
      ) : null}
      <NameSection {...props} />
      <LookAtSection {...props} objects={objects} />
      <MeasuresSection {...props} />
      <BreakdownSection {...props} />
      <FiltersSection {...props} />
      <ShowAsSection {...props} allowed={allowed} />
    </div>
  );
}

export function ReportBuilderSurface({ ctx }: { ctx: SurfaceContext }) {
  const state = useReportBuilder(ctx);
  const { ref: accentRef, color: accent } = useModuleColor();
  const { isNew, reportQuery } = state;

  // A missing report says so, rather than opening blank and saving as a new one
  // (persona issue 226).
  if (!isNew && reportQuery.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={reportQuery.error}
          noun="report"
          title="Could not load this report"
          description="This is a problem reaching the server. The report itself is unaffected. Try again in a moment."
          onRetry={() => {
            void reportQuery.refetch();
          }}
        />
      </div>
    );
  }
  if (!isNew && reportQuery.isPending) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL} ref={accentRef}>
      <BuilderToolbar state={state} />
      {/* Two columns only when the PANE is wide: a docked pane is often narrow in
          a wide window, and a window rule left the answer about 60px (issue 249). */}
      <div className="grid grid-cols-1 gap-6 overflow-auto p-6 @4xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <ReportQuestion state={state} />
        <ReportAnswer
          preview={state.preview}
          draft={state.draft}
          accent={accent}
          labelPlural={
            state.objects.find((o) => o.objectKey === state.draft.objectKey)?.labelPlural ??
            'records'
          }
        />
      </div>
    </div>
  );
}
