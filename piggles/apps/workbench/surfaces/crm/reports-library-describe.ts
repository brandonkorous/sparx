import {
  BUCKET_NOUN,
  describeDateRange,
  type ReportableObject,
  type SavedReport,
} from './report-builder-data';

/** Column path to the builder's words for it (a raw path never reaches people). */
export type FieldLabel = (objectKey: string, path: string) => string;

/**
 * One line saying what a report ANSWERS, built from its own parts. `fieldLabel`
 * is passed in because the breakdown is stored as a column path.
 */
export function describe(report: SavedReport, fieldLabel: FieldLabel) {
  const count = report.measures.length;
  const what =
    count === 1 && report.measures[0]?.fn === 'count'
      ? 'How many'
      : `${String(count)} thing${count === 1 ? '' : 's'} worked out`;
  // A date label heads a column ("Closed"), it is not a noun. When a date is
  // bucketed, the bucket IS the breakdown, so say the bucket.
  const by = report.groupBy
    ? report.groupBy.bucket
      ? `, broken down by ${BUCKET_NOUN[report.groupBy.bucket]}`
      : `, broken down by ${fieldLabel(report.objectKey, report.groupBy.field).toLowerCase()}`
    : '';
  // Without this, two reports that differ only in what they leave out read the same.
  const rules = report.filters.conditions.length;
  const narrowed = rules > 0 ? `, narrowed by ${String(rules)} rule${rules === 1 ? '' : 's'}` : '';
  return `${what}${by}${narrowed} · ${describeDateRange(report.dateRange)}`;
}

/** Column path to the words the builder shows for it, falling back to the path
 *  itself only when the catalog has not loaded yet. */
export function makeFieldLabel(objects: ReportableObject[]): FieldLabel {
  return (objectKey: string, path: string): string => {
    const object = objects.find((o) => o.objectKey === objectKey);
    return object?.fields.find((f) => f.path === path)?.label ?? path;
  };
}
