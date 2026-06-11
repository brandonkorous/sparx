// Run + per-step history logging (docs/81 §6, §7).
//
// Every step a run executes leaves an `automation_run_steps` row in its terminal
// state, including the `gate_log` audit trail. `gated` (policy-blocked) is a
// distinct, first-class status — never conflated with `failed` or `skipped`.
// All writes are tenant-scoped (the caller passes the tenant tx + tenantId,
// since `automation_run_steps` carries its own `tenant_id` for FORCE RLS).

import type { GateLogEntry } from '@sparx/automation-schemas';
import type { Prisma, TxClient } from '@sparx/db';

interface StepKey {
  runId: string;
  tenantId: string;
  index: number;
  actionType: string;
}

const asJson = (v: unknown): Prisma.InputJsonValue => (v ?? null) as Prisma.InputJsonValue;
const gateJson = (log: GateLogEntry[]): Prisma.InputJsonValue => log;

export async function recordStepCompleted(
  tx: TxClient,
  key: StepKey,
  output: unknown,
  gateLog: GateLogEntry[]
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      runId: key.runId,
      tenantId: key.tenantId,
      actionIndex: key.index,
      actionType: key.actionType,
      status: 'completed',
      output: asJson(output),
      gateLog: gateJson(gateLog),
      startedAt: now,
      completedAt: now,
    },
  });
}

export async function recordStepGated(
  tx: TxClient,
  key: StepKey,
  reason: string,
  gateLog: GateLogEntry[]
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      runId: key.runId,
      tenantId: key.tenantId,
      actionIndex: key.index,
      actionType: key.actionType,
      status: 'gated',
      error: reason,
      gateLog: gateJson(gateLog),
      startedAt: now,
      completedAt: now,
    },
  });
}

export async function recordStepFailed(tx: TxClient, key: StepKey, error: string): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      runId: key.runId,
      tenantId: key.tenantId,
      actionIndex: key.index,
      actionType: key.actionType,
      status: 'failed',
      error: error.slice(0, 4_000),
      startedAt: now,
      completedAt: now,
    },
  });
}

/** A control-flow step (platform.wait parked / platform.stop) — recorded
 *  `completed` with the control output for run-history visibility. */
export async function recordStepControl(
  tx: TxClient,
  key: StepKey,
  output: unknown
): Promise<void> {
  const now = new Date();
  await tx.automationRunStep.create({
    data: {
      runId: key.runId,
      tenantId: key.tenantId,
      actionIndex: key.index,
      actionType: key.actionType,
      status: 'completed',
      output: asJson(output),
      startedAt: now,
      completedAt: now,
    },
  });
}

/** Mark a run finished and bump the automation's success counters. */
export async function completeRun(
  tx: TxClient,
  runId: string,
  automationId: string
): Promise<void> {
  const now = new Date();
  await tx.automationRun.update({
    where: { id: runId },
    data: { status: 'completed', completedAt: now },
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
