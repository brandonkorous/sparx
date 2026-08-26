'use client';

// WHAT IS IN THE FILE — read here, before anything is sent anywhere.
//
// Split out of migration-run.tsx, which owned the whole errand. This half answers
// one question: what did we find, and what is wrong with it? It never writes and
// never talks to the server — everything below runs against rows the browser
// parsed, which is what lets a file that cannot be read be rejected in the same
// second it is dropped.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';

import { summarize, type MappedEntity, type ValidationIssue } from '@wizeworks/migration';
import { ColumnMapper } from './column-mapper';
import { entityLabel, sentenceList, type LoadedFile } from './data';

/** One validation issue, written for the person who has to fix it. */
function IssueRow({ issue }: { issue: ValidationIssue }) {
  const isError = issue.severity === 'error';
  return (
    <div className="border-base-300 flex items-start gap-3 border-b py-2 last:border-b-0">
      <Badge color={isError ? 'danger' : 'warning'} variant="soft" size="sm" className="mt-0.5">
        {isError ? 'Must fix' : 'Note'}
      </Badge>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text className="text-sm">
          {issue.rowIndex >= 0 ? `Row ${issue.rowIndex + 2}: ` : ''}
          {issue.message}
        </Text>
        {issue.hint !== undefined ? <Text className="text-sm">{issue.hint}</Text> : null}
      </div>
    </div>
  );
}

/**
 * One entity's findings, before anything is written.
 *
 * Shared by the file path and the live connection, which is what stops the two
 * drifting into two different accounts of the same data.
 */
export function EntityReport({ mapped }: { mapped: MappedEntity }) {
  const { entity, rows, report } = mapped;

  return (
    <section className="border-base-300 bg-base-100 flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} className="text-base">
          {entityLabel(entity)}
        </Heading>
        <Badge
          color={report.blocked ? 'danger' : report.errorCount > 0 ? 'warning' : 'success'}
          variant="soft"
          size="sm"
        >
          {report.blocked
            ? 'Cannot import yet'
            : `${report.okCount.toLocaleString()} of ${rows.length.toLocaleString()} ready`}
        </Badge>
      </div>

      <Text>{summarize(report)}</Text>

      {report.issues.length > 0 ? (
        <div className="border-base-300 mt-1 max-h-64 overflow-y-auto rounded-lg border px-3">
          {report.issues.slice(0, 100).map((issue, index) => (
            <IssueRow key={`${issue.code}-${issue.rowIndex}-${index}`} issue={issue} />
          ))}
        </div>
      ) : null}

      {report.truncated ? (
        <Text className="text-sm">
          Showing the first {report.issues.length} of {report.errorCount + report.warningCount}.
          Fixing the ones above usually fixes the rest.
        </Text>
      ) : null}

      {report.unmappedColumns.length > 0 ? (
        <Text className="text-sm">
          {report.unmappedColumns.length} column
          {report.unmappedColumns.length === 1 ? '' : 's'} in this file have no home here and will
          be left behind: {report.unmappedColumns.slice(0, 6).join(', ')}
          {report.unmappedColumns.length > 6 ? '…' : ''}
        </Text>
      ) : null}
    </section>
  );
}

/** What we found in the file, per entity, before anything is sent. */
export function FileReport({
  loaded,
  onManual,
}: {
  loaded: LoadedFile;
  onManual: (mapped: MappedEntity | null) => void;
}) {
  const { result } = loaded;

  // Nothing recognised it, or nothing recognised it WELL ENOUGH — which is not a
  // dead end. Every other importer stops here; this one asks two questions and
  // carries on. A guess presented as fact is worse than no guess: the vendor whose
  // name went on the banner also supplies the column map, and a map built for a
  // different file reads the four columns it knows and drops the rest in silence.
  if (result.detected === null || !result.sure) {
    if (result.headers.length === 0) {
      return (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>There are no columns in this file</AlertTitle>
            <AlertDescription>
              It may be empty, or it may not be a spreadsheet at all. Export it again from your old
              platform and try once more.
            </AlertDescription>
          </AlertContent>
        </Alert>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {result.detected !== null ? (
          <Alert color="info" variant="soft">
            <AlertContent>
              <AlertTitle>
                Is this a {result.detected.vendorName} {result.detected.label.toLowerCase()} export?
              </AlertTitle>
              <AlertDescription>
                It {sentenceList(result.detected.reasons)} — and plenty of files do, so we would
                only be guessing. Say what your own columns are below and every one of them comes
                across.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}
        <ColumnMapper headers={result.headers} raw={result.raw} onChange={onManual} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert color="success" variant="soft">
        <AlertContent>
          <AlertTitle>
            This is a {result.detected.vendorName} {result.detected.label.toLowerCase()} export
          </AlertTitle>
          <AlertDescription>
            We can tell because it {sentenceList(result.detected.reasons)}.
          </AlertDescription>
        </AlertContent>
      </Alert>

      {result.entities.map((mapped) => (
        <EntityReport key={mapped.entity} mapped={mapped} />
      ))}
    </div>
  );
}
