// What the report builder offers and the words it offers them in (docs/144 §8).
// `report-builder-data.ts` re-exports all of these.

import type {
  DateBucket,
  DateRange,
  MeasureFn,
  ReportField,
  Visualization,
} from './report-builder-types';

/** The words the builder uses. Never "aggregate", "measure" or "dimension" —
 *  a business owner has not used a BI tool and should not need to have. */
export const MEASURE_LABEL: Record<MeasureFn, string> = {
  count: 'How many there are',
  sum: 'Added up',
  avg: 'On average',
  min: 'The lowest',
  max: 'The highest',
};

/** The bucket as a bare noun, for a SENTENCE ("broken down by month"). The
 *  picker option "By month" is `BUCKET_LABEL` below; both shapes are needed. */
export const BUCKET_NOUN: Record<DateBucket, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
};

export const BUCKET_LABEL: Record<DateBucket, string> = {
  day: 'By day',
  week: 'By week',
  month: 'By month',
  quarter: 'By quarter',
  year: 'By year',
};

export const VISUALIZATION_LABEL: Record<Visualization, string> = {
  number: 'A single number',
  table: 'A table',
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  funnel: 'Funnel',
};

/** Only the shapes a definition can honestly draw. Mirrors `allowedVisualizations`
 *  in @wizeworks/crm-schemas — a pie chart of an ungrouped count is one wedge
 *  covering 100% of itself, which looks like a working chart and says nothing. */
export function allowedVisualizations(hasGroupBy: boolean, measureCount: number): Visualization[] {
  if (!hasGroupBy) return ['number', 'table'];
  return measureCount > 1 ? ['table', 'bar', 'line'] : ['table', 'bar', 'line', 'pie', 'funnel'];
}

/** Which functions make sense for a field. Only numbers can be added up; asking
 *  for the total of a country name is a question with no answer, so the builder
 *  does not offer it rather than failing on run. */
export function allowedFunctions(kind: ReportField['kind'] | undefined): MeasureFn[] {
  if (kind === 'number' || kind === 'currency') return ['count', 'sum', 'avg', 'min', 'max'];
  if (kind === 'date') return ['count', 'min', 'max'];
  return ['count'];
}

/** One way of comparing, in the words a person would use out loud. */
export interface FilterOperator {
  /** The compiler's own name — `report-compiler.ts` `compileCondition`. */
  value: string;
  label: string;
  /** False for `is_set`/`is_not_set`, which compare against nothing. */
  needsValue: boolean;
}

const IS_FILLED: FilterOperator[] = [
  { value: 'is_set', label: 'is filled in', needsValue: false },
  { value: 'is_not_set', label: 'is empty', needsValue: false },
];

/** Which comparisons make sense for a field, named for what they DO. Leaves out
 *  `in`/`not_in`: they take a list, and this surface has no control for one, so
 *  everything offered here round-trips through the compiler. */
export function operatorsForKind(kind: ReportField['kind'] | undefined): FilterOperator[] {
  if (kind === 'number' || kind === 'currency') {
    return [
      { value: 'eq', label: 'is', needsValue: true },
      { value: 'neq', label: 'is not', needsValue: true },
      { value: 'gt', label: 'is more than', needsValue: true },
      { value: 'gte', label: 'is at least', needsValue: true },
      { value: 'lt', label: 'is less than', needsValue: true },
      { value: 'lte', label: 'is at most', needsValue: true },
      ...IS_FILLED,
    ];
  }
  if (kind === 'date') {
    return [
      { value: 'gt', label: 'is after', needsValue: true },
      { value: 'gte', label: 'is on or after', needsValue: true },
      { value: 'lt', label: 'is before', needsValue: true },
      { value: 'lte', label: 'is on or before', needsValue: true },
      ...IS_FILLED,
    ];
  }
  if (kind === 'boolean') {
    return [
      { value: 'eq', label: 'is', needsValue: true },
      { value: 'neq', label: 'is not', needsValue: true },
    ];
  }
  if (kind === 'uuid') {
    return [
      { value: 'eq', label: 'is', needsValue: true },
      { value: 'neq', label: 'is not', needsValue: true },
      ...IS_FILLED,
    ];
  }
  return [
    { value: 'eq', label: 'is exactly', needsValue: true },
    { value: 'neq', label: 'is not', needsValue: true },
    { value: 'contains', label: 'contains', needsValue: true },
    { value: 'not_contains', label: 'does not contain', needsValue: true },
    ...IS_FILLED,
  ];
}

export function describeDateRange(range: DateRange): string {
  if (range.kind === 'all') return 'All time';
  if (range.kind === 'last_n_days') return `Last ${String(range.days)} days`;
  return 'A set period';
}
