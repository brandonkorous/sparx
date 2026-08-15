'use client';

// "Is this rule working?" (docs/144 §9) — the funnel and where people fall out.
//
// ══════════════════════════════════════════════════════════════════════════
// WHY THIS IS NOT THE RUN LIST
// ══════════════════════════════════════════════════════════════════════════
//
// The run list answers "did it fire" — a hundred rows, all green, all saying the
// same thing. This answers the question the owner actually has, which is whether
// any of that firing DID anything. The two are separate surfaces because they are
// separate questions, and because the honest answer to the second is sometimes
// "you have not told me what success is" — which the run list has no way to say.
//
// THE HEADLINE NUMBER IS THE CONVERSION RATE, and it is deliberately absent
// rather than zero when no goal is set. A big grey 0% would read as "this rule
// never works"; what is true is that nothing has been measured, and the surface
// says so and offers to fix it.

import { Badge, Card, Heading, Table, Text } from '@wizeworks/silicaui-react';
import { Target, TrendingDown } from 'lucide-react';
import { actionLabel } from './automations-catalog';
import { useEnrollment, type EnrollmentAnalytics, type StepDropOff } from './automations-data';
import { productCopyWith } from '../../lib/product';

/** Seconds → the coarsest unit that still says something useful. "2 days" is a
 *  better answer than "173,000 seconds", and nobody needs the minutes. */
function humanDuration(seconds: number): string {
  if (seconds < 90) return `${String(Math.round(seconds))} seconds`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${String(Math.round(minutes))} minutes`;
  const hours = minutes / 60;
  if (hours < 48) return `${String(Math.round(hours))} hours`;
  return `${String(Math.round(hours / 24))} days`;
}

type StatTone = 'module' | 'success' | 'warning' | 'error' | 'neutral' | 'info';

/** Written out rather than interpolated: Tailwind scans source text for class
 *  names, so a `text-${tone}` template produces a class that exists in the DOM
 *  and in no stylesheet — the number renders in the inherited ink and the tone
 *  silently does nothing. */
const STAT_INK: Record<StatTone, string> = {
  module: 'text-module',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
  neutral: 'text-base-content',
};

/** One number in the funnel row. `tone` carries the meaning, so the label does
 *  not have to spell out whether a number is good news. */
function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: StatTone;
  hint?: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 p-4">
      <Text className="text-sm">{label}</Text>
      <span className={`text-3xl font-semibold ${STAT_INK[tone]}`}>{value}</span>
      {hint ? <Text className="text-sm">{hint}</Text> : null}
    </Card>
  );
}

function Funnel({ data }: { data: EnrollmentAnalytics }) {
  const { funnel, hasGoal } = data;

  return (
    <div className="flex flex-col gap-4">
      {hasGoal ? (
        <Card className="border-module/30 bg-module/10 flex flex-col gap-1 p-5">
          <Text className="text-base">Of everyone this reached</Text>
          <span className="text-module text-5xl font-semibold">
            {funnel.conversionRate === null ? '—' : `${String(funnel.conversionRate)}%`}
          </span>
          <Text className="text-base">
            did what you were aiming for
            {funnel.medianSecondsToGoal !== null
              ? ` — usually within ${humanDuration(funnel.medianSecondsToGoal)}`
              : ''}
            .
          </Text>
        </Card>
      ) : (
        <Card className="border-warning/40 bg-warning/10 flex items-start gap-3 p-5">
          <Target className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <Heading level={3} className="text-lg font-semibold">
              You haven’t said what you’re aiming for
            </Heading>
            <Text className="text-base">
              {productCopyWith(
                'automations.noGoal',
                `This rule has run ${funnel.entered.toLocaleString()} times. Whether any of that did what you wanted is not something Piggles can work out on its own — set a goal on the rule and this becomes a number.`,
                { runs: funnel.entered.toLocaleString() }
              )}
            </Text>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-6">
        <Stat
          label="Started"
          value={funnel.entered.toLocaleString()}
          tone="module"
          hint="Times this rule picked somebody up"
        />
        <Stat
          label="Still going"
          value={funnel.active.toLocaleString()}
          tone="info"
          hint="Part-way through, or waiting"
        />
        <Stat
          label="Got there"
          value={funnel.converted.toLocaleString()}
          tone="success"
          hint="Did what you were aiming for"
        />
        <Stat
          label="Ran out of steps"
          value={funnel.completed.toLocaleString()}
          tone="neutral"
          hint="Finished without getting there"
        />
        <Stat
          label="Stopped early"
          value={funnel.exited.toLocaleString()}
          tone="warning"
          hint="A “stop here” step ended it"
        />
        <Stat
          label="Went wrong"
          value={funnel.failed.toLocaleString()}
          tone="error"
          hint="A step errored"
        />
      </div>
    </div>
  );
}

/** The step whose drop-off is worst — what an author should look at first.
 *  Ignores the last step, where "dropping off" means "finished". */
function worstStep(steps: StepDropOff[]): StepDropOff | null {
  const candidates = steps.slice(0, -1).filter((s) => s.reached >= 5);
  if (candidates.length === 0) return null;
  const worst = candidates.reduce((a, b) => (b.dropOffRate > a.dropOffRate ? b : a));
  // Under a fifth is normal attrition on any multi-step rule; calling it out
  // would train people to ignore this panel.
  return worst.dropOffRate >= 20 ? worst : null;
}

function StepTable({ steps }: { steps: StepDropOff[] }) {
  const worst = worstStep(steps);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Heading level={3} className="text-lg font-semibold">
          Where people fall out
        </Heading>
        {worst ? (
          <Badge color="warning" variant="soft">
            {worst.dropOffRate}% stop after “{actionLabel(worst.actionType)}”
          </Badge>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <Table size="sm" hover>
          <thead>
            <tr>
              <th>Step</th>
              <th>Reached it</th>
              <th>Finished it</th>
              <th>Skipped</th>
              <th>Failed</th>
              <th>Stopped here</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, i) => {
              const last = i === steps.length - 1;
              const inBranch = step.path?.includes('.') ?? false;
              return (
                <tr key={`${String(step.index)}-${step.actionType}`}>
                  <td>
                    <span className="flex min-w-0 flex-col items-start gap-1">
                      <span className="truncate font-medium">{actionLabel(step.actionType)}</span>
                      {inBranch ? (
                        <Badge color="module" variant="soft" size="sm">
                          {step.path?.includes('.then.') ? 'inside “if yes”' : 'inside “if no”'}
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td>{step.reached.toLocaleString()}</td>
                  <td>{step.completed.toLocaleString()}</td>
                  <td>
                    {step.gated > 0 ? (
                      <Badge color="warning" variant="soft" size="sm">
                        {step.gated.toLocaleString()}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {step.failed > 0 ? (
                      <Badge color="error" variant="soft" size="sm">
                        {step.failed.toLocaleString()}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {/* The last step has no successor, so everybody who reached it
                        "stopped" there — which is where a rule is meant to end. */}
                    {last ? (
                      <Text className="text-sm">the end</Text>
                    ) : step.dropOffRate >= 20 ? (
                      <Badge color="warning" variant="soft" size="sm">
                        {step.dropOffRate}%
                      </Badge>
                    ) : (
                      `${String(step.dropOffRate)}%`
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

export function EnrollmentPanel({ automationId }: { automationId: string }) {
  const { data, isPending, isError } = useEnrollment(automationId);

  if (isPending) {
    return <Text className="text-base">Working out how this rule has been doing…</Text>;
  }
  if (isError || !data) {
    return <Text className="text-base">Could not load this rule’s results.</Text>;
  }
  if (data.funnel.entered === 0) {
    return (
      <Card className="flex items-start gap-3 p-5">
        <TrendingDown className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <Heading level={3} className="text-lg font-semibold">
            This hasn’t run yet
          </Heading>
          <Text className="text-base">
            Once it starts picking people up, this is where you’ll see how many of them do what you
            were after — and which step loses the most.
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Funnel data={data} />
      {data.steps.length > 0 ? <StepTable steps={data.steps} /> : null}
    </div>
  );
}
