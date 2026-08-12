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
// OBJECTS A TENANT INVENTED do not weaken that. They all live in ONE table,
// `crm_records`, keyed by `object_key` — so the identifiers stay static (the
// table, the record spine, the `values` bag) and the only thing that varies is a
// WHERE predicate whose value is BOUND like any other filter. What the compiler
// cannot know is whether such an object exists and what it is called; the caller
// resolves that from the object registry and passes a `CustomObjectSpec`, so an
// unrecognised key is still refused by name rather than answered with zero rows.
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
  /**
   * The site-scoping column, when the table HAS one. Absent means the record is
   * tenant-level and a site filter does not apply to it — writing one anyway
   * produces SQL naming a column that does not exist, which fails at run time
   * with a Postgres error rather than anything a person could act on.
   */
  siteColumn?: string;
  /** Where the tenant's own extra properties live. */
  customBag?: string;
  /**
   * A predicate that narrows the table to one object — the ONE part of a source
   * that is not static, because every tenant-invented object shares `crm_records`.
   * The column is ours; the value travels as a bind parameter like any filter.
   */
  scope?: { column: string; value: string };
  /** The tenant's DECLARED properties, by key. The compiler cannot know either
   *  half: without the label a header reads `seatsLeft`, and without the kind
   *  every property is text — so a Yes/No field is filtered with a text box and
   *  a price cannot be added up. */
  customFields?: Record<string, { label: string; kind: ColumnKind }>;
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
    siteColumn: 'property_id',
    customBag: 'custom_properties',
    label: 'Customer',
    labelPlural: 'Customers',
    columns: {
      id: { column: 'id', kind: 'uuid', label: 'Customer' },
      type: { column: 'type', kind: 'text', label: 'Kind of customer' },
      lifecycleStage: { column: 'lifecycle_stage', kind: 'text', label: 'Stage' },
      leadStatus: { column: 'lead_status', kind: 'text', label: 'Lead status' },
      // The field KEY stays 'company' — it is stored in saved report definitions
      // — while the column moved to company_name (docs/144 §11). This map is
      // exactly the layer that exists so one can change without the other.
      company: { column: 'company_name', kind: 'text', label: 'Company' },
      jobTitle: { column: 'job_title', kind: 'text', label: 'Job title' },
      assignedRepId: { column: 'assigned_rep_id', kind: 'uuid', label: 'Owner' },
      companyId: { column: 'company_id', kind: 'uuid', label: 'Company' },
      doNotContact: { column: 'do_not_contact', kind: 'boolean', label: 'Do not contact' },
      totalSpent: { column: 'total_spent', kind: 'currency', label: 'Lifetime spend' },
      orderCount: { column: 'order_count', kind: 'number', label: 'Orders' },
      createdAt: { column: 'created_at', kind: 'date', label: 'Added' },
      lastOrderAt: { column: 'last_order_at', kind: 'date', label: 'Last order' },
    },
  },
  company: {
    table: 'companies',
    timeColumn: 'created_at',
    deletedColumn: 'deleted_at',
    // No site column, deliberately: a company is a TENANT-level record. The same
    // firm trades with every site a business runs, so there is no per-site view
    // of it to scope to — and `companies` has no `property_id` to write.
    customBag: 'custom_properties',
    label: 'Company',
    labelPlural: 'Companies',
    columns: {
      id: { column: 'id', kind: 'uuid', label: 'Company' },
      companyName: { column: 'company_name', kind: 'text', label: 'Name' },
      status: { column: 'status', kind: 'text', label: 'Standing' },
      website: { column: 'website', kind: 'text', label: 'Website' },
      assignedRepId: { column: 'assigned_rep_id', kind: 'uuid', label: 'Owner' },
      pricingTierId: { column: 'pricing_tier_id', kind: 'uuid', label: 'Price level' },
      paymentTerms: { column: 'payment_terms', kind: 'text', label: 'Payment terms' },
      creditLimit: { column: 'credit_limit', kind: 'currency', label: 'Credit limit' },
      creditUsed: { column: 'credit_used', kind: 'currency', label: 'Credit used' },
      discountPercent: { column: 'discount_percent', kind: 'number', label: 'Discount %' },
      fleetSize: { column: 'fleet_size', kind: 'number', label: 'Fleet size' },
      createdAt: { column: 'created_at', kind: 'date', label: 'Added' },
      updatedAt: { column: 'updated_at', kind: 'date', label: 'Last changed' },
    },
  },
  deal: {
    table: 'deals',
    timeColumn: 'created_at',
    deletedColumn: 'deleted_at',
    siteColumn: 'property_id',
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
    siteColumn: 'property_id',
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
    siteColumn: 'property_id',
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

/**
 * What a tenant-invented object needs before it can be reported on: the words
 * for it, and what it calls its own fields. None of that is knowable here — it
 * lives in the object registry — so the caller resolves it and passes it in.
 *
 * The alternative was to synthesize a source for ANY key the compiler did not
 * recognise. That would have quietly turned "there is nothing to report on
 * called `contct`" into a report of zero rows: a typo answered with an empty
 * table instead of a sentence.
 */
export interface CustomObjectSpec {
  label: string;
  labelPlural: string;
}

/**
 * The tenant's own additions to whatever object is being reported on.
 *
 * Separate from `CustomObjectSpec` because the two answer different questions
 * and apply to different objects: `object` says "this key names something the
 * tenant invented", while `fields` describes declared properties — which a
 * BUILT-IN object has too. A contact's "renewal month" is exactly as declared,
 * and exactly as unknowable here, as a course's.
 */
export interface ReportProperties {
  /** Present only for a tenant-invented object. */
  object?: CustomObjectSpec;
  /** Declared property key → its label and its type. */
  fields?: Record<string, { label: string; kind: ColumnKind }>;
}

/**
 * A source over `crm_records` for one tenant-invented object.
 *
 * Every custom object shares one table, so the object is a WHERE predicate
 * rather than a table name — and the predicate's value is bound, not
 * interpolated, which is what keeps the static-identifier rule above intact.
 * The columns are the record spine; everything the tenant declared is in the
 * `values` bag and arrives as a `custom.<key>` path.
 */
function customSource(objectKey: string, spec: CustomObjectSpec): ObjectSource {
  return {
    table: 'crm_records',
    timeColumn: 'created_at',
    deletedColumn: 'deleted_at',
    siteColumn: 'property_id',
    customBag: 'values',
    scope: { column: 'object_key', value: objectKey },
    label: spec.label,
    labelPlural: spec.labelPlural,
    columns: CUSTOM_SPINE,
  };
}

/** The source for a definition, with the tenant's declared properties folded in
 *  — for a built-in object and a tenant-invented one alike. */
function sourceFor(definition: ReportDefinition): ObjectSource | undefined {
  const custom = definition.properties?.object;
  const base =
    SOURCES[definition.objectKey] ??
    (custom && OBJECT_KEY.test(definition.objectKey)
      ? customSource(definition.objectKey, custom)
      : undefined);
  if (!base) return undefined;
  const fields = definition.properties?.fields;
  return fields ? { ...base, customFields: fields } : base;
}

/** The five things every custom record has regardless of what it is. */
const CUSTOM_SPINE: Record<string, ColumnDef> = {
  id: { column: 'id', kind: 'uuid', label: 'Record' },
  title: { column: 'title', kind: 'text', label: 'Name' },
  ownerId: { column: 'owner_id', kind: 'uuid', label: 'Owner' },
  createdAt: { column: 'created_at', kind: 'date', label: 'Added' },
  updatedAt: { column: 'updated_at', kind: 'date', label: 'Last changed' },
};

/** True when the key names an object sparx ships, rather than one a tenant
 *  invented. The caller uses this to decide whether it must look up a spec. */
export function isBuiltinObject(objectKey: string): boolean {
  return objectKey in SOURCES;
}

/** Objects the builder offers, with the words a person uses for them. Built-ins
 *  only — the tenant's own are merged in by the caller, which is the layer that
 *  can read the registry. */
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

/**
 * A declared property schema, reduced to what a report can do with it.
 *
 * The mapping is deliberately lossy in one direction only: several field types
 * that LOOK different to a person (a choice, a link, an email, a linked record)
 * are all text to a report, because the only questions a report asks of them are
 * "how many" and "grouped by which". The types that map to something else —
 * number, money, yes/no, date — do so because those four change what the builder
 * offers and what the compiler will allow.
 *
 * `object` and `repeater` are omitted rather than mapped: they hold a structure,
 * not a value, and there is no honest single cell for one.
 */
export function reportableProperties(schema: {
  fields: { key: string; label: string; type: string; resultType?: 'number' | 'currency' }[];
}): Record<string, { label: string; kind: ColumnKind }> {
  const out: Record<string, { label: string; kind: ColumnKind }> = {};
  for (const field of schema.fields) {
    if (!CUSTOM_KEY.test(field.key)) continue;
    let kind: ColumnKind | null;
    switch (field.type) {
      case 'number':
        kind = 'number';
        break;
      case 'currency':
        kind = 'currency';
        break;
      case 'calculated':
        kind = field.resultType ?? 'number';
        break;
      case 'boolean':
        kind = 'boolean';
        break;
      case 'date':
      case 'datetime':
        kind = 'date';
        break;
      case 'object':
      case 'repeater':
        kind = null;
        break;
      default:
        kind = 'text';
    }
    if (kind) out[field.key] = { label: field.label, kind };
  }
  return out;
}

/** The spine fields of a tenant-invented object, in the builder's shape. Its
 *  declared properties are appended by the caller as `custom.<key>`. */
export function customSpineFields(): { path: string; label: string; kind: ColumnKind }[] {
  return Object.entries(CUSTOM_SPINE).map(([path, def]) => ({
    path,
    label: def.label,
    kind: def.kind,
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
/**
 * A custom-property key — the same rule `@sparx/field-schema` enforces on the
 * way in, which is what stops a JSONB path from carrying a quote out of the bag
 * and into the statement.
 *
 * It must MATCH that rule, not merely be stricter than it. This was lowercase-
 * only while field keys have always been camelCase, so every property whose name
 * had a capital in it — `seatsLeft`, `renewalMonth`, the shape the property
 * editor itself produces — answered "there is no field called that" on a report
 * a person had just built out of the field picker.
 */
const CUSTOM_KEY = /^[a-z][a-zA-Z0-9_]{0,62}$/;
/** An object key. snake_case, per `CustomObjectKey` in @sparx/crm-schemas. */
const OBJECT_KEY = /^[a-z][a-z0-9_]{1,62}$/;

interface ResolvedField {
  /** SQL fragment naming the value, already quoted/extracted. */
  sql: string;
  kind: ColumnKind;
  label: string;
}

/**
 * A declared property, read out of its JSONB bag AS THE TYPE IT WAS DECLARED.
 *
 * EVERY CAST IS GUARDED, and that is the whole design. A plain `(bag->>'k')::numeric`
 * throws for the entire query the first time one row holds something that is not
 * a number — and rows predating a field's type change are exactly that. Postgres
 * has no try_cast, so the guard is a `jsonb_typeof` (or a shape test) that turns
 * a value of the wrong type into NULL. A report then quietly ignores the rows it
 * cannot read instead of refusing to run at all, which is what a business owner
 * needs from a number they are looking at right now.
 *
 * Nothing here is interpolated but `key`, which has already passed CUSTOM_KEY,
 * and the bag column, which comes from a static source.
 */
function customSql(bag: string, key: string, kind: ColumnKind): string {
  const text = `"${bag}" ->> '${key}'`;
  const node = `"${bag}" -> '${key}'`;
  switch (kind) {
    case 'number':
      return `(CASE WHEN jsonb_typeof(${node}) = 'number' THEN (${text})::numeric END)`;
    case 'currency':
      // Money is stored `{amount, currency}` — a bare number would be an amount
      // with no unit, which is the thing that shape exists to prevent.
      return `(CASE WHEN jsonb_typeof(${node} -> 'amount') = 'number' THEN (${node} ->> 'amount')::numeric END)`;
    case 'boolean':
      return `(CASE WHEN jsonb_typeof(${node}) = 'boolean' THEN (${text})::boolean END)`;
    case 'date':
      // A date field stores an ISO string. The pattern is the guard: anything
      // that is not shaped like a date reads as unset rather than erroring.
      return `(CASE WHEN ${text} ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (${text})::timestamptz END)`;
    default:
      return text;
  }
}

function resolveField(source: ObjectSource, path: string): ResolvedField {
  if (path.startsWith(CUSTOM_PREFIX)) {
    const key = path.slice(CUSTOM_PREFIX.length);
    if (!source.customBag || !CUSTOM_KEY.test(key)) {
      throw new CrmValidationError(`There is no field called “${path}” on this record.`, [
        { field: 'field', message: `unknown property ${path}` },
      ]);
    }
    const declared = source.customFields?.[key];
    return {
      sql: customSql(source.customBag, key, declared?.kind ?? 'text'),
      kind: declared?.kind ?? 'text',
      label: declared?.label ?? key.replace(/_/g, ' '),
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
export function measureLabel(
  objectKey: string,
  measure: Measure,
  properties?: ReportProperties
): string {
  if (measure.label) return measure.label;
  const object = properties?.object;
  const source = SOURCES[objectKey] ?? (object ? customSource(objectKey, object) : undefined);
  if (measure.fn === 'count') return `How many ${source?.labelPlural.toLowerCase() ?? 'records'}`;
  const name = measure.field
    ? (source?.columns[measure.field]?.label ??
      // A declared property is named by the tenant, not by the spine above.
      properties?.fields?.[measure.field.replace(CUSTOM_PREFIX, '')]?.label ??
      measure.field)
    : '';
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
  /** What the tenant added — the object itself if they invented it, and its
   *  declared properties either way. Read from the object registry by the
   *  caller; see `ReportProperties`. */
  properties?: ReportProperties;
}

export interface CompiledReport {
  sql: string;
  params: unknown[];
  /** Column headers, in the order the rows carry them. */
  columns: { key: string; label: string }[];
  grouped: boolean;
}

export function compileReport(definition: ReportDefinition, limit: number): CompiledReport {
  // A custom object is only reportable once the caller has proved it exists and
  // said what it is called. The key still passes the same rule a JSONB path
  // does, so it can never carry a quote even though it is bound rather than
  // written into the statement.
  const source = sourceFor(definition);
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
  if (source.scope) {
    params.push(source.scope.value);
    where.push(`"${source.scope.column}" = $${String(params.length)}`);
  }
  if (definition.propertyId && source.siteColumn) {
    params.push(definition.propertyId);
    // A tenant-wide row (property_id IS NULL) belongs to every site's view of
    // itself — excluding it would make a two-site business's numbers not add up.
    where.push(
      `("${source.siteColumn}" = $${String(params.length)} OR "${source.siteColumn}" IS NULL)`
    );
  }
  const dateClause = compileDateRange(source, definition.dateRange, params);
  if (dateClause) where.push(dateClause);
  where.push(compileGroup(source, definition.filters, params));

  const selects = definition.measures.map((m, i) => compileMeasure(source, m, i));
  const columns = definition.measures.map((m, i) => ({
    key: `m${String(i)}`,
    label: measureLabel(definition.objectKey, m, definition.properties),
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
