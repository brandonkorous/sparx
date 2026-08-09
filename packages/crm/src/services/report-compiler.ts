// The report compiler (docs/144 §8) — a saved definition becomes one query.
//
// THE SECURITY MODEL, STATED FIRST, BECAUSE IT IS WHY THIS IS ALLOWED TO BE
// DATA-DRIVEN AT ALL. A report names an object and some property paths, and
// those names come from a tenant's own definition. Nothing here interpolates a
// name into SQL: every identifier is looked up in a STATIC map declared in this
// file, and anything not in the map is refused. Values travel as Prisma
// parameters. Beneath all of that the table has FORCE RLS, so even a compiler
// bug can only ever return the tenant's own rows.
//
// WHAT IT DELIBERATELY DOES NOT DO. There is no join planner. A report is over
// ONE object; "deals by customer country" is not expressible and should not be —
// the moment this grows joins it needs a cost model, and a business owner
// dragging fields together can trivially write a query that reads the whole
// database. The escape hatch for genuinely cross-object questions is a built-in
// report we wrote by hand, which is what `reporting-service` already holds.
//
// Custom properties live in a JSONB bag. Grouping by one is a `->>` extraction,
// which is unindexed and therefore capped like everything else here — the LIMIT
// is not a paging convenience, it is the thing that keeps a bad definition from
// becoming an outage.

import type { prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';
import type { DateBucket, DateRange, GroupBy, Measure, MeasureFn } from '@sparx/crm-schemas';
import { isConditionGroup, type ConditionGroup } from '@sparx/automation-schemas';

import { CrmValidationError } from '../errors';
import type { ServiceContext } from '../errors';

/* ── What can be reported on ────────────────────────────────────────────── */

type ColumnKind = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'uuid';

interface ColumnDef {
  /** The real column name. Never derived from user input. */
  column: string;
  kind: ColumnKind;
  /** What a person calls it. */
  label: string;
}

interface ObjectSource {
  table: string;
  /** The column a date range filters on — "when did this happen". */
  timeColumn: string;
  /** Soft-delete guard, when the table has one. */
  deletedColumn?: string;
  /** Where the tenant's own extra properties live. */
  customBag?: string;
  label: string;
  labelPlural: string;
  columns: Record<string, ColumnDef>;
}

/**
 * The reportable spine, per built-in object.
 *
 * Hand-written rather than reflected off Prisma's DMMF on purpose. Reflection
 * would expose every column the moment somebody added one — including tokens,
 * hashes and internal bookkeeping — and "reportable" is a product decision, not
 * a schema one. Adding a column here is a deliberate act, which is the point.
 */
const SOURCES: Record<string, ObjectSource> = {
  contact: {
    table: 'customers',
    timeColumn: 'created_at',
    deletedColumn: 'deleted_at',
    customBag: 'custom_properties',
    label: 'Customer',
    labelPlural: 'Customers',
    columns: {
      id: { column: 'id', kind: 'uuid', label: 'Customer' },
      type: { column: 'type', kind: 'text', label: 'Kind of customer' },
      lifecycleStage: { column: 'lifecycle_stage', kind: 'text', label: 'Stage' },
      leadStatus: { column: 'lead_status', kind: 'text', label: 'Lead status' },
      company: { column: 'company', kind: 'text', label: 'Company' },
      jobTitle: { column: 'job_title', kind: 'text', label: 'Job title' },
      assignedRepId: { column: 'assigned_rep_id', kind: 'uuid', label: 'Owner' },
      b2bAccountId: { column: 'b2b_account_id', kind: 'uuid', label: 'Business account' },
      doNotContact: { column: 'do_not_contact', kind: 'boolean', label: 'Do not contact' },
      totalSpent: { column: 'total_spent', kind: 'currency', label: 'Lifetime spend' },
      orderCount: { column: 'order_count', kind: 'number', label: 'Orders' },
      createdAt: { column: 'created_at', kind: 'date', label: 'Added' },
      lastOrderAt: { column: 'last_order_at', kind: 'date', label: 'Last order' },
    },
  },
  deal: {
    table: 'deals',
    timeColumn: 'created_at',
    deletedColumn: 'deleted_at',
    customBag: 'custom_properties',
    label: 'Deal',
    labelPlural: 'Deals',
    columns: {
      id: { column: 'id', kind: 'uuid', label: 'Deal' },
      title: { column: 'title', kind: 'text', label: 'Name' },
      value: { column: 'value', kind: 'currency', label: 'Value' },
      currency: { column: 'currency', kind: 'text', label: 'Currency' },
      source: { column: 'source', kind: 'text', label: 'Source' },
      probability: { column: 'probability', kind: 'number', label: 'Probability' },
      closedReason: { column: 'closed_reason', kind: 'text', label: 'Why it closed' },
      stageId: { column: 'stage_id', kind: 'uuid', label: 'Stage' },
      pipelineId: { column: 'pipeline_id', kind: 'uuid', label: 'Pipeline' },
      assignedRepId: { column: 'assigned_rep_id', kind: 'uuid', label: 'Owner' },
      createdAt: { column: 'created_at', kind: 'date', label: 'Opened' },
      closedAt: { column: 'closed_at', kind: 'date', label: 'Closed' },
      expectedCloseDate: {
        column: 'expected_close_date',
        kind: 'date',
        label: 'Expected close',
      },
    },
  },
  ticket: {
    table: 'crm_tickets',
    timeColumn: 'created_at',
    deletedColumn: 'deleted_at',
    customBag: 'custom_properties',
    label: 'Request',
    labelPlural: 'Requests',
    columns: {
      id: { column: 'id', kind: 'uuid', label: 'Request' },
      subject: { column: 'subject', kind: 'text', label: 'Subject' },
      priority: { column: 'priority', kind: 'text', label: 'Urgency' },
      source: { column: 'source', kind: 'text', label: 'Came in by' },
      stageId: { column: 'stage_id', kind: 'uuid', label: 'Stage' },
      assignedToUserId: { column: 'assigned_to_user_id', kind: 'uuid', label: 'Owner' },
      createdAt: { column: 'created_at', kind: 'date', label: 'Opened' },
      resolvedAt: { column: 'resolved_at', kind: 'date', label: 'Sorted' },
      firstRespondedAt: { column: 'first_responded_at', kind: 'date', label: 'First reply' },
    },
  },
  task: {
    table: 'tasks',
    timeColumn: 'created_at',
    label: 'Task',
    labelPlural: 'Tasks',
    columns: {
      id: { column: 'id', kind: 'uuid', label: 'Task' },
      status: { column: 'status', kind: 'text', label: 'Status' },
      priority: { column: 'priority', kind: 'text', label: 'Priority' },
      assignedToUserId: { column: 'assigned_to_user_id', kind: 'uuid', label: 'Owner' },
      createdAt: { column: 'created_at', kind: 'date', label: 'Created' },
      dueAt: { column: 'due_at', kind: 'date', label: 'Due' },
      completedAt: { column: 'completed_at', kind: 'date', label: 'Completed' },
    },
  },
};

/** Objects the builder offers, with the words a person uses for them. */
export function reportableObjects(): {
  objectKey: string;
  label: string;
  labelPlural: string;
}[] {
  return Object.entries(SOURCES).map(([objectKey, source]) => ({
    objectKey,
    label: source.label,
    labelPlural: source.labelPlural,
  }));
}

/** The fields the builder offers for one object, spine first. `custom.<key>`
 *  paths are appended by the caller from the object registry — the compiler
 *  accepts any of them, since a JSONB extraction needs no column allowlist. */
export function reportableFields(
  objectKey: string
): { path: string; label: string; kind: ColumnKind }[] {
  const source = SOURCES[objectKey];
  if (!source) return [];
  return Object.entries(source.columns).map(([path, def]) => ({
    path,
    label: def.label,
    kind: def.kind,
  }));
}

/* ── Identifier resolution — the only place a name becomes SQL ──────────── */

const CUSTOM_PREFIX = 'custom.';
/** A custom-property key. Matches the registry's own key rule, and is what stops
 *  a JSONB path from carrying a quote out of the bag and into the statement. */
const CUSTOM_KEY = /^[a-z][a-z0-9_]{0,62}$/;

interface ResolvedField {
  /** SQL fragment naming the value, already quoted/extracted. */
  sql: string;
  kind: ColumnKind;
  label: string;
}

function resolveField(source: ObjectSource, path: string): ResolvedField {
  if (path.startsWith(CUSTOM_PREFIX)) {
    const key = path.slice(CUSTOM_PREFIX.length);
    if (!source.customBag || !CUSTOM_KEY.test(key)) {
      throw new CrmValidationError(`There is no field called “${path}” on this record.`, [
        { field: 'field', message: `unknown property ${path}` },
      ]);
    }
    // Text extraction. A custom property has no column type, so everything
    // arrives as text and a `sum` over one is refused below rather than being
    // cast and quietly returning garbage on the first non-numeric value.
    return {
      sql: `"${source.customBag}" ->> '${key}'`,
      kind: 'text',
      label: key.replace(/_/g, ' '),
    };
  }

  const def = source.columns[path];
  if (!def) {
    throw new CrmValidationError(`There is no field called “${path}” on this record.`, [
      { field: 'field', message: `unknown property ${path}` },
    ]);
  }
  return { sql: `"${def.column}"`, kind: def.kind, label: def.label };
}

/* ── Filters ────────────────────────────────────────────────────────────── */

/**
 * A ConditionGroup becomes a WHERE fragment plus an ordered parameter list.
 *
 * Parameters are positional (`$1`, `$2`, …) and the caller splices them into
 * `$queryRawUnsafe` as real bind values — so a filter value is data to Postgres
 * no matter what a tenant typed into it.
 */
/** A filter value rendered for a LIKE pattern. Objects and arrays stringify to
 *  "[object Object]", which would silently match nothing — a filter that returns
 *  an empty report rather than saying it was nonsense. */
function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new CrmValidationError('That filter needs a word or a number to look for.', [
    { field: 'value', message: 'contains requires a scalar value' },
  ]);
}

function compileCondition(
  source: ObjectSource,
  node: { field: string; operator: string; value?: unknown },
  params: unknown[]
): string {
  const field = resolveField(source, node.field);
  const bind = (value: unknown): string => {
    params.push(value);
    return `$${String(params.length)}`;
  };

  switch (node.operator) {
    case 'is_set':
      return `${field.sql} IS NOT NULL`;
    case 'is_not_set':
      return `${field.sql} IS NULL`;
    case 'eq':
      return `${field.sql} = ${bind(node.value)}`;
    case 'neq':
      // NULL is "not equal to" any value, in the way a person means it — the
      // bare `<>` would drop every unset row and quietly under-report.
      return `(${field.sql} IS NULL OR ${field.sql} <> ${bind(node.value)})`;
    case 'gt':
      return `${field.sql} > ${bind(node.value)}`;
    case 'gte':
      return `${field.sql} >= ${bind(node.value)}`;
    case 'lt':
      return `${field.sql} < ${bind(node.value)}`;
    case 'lte':
      return `${field.sql} <= ${bind(node.value)}`;
    case 'contains':
      return `${field.sql}::text ILIKE ${bind(`%${asText(node.value)}%`)}`;
    case 'not_contains':
      return `(${field.sql} IS NULL OR ${field.sql}::text NOT ILIKE ${bind(`%${asText(node.value)}%`)})`;
    case 'in':
      return `${field.sql} = ANY(${bind(Array.isArray(node.value) ? node.value : [node.value])})`;
    case 'not_in':
      return `(${field.sql} IS NULL OR NOT (${field.sql} = ANY(${bind(Array.isArray(node.value) ? node.value : [node.value])})))`;
    default:
      throw new CrmValidationError(`“${node.operator}” is not something we can filter on.`, [
        { field: 'operator', message: `unsupported operator ${node.operator}` },
      ]);
  }
}

function compileGroup(source: ObjectSource, group: ConditionGroup, params: unknown[]): string {
  const parts = group.conditions.map((node) =>
    isConditionGroup(node)
      ? compileGroup(source, node, params)
      : compileCondition(
          source,
          node as { field: string; operator: string; value?: unknown },
          params
        )
  );
  // An empty group filters nothing. TRUE rather than an omitted clause so the
  // caller never has to special-case whether to write WHERE at all.
  if (parts.length === 0) return 'TRUE';
  return `(${parts.join(group.logic === 'OR' ? ' OR ' : ' AND ')})`;
}

/* ── Dates ──────────────────────────────────────────────────────────────── */

const BUCKET_SQL: Record<DateBucket, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
};

function compileDateRange(
  source: ObjectSource,
  range: DateRange,
  params: unknown[]
): string | null {
  if (range.kind === 'all') return null;
  const column = `"${source.timeColumn}"`;
  if (range.kind === 'last_n_days') {
    params.push(range.days);
    return `${column} >= now() - ($${String(params.length)}::int * INTERVAL '1 day')`;
  }
  params.push(new Date(range.from));
  const from = `$${String(params.length)}`;
  params.push(new Date(range.to));
  return `${column} >= ${from} AND ${column} <= $${String(params.length)}`;
}

/* ── Measures ───────────────────────────────────────────────────────────── */

const NUMERIC_KINDS: ReadonlySet<ColumnKind> = new Set(['number', 'currency']);

function compileMeasure(source: ObjectSource, measure: Measure, index: number): string {
  const alias = `m${String(index)}`;
  if (measure.fn === 'count') return `COUNT(*)::float8 AS "${alias}"`;

  const field = resolveField(source, measure.field ?? '');
  // Refused rather than cast. A `sum` over a text column is a question with no
  // answer, and casting would return a number that looks authoritative and is
  // wrong the moment one row holds "n/a".
  if (!NUMERIC_KINDS.has(field.kind)) {
    throw new CrmValidationError(
      `“${field.label}” is not a number, so it cannot be added up. Count them instead.`,
      [{ field: 'measures', message: `${measure.fn} requires a numeric field` }]
    );
  }
  const fn: Record<Exclude<MeasureFn, 'count'>, string> = {
    sum: 'SUM',
    avg: 'AVG',
    min: 'MIN',
    max: 'MAX',
  };
  return `${fn[measure.fn]}(${field.sql})::float8 AS "${alias}"`;
}

/** The words a column header uses when the author did not name it. */
export function measureLabel(objectKey: string, measure: Measure): string {
  if (measure.label) return measure.label;
  const source = SOURCES[objectKey];
  if (measure.fn === 'count') return `How many ${source?.labelPlural.toLowerCase() ?? 'records'}`;
  const field = source && measure.field ? source.columns[measure.field] : undefined;
  const name = field?.label ?? measure.field ?? '';
  switch (measure.fn) {
    case 'sum':
      return `Total ${name.toLowerCase()}`;
    case 'avg':
      return `Average ${name.toLowerCase()}`;
    case 'min':
      return `Lowest ${name.toLowerCase()}`;
    default:
      return `Highest ${name.toLowerCase()}`;
  }
}

/* ── The whole thing ────────────────────────────────────────────────────── */

export interface ReportDefinition {
  objectKey: string;
  filters: ConditionGroup;
  groupBy?: GroupBy | null;
  measures: Measure[];
  dateRange: DateRange;
  propertyId?: string | null;
}

export interface CompiledReport {
  sql: string;
  params: unknown[];
  /** Column headers, in the order the rows carry them. */
  columns: { key: string; label: string }[];
  grouped: boolean;
}

export function compileReport(definition: ReportDefinition, limit: number): CompiledReport {
  const source = SOURCES[definition.objectKey];
  if (!source) {
    throw new CrmValidationError(
      `There is nothing to report on called “${definition.objectKey}”.`,
      [{ field: 'objectKey', message: `unknown object ${definition.objectKey}` }]
    );
  }

  const params: unknown[] = [];
  const where: string[] = [];

  // RLS is the real fence; these are correctness, not security.
  if (source.deletedColumn) where.push(`"${source.deletedColumn}" IS NULL`);
  if (definition.propertyId) {
    params.push(definition.propertyId);
    // A tenant-wide row (property_id IS NULL) belongs to every site's view of
    // itself — excluding it would make a two-site business's numbers not add up.
    where.push(`("property_id" = $${String(params.length)} OR "property_id" IS NULL)`);
  }
  const dateClause = compileDateRange(source, definition.dateRange, params);
  if (dateClause) where.push(dateClause);
  where.push(compileGroup(source, definition.filters, params));

  const selects = definition.measures.map((m, i) => compileMeasure(source, m, i));
  const columns = definition.measures.map((m, i) => ({
    key: `m${String(i)}`,
    label: measureLabel(definition.objectKey, m),
  }));

  let groupSql = '';
  let orderSql = '';
  if (definition.groupBy) {
    const field = resolveField(source, definition.groupBy.field);
    const bucket = definition.groupBy.bucket;
    if (bucket && field.kind !== 'date') {
      throw new CrmValidationError(
        `“${field.label}” is not a date, so it cannot be grouped by ${bucket}.`,
        [{ field: 'groupBy', message: 'bucket requires a date field' }]
      );
    }
    // A raw date column groups to one row per instant — thousands of rows of 1.
    // Defaulting to month is kinder than an error: the intent is obvious.
    const effectiveBucket: DateBucket | undefined =
      field.kind === 'date' ? (bucket ?? 'month') : undefined;
    const expr = effectiveBucket
      ? `DATE_TRUNC('${BUCKET_SQL[effectiveBucket]}', ${field.sql})`
      : field.sql;

    selects.unshift(`${expr} AS "g0"`);
    columns.unshift({ key: 'g0', label: field.label });
    groupSql = ' GROUP BY 1';
    // Time reads forwards; everything else reads biggest-first, which is what a
    // person scanning a breakdown is looking for.
    orderSql = effectiveBucket ? ' ORDER BY 1 ASC' : ' ORDER BY 2 DESC NULLS LAST';
  }

  params.push(limit);
  const sql =
    `SELECT ${selects.join(', ')} FROM "${source.table}"` +
    ` WHERE ${where.join(' AND ')}` +
    groupSql +
    orderSql +
    ` LIMIT $${String(params.length)}`;

  return { sql, params, columns, grouped: Boolean(definition.groupBy) };
}

/* ── Running it ─────────────────────────────────────────────────────────── */

export interface ReportResult {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  grouped: boolean;
  /** True when the row cap was reached — the surface says so rather than
   *  presenting a truncated total as if it were the whole answer. */
  truncated: boolean;
}

/**
 * Run a compiled report inside the tenant's RLS session.
 *
 * `$queryRawUnsafe` names the danger honestly: the STATEMENT is assembled here
 * from a static identifier map, and every VALUE is a bind parameter. Nothing a
 * tenant typed reaches the statement text.
 */
export async function runReport(
  ctx: ServiceContext,
  definition: ReportDefinition,
  limit = 200
): Promise<ReportResult> {
  const compiled = compileReport(definition, limit);
  const rows = await withTenant(ctx, (tx) =>
    (tx as unknown as typeof prisma).$queryRawUnsafe<Record<string, unknown>[]>(
      compiled.sql,
      ...compiled.params
    )
  );
  return {
    columns: compiled.columns,
    rows,
    grouped: compiled.grouped,
    truncated: rows.length >= limit,
  };
}
