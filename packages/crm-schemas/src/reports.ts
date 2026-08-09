// Report definitions (docs/144 §8).
//
// A report answers ONE sentence: "how many <objects> [broken down by <thing>],
// where <filters>, over <period>". Everything here is the vocabulary of that
// sentence, and the surface asks it in those words — never "measure",
// "dimension" or "aggregate", which are the words of a tool that expects you to
// have used one before.
//
// The filter DSL is `ConditionGroup` from @sparx/automation-schemas, verbatim.
// Reusing it is deliberate: a business that has written one automation condition
// already knows how to filter a report, and there is one evaluator, one builder
// component and one set of bugs rather than two.

import { z } from 'zod';
import { ConditionGroup } from '@sparx/automation-schemas';

/* ── What you want to count ─────────────────────────────────────────────── */

/**
 * The five things worth working out about a column of values.
 *
 * `count` is the only one that takes no field — everything else needs to know
 * WHAT to add up, so the refinement below enforces that rather than leaving a
 * sum-of-nothing to mean zero.
 */
export const MeasureFn = z.enum(['count', 'sum', 'avg', 'min', 'max']);
export type MeasureFn = z.infer<typeof MeasureFn>;

export const Measure = z
  .object({
    fn: MeasureFn,
    /** Property path on the object. Omitted only for `count`. */
    field: z.string().min(1).max(120).optional(),
    /** What to call this column. Defaults to a phrase built from fn + field. */
    label: z.string().min(1).max(80).optional(),
  })
  .superRefine((measure, ctx) => {
    if (measure.fn !== 'count' && !measure.field) {
      ctx.addIssue({
        code: 'custom',
        path: ['field'],
        message: `“${measure.fn}” needs to know which value to work out — pick a field.`,
      });
    }
  });
export type Measure = z.infer<typeof Measure>;

/* ── How you want it broken down ────────────────────────────────────────── */

/**
 * Date bucketing. A date column grouped raw produces one row per DAY-WITH-A-TIME
 * — thousands of rows, each with a count of 1, which is not a breakdown but a
 * list. Bucketing is what makes a date groupable at all, so it is required
 * whenever the field is a date and meaningless otherwise.
 */
export const DateBucket = z.enum(['day', 'week', 'month', 'quarter', 'year']);
export type DateBucket = z.infer<typeof DateBucket>;

export const GroupBy = z.object({
  field: z.string().min(1).max(120),
  bucket: DateBucket.optional(),
});
export type GroupBy = z.infer<typeof GroupBy>;

/* ── Over what period ───────────────────────────────────────────────────── */

/**
 * Relative by default, absolute when asked.
 *
 * `last_n_days` rather than a stored from/to is what makes a dashboard worth
 * pinning: "the last 30 days" is still true tomorrow, where a frozen range
 * quietly becomes a historical document that nobody notices has stopped moving.
 */
export const DateRange = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('last_n_days'), days: z.number().int().min(1).max(3650) }),
  z.object({
    kind: z.literal('between'),
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
]);
export type DateRange = z.infer<typeof DateRange>;

/* ── How you want to see it ─────────────────────────────────────────────── */

export const Visualization = z.enum(['table', 'bar', 'line', 'pie', 'funnel', 'number']);
export type Visualization = z.infer<typeof Visualization>;

/**
 * Which shapes actually make sense for a given definition.
 *
 * Enforced rather than advisory, because the failure is silent: a pie chart of
 * an ungrouped count renders one wedge covering 100% of itself, which looks like
 * a working chart and tells you nothing. The builder uses this to grey out the
 * choices instead of letting somebody find out later.
 */
export function allowedVisualizations(hasGroupBy: boolean, measureCount: number): Visualization[] {
  if (!hasGroupBy) {
    // One row. A single number is the honest rendering; a table of one row is
    // also legitimate when there are several measures side by side.
    return measureCount > 1 ? ['number', 'table'] : ['number', 'table'];
  }
  // Pie and funnel divide ONE total between categories, so a second measure has
  // nowhere to go on them.
  return measureCount > 1 ? ['table', 'bar', 'line'] : ['table', 'bar', 'line', 'pie', 'funnel'];
}

/* ── The definition ─────────────────────────────────────────────────────── */

const ReportBody = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullish(),
  objectKey: z.string().min(2).max(63),
  filters: ConditionGroup.default({ logic: 'AND', conditions: [] }),
  groupBy: GroupBy.nullish(),
  measures: z.array(Measure).min(1).max(8),
  visualization: Visualization.default('table'),
  dateRange: DateRange.default({ kind: 'all' }),
  propertyId: z.string().uuid().nullish(),
  shared: z.boolean().default(false),
};

/** Reject a visualization the definition cannot actually draw. Shared by create
 *  and update so neither can store a combination the runner would have to guess
 *  its way out of. */
function checkVisualization(
  value: { visualization?: Visualization; groupBy?: GroupBy | null; measures?: Measure[] },
  ctx: z.RefinementCtx
): void {
  if (!value.visualization || !value.measures) return;
  const allowed = allowedVisualizations(Boolean(value.groupBy), value.measures.length);
  if (!allowed.includes(value.visualization)) {
    ctx.addIssue({
      code: 'custom',
      path: ['visualization'],
      message: value.groupBy
        ? `A ${value.visualization} chart cannot show ${String(value.measures.length)} things at once — use a table or a bar chart.`
        : `A ${value.visualization} chart needs a breakdown — choose what to break the results down by first.`,
    });
  }
}

export const CreateReportInput = z.object(ReportBody).superRefine(checkVisualization);
export type CreateReportInput = z.infer<typeof CreateReportInput>;

// `.partial()` on the raw shape, then re-declare the defaulted fields as plain
// optionals: zod keeps a `.default()` through `.partial()`, so a patch that
// never mentioned `filters` would otherwise arrive carrying the empty group and
// silently wipe the report's filters.
export const UpdateReportInput = z
  .object(ReportBody)
  .partial()
  .extend({
    filters: ConditionGroup.optional(),
    visualization: Visualization.optional(),
    dateRange: DateRange.optional(),
    shared: z.boolean().optional(),
  })
  .superRefine(checkVisualization);
export type UpdateReportInput = z.infer<typeof UpdateReportInput>;

/* ── Dashboards ─────────────────────────────────────────────────────────── */

export const WidgetPlacement = z.object({
  reportId: z.string().uuid(),
  x: z.number().int().min(0).max(11).default(0),
  y: z.number().int().min(0).max(500).default(0),
  w: z.number().int().min(1).max(12).default(6),
  h: z.number().int().min(1).max(24).default(4),
  title: z.string().trim().min(1).max(160).nullish(),
});
export type WidgetPlacement = z.infer<typeof WidgetPlacement>;

const DashboardBody = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullish(),
  propertyId: z.string().uuid().nullish(),
  isDefault: z.boolean().default(false),
  shared: z.boolean().default(false),
};

export const CreateDashboardInput = z.object(DashboardBody);
export type CreateDashboardInput = z.infer<typeof CreateDashboardInput>;

export const UpdateDashboardInput = z
  .object(DashboardBody)
  .partial()
  .extend({ isDefault: z.boolean().optional(), shared: z.boolean().optional() });
export type UpdateDashboardInput = z.infer<typeof UpdateDashboardInput>;

/** The whole layout in one write. A drag-and-drop grid moves several widgets at
 *  once (dropping one pushes its neighbours), so saving them individually would
 *  leave the board briefly overlapping and race a concurrent editor. */
export const SetWidgetsInput = z.object({
  widgets: z.array(WidgetPlacement).max(50),
});
export type SetWidgetsInput = z.infer<typeof SetWidgetsInput>;

/* ── Running one ────────────────────────────────────────────────────────── */

export const RunReportQuery = z.object({
  /** Overrides the saved range without editing the report — what a dashboard's
   *  own period switcher sends. */
  dateRange: DateRange.optional(),
  limit: z.number().int().min(1).max(1000).default(200),
});
export type RunReportQuery = z.infer<typeof RunReportQuery>;
