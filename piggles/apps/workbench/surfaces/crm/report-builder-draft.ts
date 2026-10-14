// The report builder's editable draft, and how it turns into a definition the
// compiler runs (docs/144 §8).

import {
  isConditionGroup,
  type ConditionGroup,
  type ConditionLeaf,
  type DateBucket,
  type DateRange,
  type GroupBy,
  type Measure,
  type ReportField,
  type Visualization,
} from './report-builder-types';

export interface Draft {
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
  /** A stored filter the row editor cannot draw (a nested group), kept verbatim
   *  and handed back on save. Dropping it would silently change what the report
   *  means, so anything unrepresentable is preserved. */
  opaqueFilters: ConditionGroup | null;
}

/** What every section of the builder is handed: the draft, and one way to edit it. */
export interface DraftProps {
  draft: Draft;
  readOnly: boolean;
  fields: ReportField[];
  edit: (change: (current: Draft) => Draft) => void;
}

export const EMPTY: Draft = {
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

export function toDraft(report: {
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

/** Whether a stored value fits one control. An API-authored `in` list would show
 *  as "[object Object]" and save back as that string, so it takes the verbatim
 *  path instead. Absent counts: `is filled in` compares against nothing. */
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
export function valueText(value: unknown): string {
  return isScalar(value) && value !== undefined && value !== null ? String(value) : '';
}

/** The filter the report actually runs with. A half-finished row is left out, not
 *  sent, so the preview does not go red mid-thought; the row says so itself. */
export function toFilters(draft: Draft): ConditionGroup {
  if (draft.opaqueFilters) return draft.opaqueFilters;
  return {
    logic: draft.logic,
    conditions: draft.conditions.filter((c) => isComplete(c)),
  };
}

export function isComplete(condition: ConditionLeaf): boolean {
  if (condition.field === '') return false;
  if (condition.operator === 'is_set' || condition.operator === 'is_not_set') return true;
  return condition.value !== undefined && condition.value !== '';
}

/** Text in, the type the column actually is out — `value > '5000'` compares
 *  strings in Postgres, so "900" would come back as more than "5000". */
export function coerce(raw: string, kind: ReportField['kind'] | undefined): unknown {
  if (kind === 'number' || kind === 'currency') {
    const parsed = Number(raw);
    return raw.trim() === '' || Number.isNaN(parsed) ? raw : parsed;
  }
  if (kind === 'boolean') return raw === 'true';
  return raw;
}

export function toDateRange(draft: Draft): DateRange {
  if (draft.rangeKind === 'last_n_days') return { kind: 'last_n_days', days: draft.rangeDays };
  // A stored absolute range is authored elsewhere; "all time" and "the last N
  // days" cover every question somebody actually asks of a saved report.
  return { kind: 'all' };
}

export function toGroupBy(draft: Draft, fields: ReportField[]): GroupBy | null {
  if (!draft.groupByField) return null;
  const field = fields.find((f) => f.path === draft.groupByField);
  return field?.kind === 'date'
    ? { field: draft.groupByField, bucket: draft.groupByBucket || 'month' }
    : { field: draft.groupByField };
}
