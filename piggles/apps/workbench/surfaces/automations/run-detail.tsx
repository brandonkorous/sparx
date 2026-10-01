'use client';

// One run of a rule — read-only, the record of exactly what happened when it
// fired. It's a transaction view, so it keeps an identity heading (which rule,
// when) rather than an editable name.
//
// The heart of it is the step timeline: each action the run attempted, its
// result, and — crucially — its GATE LOG. A step marked "held back" is NOT a
// failure: a policy gate stopped that one effect and recorded why. Surfacing the
// gate decisions in plain rows is what makes the run auditable.

import { useEffect } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  Text,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { GateLogEntry } from '@wizeworks/automation-schemas';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { actionLabel } from './automations-catalog';
import { actionTypeDetail, runState, stepState } from './automations-presentation';
import { explainRunError, showsReported } from './run-errors';
import {
  useAutomation,
  useAutomationRun,
  type AutomationRunStepRow,
  type Tone,
} from './automations-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function gateDecisionTone(decision: string): Tone {
  switch (decision) {
    case 'allow':
      return 'success';
    case 'deny':
      return 'danger';
    case 'defer':
      return 'warning';
    case 'transform':
      return 'info';
    default:
      return 'neutral';
  }
}

function gateDecisionLabel(decision: string): string {
  switch (decision) {
    case 'allow':
      return 'Allowed';
    case 'deny':
      return 'Blocked';
    case 'defer':
      return 'Deferred';
    case 'transform':
      return 'Adjusted';
    default:
      return decision;
  }
}

function parseGateLog(raw: unknown): GateLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: GateLogEntry[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === 'object') {
      const e = entry as { gate?: unknown; decision?: unknown; reason?: unknown };
      if (typeof e.gate === 'string' && typeof e.decision === 'string') {
        out.push({
          gate: e.gate,
          decision: e.decision as GateLogEntry['decision'],
          ...(typeof e.reason === 'string' ? { reason: e.reason } : {}),
        });
      }
    }
  }
  return out;
}

/**
 * WHY ONE STEP DID NOT WORK.
 *
 * The engine's own wording is kept, labeled, under a sentence she can read —
 * she needs it to quote at us, and hiding it would trade one problem for
 * another. It is dropped only when the translation changed nothing, because
 * printing the identical sentence twice is what this screen used to do.
 */
function StepFailure({
  error,
  actionType,
  saidAbove,
}: {
  error: string;
  actionType: string;
  /** The banner at the top of the run already carries this exact sentence. */
  saidAbove: boolean;
}) {
  const explained = explainRunError(error, actionLabel(actionType));
  return (
    <div className="flex flex-col gap-1">
      {saidAbove ? null : <Text className="text-error text-sm">{explained.detail}</Text>}
      {showsReported(explained) ? (
        <Text className="text-sm">
          What it reported:{' '}
          <span className="font-mono text-xs break-all">{explained.reported}</span>
        </Text>
      ) : null}
    </div>
  );
}

function StepCard({ step, blamed }: { step: AutomationRunStepRow; blamed: boolean }) {
  const state = stepState(step.status);
  const gates = parseGateLog(step.gateLog);
  return (
    <div className="border-base-300 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-base-200 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {step.actionIndex + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-medium">
          {actionLabel(step.actionType)}
        </span>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </div>

      {/* Which app the step works in. It was the stored type in code type
          (`social.post`) under a heading that already named it (issue 905). */}
      <Text as="span" className="text-sm">
        {actionTypeDetail(step.actionType)}
      </Text>

      {/* The card's own heading already names the step, so only the reason and
          the engine's wording go here. See `run-errors`. */}
      {step.error ? (
        <StepFailure error={step.error} actionType={step.actionType} saidAbove={blamed} />
      ) : null}

      {gates.length > 0 ? (
        <div className="border-base-300 flex flex-col gap-1.5 border-t pt-2">
          <div className="flex items-center gap-1.5">
            <Icon glyph={faShieldCheck} className="size-3.5 shrink-0" aria-hidden />
            <Text as="span" className="text-sm font-medium">
              Policy checks
            </Text>
          </div>
          {gates.map((gate, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-2">
              <Badge color={gateDecisionTone(gate.decision)} variant="soft" size="sm">
                {gateDecisionLabel(gate.decision)}
              </Badge>
              <span className="font-mono text-xs">{gate.gate}</span>
              {gate.reason ? (
                <Text as="span" className="text-sm">
                  {gate.reason}
                </Text>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AutomationRunDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const automationId = typeof ctx.params.automationId === 'string' ? ctx.params.automationId : '';
  const runId = typeof ctx.params.runId === 'string' ? ctx.params.runId : '';

  const { data: automation } = useAutomation(automationId);
  const {
    data: run,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useAutomationRun(automationId, runId);

  useEffect(() => {
    if (run) ctx.setTitle(automation ? `${automation.name}: run` : 'Run');
  }, [ctx, run, automation]);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="run"
            title="Could not load this run"
            description="This is a problem reaching the server, or the run no longer exists."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !run) {
    return <PaneWaiting />;
  }

  const state = runState(run.status);
  const steps = [...run.steps].sort((a, b) => a.actionIndex - b.actionIndex);

  // The run's error is almost always one step's error copied up. Name that step
  // so the banner can say which one, and let the step card carry the engine's
  // wording — this screen printed the same raw string in both places.
  const blamed = run.errorMessage
    ? steps.find((s) => s.error !== null && s.error.trim() === run.errorMessage?.trim())
    : undefined;
  const failure = run.errorMessage
    ? explainRunError(run.errorMessage, blamed ? actionLabel(blamed.actionType) : null)
    : null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Run details"
        status={
          <>
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
            {run.automationVersion !== null ? (
              <Badge color="neutral" variant="outline" size="sm">
                v{run.automationVersion}
              </Badge>
            ) : null}
          </>
        }
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={run ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Text className="text-sm">
              Started <Timestamp value={run.startedAt} format="absolute" />
              {run.completedAt ? (
                <>
                  {' · '}Finished <Timestamp value={run.completedAt} format="relative" />
                </>
              ) : null}
            </Text>
          </div>

          <Alert color={run.status === 'failed' ? 'error' : state.tone} variant="soft">
            <AlertContent>
              <AlertTitle>{failure ? failure.headline : state.label}</AlertTitle>
              <AlertDescription>
                {failure ? failure.detail : state.detail}
                {/* No step card will carry the engine's wording, so it goes
                    here instead of nowhere. */}
                {failure && blamed === undefined && showsReported(failure) ? (
                  <>
                    <br />
                    What it reported:{' '}
                    <span className="font-mono text-xs break-all">{failure.reported}</span>
                  </>
                ) : null}
              </AlertDescription>
            </AlertContent>
          </Alert>

          <FormSection
            title="What happened, step by step"
            description="Each step this run attempted, in order. “Held back” means a safety check stopped that one step. It is not a failure of the run."
          >
            {steps.length === 0 ? (
              <Text className="text-sm">
                No steps were recorded: the run’s conditions may not have matched.
              </Text>
            ) : (
              <div className="flex flex-col gap-3">
                {steps.map((step) => (
                  <StepCard key={step.id} step={step} blamed={step.id === blamed?.id} />
                ))}
              </div>
            )}
          </FormSection>
        </div>
      </div>
    </div>
  );
}
