'use client';

// Build a report (docs/144 §8) — the surface that has to teach itself.
//
// THE SHAPE IS A SENTENCE, NOT A FORM. Reading down the left column produces the
// question in English: "Count Customers, broken down by how they found you, over
// the last 90 days, where status is active." That ordering is the design — a
// person who has never used a reporting tool can follow it, and every control is
// the next word rather than a labelled box on a grid.
//
// THE ANSWER IS ON SCREEN THE WHOLE TIME. The preview runs on every change, so
// you learn what a choice does by watching the numbers move. A builder that
// shows you the result only after you save is a form; the moving preview is the
// entire difference between the two.
//
// The vocabulary is deliberately plain — "How many there are", "Added up",
// "Broken down by". Never "measure", "dimension" or "aggregate": those are the
// words of a tool that assumes you have used one before.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useModuleColor } from '../analytics/charts';
import {
  BUCKET_LABEL,
  MEASURE_LABEL,
  VISUALIZATION_LABEL,
  allowedFunctions,
  allowedVisualizations,
  isConditionGroup,
  operatorsForKind,
  useCreateReport,
  useDuplicateReport,
  useReport,
  useReportFields,
  usePreview,
  useUpdateReport,
  type ConditionGroup,
  type ConditionLeaf,
  type DateBucket,
  type DateRange,
  type GroupBy,
  type Measure,
  type MeasureFn,
  type ReportField,
  type ReportResult,
  type Visualization,
} from './report-builder-data';
import { productCopy } from '../../lib/product';

/* ── Draft ──────────────────────────────────────────────────────────────── */

interface Draft {
  name: string;
  description: string;
  objectKey: string;
  groupByField: string;
  groupByBucket: DateBucket | '';
  measures: Measure[];
  visualization: Visualization;
  rangeKind: DateRange['kind'];
  rangeDays: number;
  /** Whether every condition has to hold, or any one of them. */
  logic: 'AND' | 'OR';
  conditions: ConditionLeaf[];
  /**
   * A stored filter this row editor cannot draw — a nested group. Kept verbatim
   * and handed straight back on save.
   *
   * This exists because the alternative is silent: for a while the builder had
   * no filters at all and compiled a hardcoded empty group, so opening a report
   * that HAD one previewed the wrong numbers and saving quietly deleted the
   * condition. A report that means something different from what it meant
   * yesterday, with nothing on screen having said so, is the worst thing this
   * surface can do — so anything unrepresentable is preserved, not dropped.
   */
  opaqueFilters: ConditionGroup | null;
}

const EMPTY: Draft = {
  name: '',
  description: '',
  objectKey: 'contact',
  groupByField: '',
  groupByBucket: '',
  measures: [{ fn: 'count' }],
  visualization: 'number',
  rangeKind: 'all',
  rangeDays: 90,
  logic: 'AND',
  conditions: [],
  opaqueFilters: null,
};

function toDraft(report: {
  name: string;
  description: string | null;
  objectKey: string;
  filters: ConditionGroup;
  groupBy: GroupBy | null;
  measures: Measure[];
  visualization: Visualization;
  dateRange: DateRange;
}): Draft {
  const stored = report.filters.conditions;
  const drawable = stored.every((node) => !isConditionGroup(node) && isScalar(node.value));
  return {
    name: report.name,
    description: report.description ?? '',
    objectKey: report.objectKey,
    groupByField: report.groupBy?.field ?? '',
    groupByBucket: report.groupBy?.bucket ?? '',
    measures: report.measures,
    visualization: report.visualization,
    rangeKind: report.dateRange.kind,
    rangeDays: report.dateRange.kind === 'last_n_days' ? report.dateRange.days : 90,
    logic: report.filters.logic,
    conditions: drawable ? (stored as ConditionLeaf[]) : [],
    opaqueFilters: drawable ? null : report.filters,
  };
}

/**
 * Whether a stored condition's value is something a single control can hold.
 *
 * A report authored through the API or MCP may carry `in`/`not_in` with a list,
 * which this editor has no control for. Rendering it as text would put
 * "[object Object]" in a box and then save that string back as the filter, so an
 * unrepresentable value sends the whole filter down the keep-it-verbatim path
 * instead. Absent counts as scalar — `is filled in` compares against nothing.
 */
function isScalar(value: unknown): value is string | number | boolean | null | undefined {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/** `condition.value` is `unknown`; only the four shapes above ever reach a box. */
function valueText(value: unknown): string {
  return isScalar(value) && value !== undefined && value !== null ? String(value) : '';
}

/**
 * The filter the report actually runs with.
 *
 * A half-finished row — a field chosen but nothing to compare it with — is
 * dropped rather than sent, because the compiler would reject the whole
 * definition and the preview would go red while somebody is mid-thought. The row
 * stays on screen, and says of itself that it is not counting yet.
 */
function toFilters(draft: Draft): ConditionGroup {
  if (draft.opaqueFilters) return draft.opaqueFilters;
  return {
    logic: draft.logic,
    conditions: draft.conditions.filter((c) => isComplete(c)),
  };
}

function isComplete(condition: ConditionLeaf): boolean {
  if (condition.field === '') return false;
  if (condition.operator === 'is_set' || condition.operator === 'is_not_set') return true;
  return condition.value !== undefined && condition.value !== '';
}

/** Text in, the type the column actually is out — `value > '5000'` compares
 *  strings in Postgres, so "900" would come back as more than "5000". */
function coerce(raw: string, kind: ReportField['kind'] | undefined): unknown {
  if (kind === 'number' || kind === 'currency') {
    const parsed = Number(raw);
    return raw.trim() === '' || Number.isNaN(parsed) ? raw : parsed;
  }
  if (kind === 'boolean') return raw === 'true';
  return raw;
}

function toDateRange(draft: Draft): DateRange {
  if (draft.rangeKind === 'last_n_days') return { kind: 'last_n_days', days: draft.rangeDays };
  // A stored absolute range is authored elsewhere (a dashboard's own switcher);
  // the builder offers "all time" and "the last N days", which is what covers
  // every question somebody actually asks of a saved report.
  return { kind: 'all' };
}

function toGroupBy(draft: Draft, fields: ReportField[]): GroupBy | null {
  if (!draft.groupByField) return null;
  const field = fields.find((f) => f.path === draft.groupByField);
  return field?.kind === 'date'
    ? { field: draft.groupByField, bucket: draft.groupByBucket || 'month' }
    : { field: draft.groupByField };
}

/* ── Rendering an answer ────────────────────────────────────────────────── */

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  if (typeof value === 'bigint') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // A grouped custom property comes back as whatever was in the JSONB bag, which
  // is not always a scalar. `String({})` is "[object Object]" — a cell that looks
  // like data and is not, so it is rendered as absent instead.
  if (typeof value !== 'string') return '—';
  const text = value;
  // A DATE_TRUNC bucket comes back as a timestamp; nobody wants to read the
  // time part of "the month of March".
  const asDate = /^\d{4}-\d{2}-\d{2}T/.exec(text) ? new Date(text) : null;
  return asDate ? asDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : text;
}

function ResultView({
  result,
  visualization,
  accent,
}: {
  result: ReportResult;
  visualization: Visualization;
  accent: string | undefined;
}) {
  const option = useMemo<EChartsOption | null>(() => {
    if (!result.grouped || result.rows.length === 0) return null;
    const [group, ...measures] = result.columns;
    if (!group) return null;
    const labels = result.rows.map((row) => formatCell(row[group.key]));
    const series = measures.map((column) => ({
      name: column.label,
      type: visualization === 'line' ? ('line' as const) : ('bar' as const),
      data: result.rows.map((row) => Number(row[column.key] ?? 0)),
      itemStyle: { color: accent, borderRadius: visualization === 'bar' ? 4 : 0 },
      smooth: visualization === 'line',
      areaStyle: undefined,
    }));

    if (visualization === 'pie' || visualization === 'funnel') {
      const first = measures[0];
      if (!first) return null;
      return {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: visualization === 'pie' ? 'pie' : 'funnel',
            radius: visualization === 'pie' ? ['45%', '72%'] : undefined,
            data: result.rows.map((row) => ({
              name: formatCell(row[group.key]),
              value: Number(row[first.key] ?? 0),
            })),
          },
        ],
      };
    }

    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', splitNumber: 3, minInterval: 1 },
      series,
    };
  }, [result, visualization, accent]);

  if (result.rows.length === 0) {
    return (
      <div className="border-base-300 rounded-box border p-8 text-center">
        <Text>Nothing matches yet. Loosen a filter, or widen the period.</Text>
      </div>
    );
  }

  // One row, one measure — a single number is the honest rendering.
  if (visualization === 'number') {
    const column = result.columns[0];
    const row = result.rows[0];
    return (
      <div className="border-base-300 rounded-box flex flex-col gap-1 border p-8 text-center">
        <span className="text-5xl font-semibold">
          {column && row ? formatCell(row[column.key]) : '—'}
        </span>
        <Text>{column?.label ?? ''}</Text>
      </div>
    );
  }

  if (option) {
    return (
      <Card className="p-4">
        <Chart option={option} className="h-72 w-full" aria-label="Report preview" />
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <Table size="sm">
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr key={index}>
              {result.columns.map((column) => (
                <td key={column.key}>{formatCell(row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* ── Surface ────────────────────────────────────────────────────────────── */

export function ReportBuilderSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const { data: report, isFetching: reportFetching, refetch: refetchReport } = useReport(id);
  const { data: catalog, isFetching: catalogFetching, refetch: refetchCatalog } = useReportFields();
  const create = useCreateReport();
  const update = useUpdateReport(id);
  const duplicate = useDuplicateReport();
  const toast = useToast();
  const { ref: accentRef, color: accent } = useModuleColor();

  const saved = useMemo(() => (report ? toDraft(report) : EMPTY), [report]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  const readOnly = Boolean(report?.builtinSlug);
  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  useDirtySource(dirty, 'This report has unsaved changes. Close anyway?');

  useEffect(() => {
    ctx.setTitle(isNew ? 'New report' : (report?.name ?? 'Report'));
  }, [ctx, isNew, report]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const objects = catalog?.objects ?? [];
  const object = objects.find((o) => o.objectKey === draft.objectKey);
  const fields = useMemo(() => object?.fields ?? [], [object]);
  const groupField = fields.find((f) => f.path === draft.groupByField);

  const definition = useMemo(
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

  const preview = usePreview(definition);

  // Keep the chosen shape honest as the definition changes: adding a breakdown
  // to a "single number" report, or a second measure to a pie chart, makes the
  // current choice undrawable. Correcting it silently beats an error on save.
  const allowed = allowedVisualizations(Boolean(definition.groupBy), draft.measures.length);
  useEffect(() => {
    if (!allowed.includes(draft.visualization)) {
      setDraft((current) => ({ ...current, visualization: allowed[0] ?? 'table' }));
    }
  }, [allowed, draft.visualization]);

  async function handleSave(): Promise<void> {
    const body = {
      ...definition,
      description: draft.description.trim() ? draft.description.trim() : null,
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(body);
        setTouched(false);
        toast.add({ title: `“${created.name}” saved.`, type: 'success' });
        ctx.open('crm.report.builder', { id: created.id }, { target: 'replace' });
      } else {
        await update.mutateAsync(body);
        setTouched(false);
        toast.add({ title: 'Report saved.', type: 'success' });
      }
    } catch (error) {
      toast.add({
        title: error instanceof Error ? error.message : 'Could not save that report.',
        type: 'error',
      });
    }
  }

  async function handleDuplicate(): Promise<void> {
    const copy = await duplicate.mutateAsync({ id });
    toast.add({ title: 'Copied — this one is yours to change.', type: 'success' });
    ctx.open('crm.report.builder', { id: copy.id }, { target: 'replace' });
  }

  return (
    <div className={PANE_SHELL} ref={accentRef}>
      <PaneToolbar
        label="Report builder controls"
        primary={
          readOnly ? (
            <Button color="module" onClick={() => void handleDuplicate()}>
              Make a copy to edit
            </Button>
          ) : (
            <Button
              color="module"
              disabled={!dirty || !draft.name.trim() || create.isPending || update.isPending}
              onClick={() => void handleSave()}
            >
              {create.isPending || update.isPending ? 'Saving…' : 'Save'}
            </Button>
          )
        }
        refresh={
          <RefreshButton
            isFetching={preview.isFetching || reportFetching || catalogFetching}
            updatedAt={preview.data ? preview.dataUpdatedAt : undefined}
            onRefresh={() => {
              void preview.refetch();
              void refetchReport();
              void refetchCatalog();
            }}
          />
        }
      />

      <div className="grid grid-cols-[minmax(320px,380px)_minmax(0,1fr)] gap-6 overflow-auto p-6 max-[900px]:grid-cols-1">
        {/* The question, read top to bottom as a sentence. */}
        <div className="flex flex-col gap-5">
          {readOnly ? (
            <Alert color="info" variant="soft">
              {productCopy(
                'crm.report.readOnly',
                'This is one of the reports Piggles ships. Make a copy to change anything — your copy is yours entirely.'
              )}
            </Alert>
          ) : null}

          <FormSection title="What to call it">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                color="module"
                value={draft.name}
                disabled={readOnly}
                placeholder="Customers by county"
                onChange={(event) => set('name', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>What it tells you</FieldLabel>
              <Textarea
                color="module"
                rows={2}
                value={draft.description}
                disabled={readOnly}
                placeholder="Optional — a sentence for whoever opens this next."
                onChange={(event) => set('description', event.target.value)}
              />
            </Field>
          </FormSection>

          <FormSection title="What to look at">
            <Field>
              <FieldLabel>Records</FieldLabel>
              <Select
                color="module"
                value={draft.objectKey}
                disabled={readOnly}
                items={Object.fromEntries(objects.map((o) => [o.objectKey, o.labelPlural]))}
                onValueChange={(next) => {
                  // Fields belong to an object, so changing it invalidates the
                  // breakdown, every measure that named one, and every
                  // condition — `deal.value` is not a column on a customer.
                  setTouched(true);
                  setDraft((current) => ({
                    ...current,
                    objectKey: next as string,
                    groupByField: '',
                    groupByBucket: '',
                    measures: [{ fn: 'count' }],
                    conditions: [],
                    opaqueFilters: null,
                  }));
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Over what period</FieldLabel>
              <Select
                color="module"
                value={draft.rangeKind === 'last_n_days' ? String(draft.rangeDays) : 'all'}
                disabled={readOnly}
                items={{
                  all: 'All time',
                  '7': 'Last 7 days',
                  '30': 'Last 30 days',
                  '90': 'Last 90 days',
                  '365': 'Last 12 months',
                }}
                onValueChange={(next) => {
                  setTouched(true);
                  setDraft((current) =>
                    next === 'all'
                      ? { ...current, rangeKind: 'all' }
                      : { ...current, rangeKind: 'last_n_days', rangeDays: Number(next) }
                  );
                }}
              />
              <FieldDescription>
                A rolling period stays true tomorrow — which is what makes a report worth pinning to
                a dashboard.
              </FieldDescription>
            </Field>
          </FormSection>

          <FormSection title="What to work out">
            {draft.measures.map((measure, index) => {
              const measureField = fields.find((f) => f.path === measure.field);
              const functions = allowedFunctions(measureField?.kind);
              return (
                <div key={index} className="flex flex-col gap-2">
                  <Field>
                    <FieldLabel>{index === 0 ? 'Work out' : 'And also'}</FieldLabel>
                    <Select
                      color="module"
                      value={measure.fn}
                      disabled={readOnly}
                      items={Object.fromEntries(functions.map((fn) => [fn, MEASURE_LABEL[fn]]))}
                      onValueChange={(next) => {
                        setTouched(true);
                        setDraft((current) => {
                          const measures = [...current.measures];
                          const fn = next as MeasureFn;
                          measures[index] = fn === 'count' ? { fn } : { fn, field: measure.field };
                          return { ...current, measures };
                        });
                      }}
                    />
                  </Field>
                  {measure.fn !== 'count' ? (
                    <Field>
                      <FieldLabel>Of which value</FieldLabel>
                      <Select
                        color="module"
                        value={measure.field ?? ''}
                        disabled={readOnly}
                        items={Object.fromEntries(
                          fields
                            .filter((f) => f.kind === 'number' || f.kind === 'currency')
                            .map((f) => [f.path, f.label])
                        )}
                        onValueChange={(next) => {
                          setTouched(true);
                          setDraft((current) => {
                            const measures = [...current.measures];
                            measures[index] = {
                              ...measures[index],
                              field: next as string,
                            } as Measure;
                            return { ...current, measures };
                          });
                        }}
                      />
                    </Field>
                  ) : null}
                  {index > 0 && !readOnly ? (
                    <div>
                      <Button
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTouched(true);
                          setDraft((current) => ({
                            ...current,
                            measures: current.measures.filter((_, i) => i !== index),
                          }));
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!readOnly && draft.measures.length < 4 ? (
              <div>
                <Button
                  color="module"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTouched(true);
                    setDraft((current) => ({
                      ...current,
                      measures: [...current.measures, { fn: 'count' }],
                    }));
                  }}
                >
                  Work out something else too
                </Button>
              </div>
            ) : null}
          </FormSection>

          <FormSection title="How to break it down">
            <Field>
              <FieldLabel>Broken down by</FieldLabel>
              <Select
                color="module"
                value={draft.groupByField}
                disabled={readOnly}
                items={{
                  '': 'Nothing — just one total',
                  ...Object.fromEntries(fields.map((f) => [f.path, f.label])),
                }}
                onValueChange={(next) => {
                  setTouched(true);
                  setDraft((current) => ({ ...current, groupByField: next as string }));
                }}
              />
            </Field>
            {groupField?.kind === 'date' ? (
              <Field>
                <FieldLabel>Grouped</FieldLabel>
                <Select
                  color="module"
                  value={draft.groupByBucket || 'month'}
                  disabled={readOnly}
                  items={BUCKET_LABEL}
                  onValueChange={(next) => set('groupByBucket', next as DateBucket)}
                />
                <FieldDescription>
                  A date needs grouping, or you get one row per moment instead of a breakdown.
                </FieldDescription>
              </Field>
            ) : null}
          </FormSection>

          {/* The "where …" at the end of the sentence. */}
          <FormSection title="Only count some of them">
            {draft.opaqueFilters ? (
              <Alert color="info" variant="soft">
                This report narrows what it counts in a way that cannot be shown as a simple list of
                rules. It is being kept exactly as it is — saving will not change it.
              </Alert>
            ) : (
              <>
                {draft.conditions.length > 1 ? (
                  <Field>
                    <FieldLabel>Which rules have to hold</FieldLabel>
                    <Select
                      color="module"
                      value={draft.logic}
                      disabled={readOnly}
                      items={{ AND: 'All of them', OR: 'Any one of them' }}
                      onValueChange={(next) => set('logic', next as 'AND' | 'OR')}
                    />
                  </Field>
                ) : null}

                {draft.conditions.map((condition, index) => {
                  const conditionField = fields.find((f) => f.path === condition.field);
                  const operators = operatorsForKind(conditionField?.kind);
                  const operator = operators.find((o) => o.value === condition.operator);
                  const editCondition = (patch: Partial<ConditionLeaf>) => {
                    setTouched(true);
                    setDraft((current) => {
                      const conditions = [...current.conditions];
                      conditions[index] = { ...conditions[index], ...patch } as ConditionLeaf;
                      return { ...current, conditions };
                    });
                  };
                  return (
                    <div key={index} className="flex flex-col gap-2">
                      <Field>
                        <FieldLabel>{index === 0 ? 'Only where' : 'And where'}</FieldLabel>
                        <Select
                          color="module"
                          aria-label="Which value to check"
                          value={condition.field}
                          disabled={readOnly}
                          items={Object.fromEntries(fields.map((f) => [f.path, f.label]))}
                          onValueChange={(next) => {
                            // The comparisons on offer depend on the kind of
                            // value, so a new field means the old operator may
                            // not exist any more — and the old value certainly
                            // does not belong to it.
                            const picked = fields.find((f) => f.path === (next as string));
                            const first = operatorsForKind(picked?.kind)[0];
                            editCondition({
                              field: next as string,
                              operator: first?.value ?? 'eq',
                              // A Yes/No control has no empty state to show, so
                              // leaving the value unset would render "No" over a
                              // rule holding nothing: the screen would read
                              // "Runs online is No" while the report quietly
                              // ignored it. Seed what the control is already
                              // displaying, so what is shown is what is stored.
                              value: picked?.kind === 'boolean' ? false : undefined,
                            });
                          }}
                        />
                      </Field>

                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[10rem] flex-1">
                          <Select
                            color="module"
                            aria-label="How to compare it"
                            value={condition.operator}
                            disabled={readOnly}
                            items={Object.fromEntries(operators.map((o) => [o.value, o.label]))}
                            onValueChange={(next) => {
                              const picked = operators.find((o) => o.value === (next as string));
                              editCondition({
                                operator: next as string,
                                ...(picked?.needsValue
                                  ? // Switching BACK to a comparison that needs a
                                    // value leaves a Yes/No control showing "No"
                                    // over nothing — same trap as picking the
                                    // field. Seed it here too.
                                    conditionField?.kind === 'boolean' &&
                                    condition.value === undefined
                                    ? { value: false }
                                    : {}
                                  : { value: undefined }),
                              });
                            }}
                          />
                        </div>

                        {operator?.needsValue ? (
                          <div className="min-w-[10rem] flex-1">
                            {conditionField?.kind === 'boolean' ? (
                              <Select
                                color="module"
                                aria-label="What to compare it with"
                                value={condition.value === true ? 'true' : 'false'}
                                disabled={readOnly}
                                items={{ true: 'Yes', false: 'No' }}
                                onValueChange={(next) => {
                                  editCondition({ value: next === 'true' });
                                }}
                              />
                            ) : (
                              <Input
                                color="module"
                                aria-label="What to compare it with"
                                type={
                                  conditionField?.kind === 'date'
                                    ? 'date'
                                    : conditionField?.kind === 'number' ||
                                        conditionField?.kind === 'currency'
                                      ? 'number'
                                      : 'text'
                                }
                                value={valueText(condition.value)}
                                disabled={readOnly}
                                placeholder="Type what to look for"
                                onChange={(event) => {
                                  editCondition({
                                    value: coerce(event.target.value, conditionField?.kind),
                                  });
                                }}
                              />
                            )}
                          </div>
                        ) : null}

                        {!readOnly ? (
                          <Button
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            aria-label="Remove this rule"
                            onClick={() => {
                              setTouched(true);
                              setDraft((current) => ({
                                ...current,
                                conditions: current.conditions.filter((_, i) => i !== index),
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>

                      {isComplete(condition) ? null : (
                        <Text className="text-sm">
                          Not narrowing anything yet — this rule needs something to compare with.
                        </Text>
                      )}
                    </div>
                  );
                })}

                {/* Plain prose, not a `FieldDescription` — that one reads Base
                    UI's Field context and throws outside a `<Field>`. */}
                {draft.conditions.length === 0 ? (
                  <Text className="text-sm">
                    Every one of them counts right now. Add a rule to leave some out — only deals
                    over a certain size, only requests still open, only people in one place.
                  </Text>
                ) : null}

                {!readOnly && draft.conditions.length < 6 ? (
                  <div>
                    <Button
                      color="module"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTouched(true);
                        setDraft((current) => {
                          const first = fields[0];
                          return {
                            ...current,
                            conditions: [
                              ...current.conditions,
                              {
                                field: first?.path ?? '',
                                operator: operatorsForKind(first?.kind)[0]?.value ?? 'eq',
                              },
                            ],
                          };
                        });
                      }}
                    >
                      {draft.conditions.length === 0 ? 'Leave some out' : 'And another rule'}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </FormSection>

          <FormSection title="How to show it">
            <Field>
              <FieldLabel>Show it as</FieldLabel>
              <Select
                color="module"
                value={draft.visualization}
                disabled={readOnly}
                items={Object.fromEntries(allowed.map((v) => [v, VISUALIZATION_LABEL[v]]))}
                onValueChange={(next) => set('visualization', next as Visualization)}
              />
              <FieldDescription>
                Only the shapes this report can honestly draw are offered.
              </FieldDescription>
            </Field>
          </FormSection>
        </div>

        {/* The answer, always on screen. */}
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
            <Alert color="warning" variant="soft">
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
              />
              {preview.data.truncated ? (
                <Alert color="info" variant="soft">
                  Showing the first {preview.data.rows.length} rows — narrow the period or add a
                  filter to see a complete answer.
                </Alert>
              ) : null}
            </>
          ) : (
            <div className="border-base-300 rounded-box border p-8 text-center">
              <Text>Choose what to look at and what to work out, and the answer appears here.</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
