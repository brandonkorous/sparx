'use client';

// WATCHING IT LAND — the run, once it has started.
//
// Split out of migration-run.tsx. Everything here is a read of the server's own
// account of the run: what came over, what did not, and why. The one thing it must
// never do is claim to be moving a business over during a PRACTICE run, which is the
// sentence a nervous person is watching for.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import type { CanonicalEntity } from '@wizeworks/migration';
import { faCheckCircle, faDownload, faSpinner } from '@fortawesome/pro-solid-svg-icons';

import { Icon } from '@piggles/ui';
import { ReportProblemButton } from '../../components/feedback/report-problem-button';
import { downloadText, entityLabel, problemsCsv, useMigrationRun } from './data';
import type { RunEntityRollup } from './data';
import { landedBreakdown, landedTotals, runHeadline } from './run-outcome';

/** One kind of record — how many landed, and how many of those were already here. */
function EntityCard({ entity, dryRun }: { entity: RunEntityRollup; dryRun: boolean }) {
  // The big number is new AND already-here added together, which is the one number
  // that cannot tell an import from an overwrite. It stays, because it answers "did
  // my file go through"; the line under it answers "what did it do".
  const breakdown = landedBreakdown(entity, dryRun);

  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <Heading level={3} className="text-base">
          {entityLabel(entity.entity)}
        </Heading>
        {entity.done ? (
          <Icon glyph={faCheckCircle} className="text-success size-4" aria-hidden />
        ) : (
          <Icon glyph={faSpinner} className="size-4 animate-spin" aria-hidden />
        )}
      </div>
      <Text className="text-2xl font-semibold tabular-nums">
        {(entity.imported + entity.updated).toLocaleString()}
      </Text>
      <Text className="text-sm">
        of {entity.rowCount.toLocaleString()} {dryRun ? 'would come over' : 'brought over'}
        {entity.errors > 0 ? ` · ${entity.errors.toLocaleString()} need a look` : ''}
      </Text>
      {breakdown === null ? null : <Text className="text-sm">{breakdown}</Text>}
    </div>
  );
}

/** Live progress once the run has started. */
export function RunProgress({ runId }: { runId: string }) {
  const { data, isPending } = useMigrationRun(runId);

  if (isPending || data === undefined) return <Text>Starting…</Text>;

  const { run, problems } = data;
  const landed = landedTotals(run.entities);
  // What the run is CALLED lives in run-outcome, so the history list afterwards
  // cannot describe the same run differently from this screen.
  const headline = runHeadline(run, landed);

  return (
    <div className="flex flex-col gap-4">
      <Alert color={headline.tone} variant="soft">
        <AlertContent>
          <AlertTitle>{headline.title}</AlertTitle>
          <AlertDescription>{headline.description}</AlertDescription>
          {/* A part-landed migration is the worst thing to leave someone alone with:
              they can see a number that is wrong and have no way to know which half
              of their business is missing. The run id is what lets us answer that
              without asking them to describe it. */}
          {run.status === 'failed' ? (
            <ReportProblemButton
              className="mt-3 self-start"
              subject={`Part of my move from ${run.vendor ?? 'my old platform'} did not land`}
              details={[
                `Moving from: ${run.vendor ?? 'not recorded'}`,
                `Started: ${run.startedAt ?? 'unknown'}`,
                `Reference: ${runId}`,
                run.dryRun ? 'This was a practice run — nothing was being saved.' : '',
                '',
                'What happened per kind of record:',
                ...run.entities.map(
                  (entity) =>
                    `  ${entityLabel(entity.entity)}: ${(entity.imported + entity.updated).toLocaleString()} of ${entity.rowCount.toLocaleString()} came over (${entity.imported.toLocaleString()} new, ${entity.updated.toLocaleString()} already here), ${entity.errors.toLocaleString()} did not`
                ),
                ...(problems.length === 0
                  ? []
                  : [
                      '',
                      'First few problems:',
                      ...problems
                        .slice(0, 5)
                        .map(
                          (problem) =>
                            `  ${problem.naturalKey ?? `row ${problem.rowIndex + 2}`} — ${problem.message ?? 'no reason given'}`
                        ),
                    ]),
              ]
                .filter((line) => line !== '')
                .join('\n')}
            />
          ) : null}
        </AlertContent>
      </Alert>

      <div className="grid gap-3 @2xl:grid-cols-2">
        {run.entities.map((entity) => (
          <EntityCard key={entity.entity} entity={entity} dryRun={run.dryRun} />
        ))}
      </div>

      {problems.length > 0 ? (
        <section className="border-base-300 bg-base-100 flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading level={3} className="text-base">
              Worth knowing
            </Heading>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(`skipped-rows-${runId.slice(0, 8)}.csv`, problemsCsv(problems))
              }
            >
              <Icon glyph={faDownload} className="size-4" aria-hidden />
              Download this list
            </Button>
          </div>
          <div className="border-base-300 max-h-80 overflow-y-auto rounded-lg border px-3">
            {problems.map((problem, index) => (
              <div
                key={`${problem.entity}-${problem.rowIndex}-${index}`}
                className="border-base-300 flex items-start gap-3 border-b py-2 last:border-b-0"
              >
                <Badge
                  color={problem.status === 'error' ? 'danger' : 'info'}
                  variant="soft"
                  size="sm"
                  className="mt-0.5"
                >
                  {problem.status === 'error' ? 'Skipped' : 'Note'}
                </Badge>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text className="text-sm">
                    {problem.naturalKey !== null ? `${problem.naturalKey} — ` : ''}
                    {problem.message}
                  </Text>
                  <Text className="text-sm">
                    Row {problem.rowIndex + 2} of your{' '}
                    {entityLabel(problem.entity as CanonicalEntity).toLowerCase()} file
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
