// Run + per-step history logging (docs/81 §6, §7; docs/144 §9).
//
// Every step a run executes leaves an `automation_run_steps` row in its terminal
// state, including the `gate_log` audit trail. `gated` (policy-blocked) is a
// distinct, first-class status — never conflated with `failed` or `skipped`.
// All writes are tenant-scoped (the caller passes the tenant tx + tenantId,
// since `automation_run_steps` carries its own `tenant_id` for FORCE RLS).
//
// Each recorder takes an optional `path` — where the step sits in the AUTHORED
// tree (`2`, `2.then.0`). The engine resumes from the compiled index; the path is
// what a person reads, and without it a branching rule's history is a list of
// numbers that no longer line up with the rule on screen.

import type { GateLogEntry } from '@wizeworks/automation-schemas';
import type { Prisma, TxClient } from '@wizeworks/db';

interface StepKey {
  runId: string;
  tenantId: string;
  index: number;
  actionType: string;
}

const asJson = (v: unknown): Prisma.InputJsonValue => (v ?? null) as Prisma.InputJsonValue;
const gateJson = (log: GateLogEntry[]): Prisma.InputJsonValue => log;

/** The columns every step row shares. `path` is omitted (not nulled) when absent
 *  so a caller that doesn't know the authored position leaves the column alone. */
function stepBase(key: StepKey, path: string | undefined, now: Date) {
  return {
    runId: key.runId,
    tenantId: key.tenantId,
    actionIndex: key.index,
    actionType: key.actionType,
    ...(path === undefined ? {} : { path }),
    startedAt: now,
    completedAt: now,
  };
}

export async function recordStepCompleted(
  tx: TxClient,
  key: StepKey,
  output: unknown,
  gateLog: GateLogEntry[],
  path?: string
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      ...stepBase(key, path, now),
      status: 'completed',
      output: asJson(output),
      gateLog: gateJson(gateLog),
    },
  });
}

export async function recordStepGated(
  tx: TxClient,
  key: StepKey,
  reason: string,
  gateLog: GateLogEntry[],
  path?: string
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      ...stepBase(key, path, now),
      status: 'gated',
      error: reason,
      gateLog: gateJson(gateLog),
    },
  });
}

export async function recordStepFailed(
  tx: TxClient,
  key: StepKey,
  error: string,
  path?: string
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      ...stepBase(key, path, now),
      status: 'failed',
      error: error.slice(0, 4_000),
    },
  });
}

/** A control-flow step (platform.wait parked / platform.stop / a branch that
 *  chose an arm) — recorded `completed` with the control output, so run history
 *  shows the decision as well as the effects it led to. */
export async function recordStepControl(
  tx: TxClient,
  key: StepKey,
  output: unknown,
  path?: string
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      ...stepBase(key, path, now),
      status: 'completed',
      output: asJson(output),
    },
  });
}

/** Mark a run finished and bump the automation's success counters. `reason` is
 *  set only when the run stopped for a nameable reason (a `platform.stop`), not
 *  on a plain run-to-the-end. */
export async function completeRun(
  tx: TxClient,
  runId: string,
  automationId: string,
  reason?: string
): Promise<void> {
  const now = new Date();
  await tx.automationRun.update({
    where: { id: runId },
    data: {
      status: 'completed',
      completedAt: now,
      ...(reason === undefined ? {} : { exitReason: reason.slice(0, 255) }),
    },
  });
  await tx.automation.update({
    where: { id: automationId },
    data: { runCount: { increment: 1 }, lastRunAt: now },
  });
}

/**
 * Mark a run CONVERTED — it stopped because the automation's goal was met
 * (docs/144 §9).
 *
 * Counted as a run (`run_count` increments, exactly as a completion does) but
 * kept apart in `status`, because the whole value of a goal is being able to ask
 * "of everyone this enrolled, how many actually did the thing" — a question that
 * disappears the moment converted and completed share a value.
 */
export async function convertRun(tx: TxClient, runId: string, automationId: string): Promise<void> {
  const now = new Date();
  await tx.automationRun.update({
    where: { id: runId },
    data: {
      status: 'converted',
      completedAt: now,
      goalMetAt: now,
      exitReason: 'goal_met',
    },
  });
  await tx.automation.update({
    where: { id: automationId },
    data: { runCount: { increment: 1 }, lastRunAt: now },
  });
}

/** Mark a run failed (an action threw) and bump the automation's error counters.
 *  A single failed run does NOT flip the automation's own status to `error` —
 *  that pause-on-repeated-failure policy is a later (UI) slice. */
export async function failRun(
  tx: TxClient,
  runId: string,
  automationId: string,
  message: string
): Promise<void> {
  const now = new Date();
  await tx.automationRun.update({
    where: { id: runId },
    data: { status: 'failed', completedAt: now, errorMessage: message.slice(0, 4_000) },
  });
  await tx.automation.update({
    where: { id: automationId },
    data: { errorCount: { increment: 1 }, lastErrorAt: now },
  });
}
