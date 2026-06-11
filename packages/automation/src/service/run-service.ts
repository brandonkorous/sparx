// Automation run-history READS (docs/81 §6, §7) — the tenant-facing read side of
// the run state machine. The engine WRITES runs/steps (`history/log.ts` + the
// ticks); this is the dashboard / MCP / REST read path: "what did this automation
// do, and did any step get gated or fail?" A run carries its ordered steps, each
// with its terminal status + `gate_log` audit trail.
//
// All reads are tenant-scoped via `withTenant` (FORCE RLS); the explicit
// `automationId` filter additionally scopes a run to its automation, so a run id
// belonging to another automation reads as absent.

import type { AutomationRun, AutomationRunStep } from '@prisma/client';
import { withTenant } from '@sparx/db';

import type { ServiceCtx } from './automation-service';

export interface ListRunsFilter {
  /** running | waiting | completed | failed | skipped */
  status?: string;
  /** Page size, clamped to [1, 200]. */
  limit?: number;
}

/** Recent runs for one automation, newest-started first. */
export async function listAutomationRuns(
  ctx: ServiceCtx,
  automationId: string,
  filter: ListRunsFilter = {}
): Promise<AutomationRun[]> {
  const take = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.automationRun.findMany({
      where: {
        automationId,
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take,
    })
  );
}

export interface AutomationRunWithSteps extends AutomationRun {
  steps: AutomationRunStep[];
}

/** A single run plus its ordered steps. Scoped to `automationId`, so a run id
 *  from a different automation (or tenant) resolves to null. */
export async function getAutomationRun(
  ctx: ServiceCtx,
  automationId: string,
  runId: string
): Promise<AutomationRunWithSteps | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const run = await tx.automationRun.findFirst({ where: { id: runId, automationId } });
    if (!run) return null;
    const steps = await tx.automationRunStep.findMany({
      where: { runId },
      orderBy: { actionIndex: 'asc' },
    });
    return { ...run, steps };
  });
}
