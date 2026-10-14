// The shapes of a report definition, its answer, and the boards that show them
// (docs/144 §8). `report-builder-data.ts` re-exports all of these.

export type MeasureFn = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type Visualization = 'table' | 'bar' | 'line' | 'pie' | 'funnel' | 'number';

export interface Measure {
  fn: MeasureFn;
  field?: string;
  label?: string;
}

export interface GroupBy {
  field: string;
  bucket?: DateBucket;
}

export type DateRange =
  | { kind: 'all' }
  | { kind: 'last_n_days'; days: number }
  | { kind: 'between'; from: string; to: string };

export interface ConditionLeaf {
  field: string;
  operator: string;
  value?: unknown;
}

export interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (ConditionLeaf | ConditionGroup)[];
}

export function isConditionGroup(node: ConditionLeaf | ConditionGroup): node is ConditionGroup {
  return 'conditions' in node;
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  objectKey: string;
  filters: ConditionGroup;
  groupBy: GroupBy | null;
  measures: Measure[];
  visualization: Visualization;
  dateRange: DateRange;
  /** Set on the reports sparx ships — read-only in place, duplicate to change. */
  builtinSlug: string | null;
  shared: boolean;
  /** Who made it; null for the ready-made ones, which belong to the business. */
  ownerId: string | null;
  propertyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportField {
  path: string;
  label: string;
  kind: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'uuid';
}

export interface ReportableObject {
  objectKey: string;
  label: string;
  labelPlural: string;
  fields: ReportField[];
}

export interface ReportResult {
  /** `kind` marks money and plain numbers so they print as such (issue 251). */
  columns: { key: string; label: string; kind?: 'number' | 'currency' }[];
  rows: Record<string, unknown>[];
  grouped: boolean;
  /** The row cap was hit — the surface must say so rather than presenting a
   *  truncated answer as the whole one. */
  truncated: boolean;
  /** For a breakdown by an id: each id's name, keyed by the id (issue 247). */
  groupLabels?: Record<string, string>;
  /** The business's currency, sent when a column holds money (issue 251). */
  currency?: string;
}

export interface DashboardWidget {
  id: string;
  reportId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string | null;
  /** Null, with `privateReport`, for a report its maker kept to herself (issue 264). */
  report: SavedReport | null;
  privateReport?: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  shared: boolean;
  propertyId: string | null;
  widgets?: DashboardWidget[];
}
