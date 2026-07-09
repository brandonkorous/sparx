// Run detail (docs/81 §7, §7.1) — one execution with its ordered per-step
// records: status, timing, input/output, error, and the gate_log audit trail
// (why each action ran, was gated/denied, transformed, or deferred). Read-only;
// enough to debug a failure without guessing.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { History } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Badge, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';
import type { GateLogEntry } from '@sparx/automation-schemas';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { RunWithStepsDto } from '../../../_lib/types';
import { RunStatusBadge, StepStatusBadge, formatTimestamp } from '../../../_lib/presentation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string; runId: string }>;
}

const GATE_DECISION_COLOR: Record<string, string> = {
  allow: 'success',
  deny: 'danger',
  transform: 'info',
  defer: 'warning',
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="bg-base-200 overflow-x-auto rounded-md p-3 font-mono text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function GateLog({ entries }: { entries: GateLogEntry[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-base-content/70 text-sm">Gate decisions</p>
      <ul className="flex flex-col gap-1">
        {entries.map((g, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge color={GATE_DECISION_COLOR[g.decision] ?? 'neutral'} variant="soft" size="sm">
              {g.decision}
            </Badge>
            <code className="font-mono text-xs">{g.gate}</code>
            {g.reason && <span className="text-base-content/70 text-sm">— {g.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AutomationRunDetailPage({ params }: PageProps) {
  const { id, runId } = await params;
  await requireSession();

  let run: RunWithStepsDto;
  try {
    run = await api.get<RunWithStepsDto>(`/v1/automations/${id}/runs/${runId}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<History className="h-5 w-5" />}
          title="Run detail"
          badge={<RunStatusBadge status={run.status} />}
          description={
            <Link href={`/automations/${id}/runs`} className="text-module text-sm hover:underline">
              ← Back to run history
            </Link>
          }
        />

        <Card>
          <CardBody>
            <CardTitle>Overview</CardTitle>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Meta label="Started" value={formatTimestamp(run.startedAt)} />
                <Meta
                  label="Completed"
                  value={run.completedAt ? formatTimestamp(run.completedAt) : 'In progress'}
                />
                <Meta label="Steps" value={String(run.actionsTotal)} />
                <Meta label="Cascade depth" value={String(run.causeDepth)} />
              </div>
              {run.errorMessage && <p className="text-danger text-sm">{run.errorMessage}</p>}
              <details>
                <summary className="text-base-content/70 cursor-pointer text-sm">
                  Trigger event
                </summary>
                <div className="mt-2">
                  <JsonBlock value={run.triggerEvent} />
                </div>
              </details>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          {run.steps.length === 0 ? (
            <p className="text-base-content/70 text-sm">No steps recorded for this run.</p>
          ) : (
            run.steps.map((step) => (
              <Card key={step.id}>
                <CardBody>
                  <CardTitle>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base-content/50 text-sm">
                        Step {step.actionIndex + 1}
                      </span>
                      <code className="font-mono text-sm">{step.actionType}</code>
                      <StepStatusBadge status={step.status} />
                    </span>
                  </CardTitle>
                  <div className="flex flex-col gap-3">
                    <p className="text-base-content/70 text-sm">
                      {formatTimestamp(step.startedAt)}
                      {step.completedAt ? ` → ${formatTimestamp(step.completedAt)}` : ''}
                    </p>
                    {step.error && <p className="text-danger text-sm">{step.error}</p>}
                    {step.gateLog && step.gateLog.length > 0 && <GateLog entries={step.gateLog} />}
                    {step.input !== null && step.input !== undefined && (
                      <details>
                        <summary className="text-base-content/70 cursor-pointer text-sm">
                          Input
                        </summary>
                        <div className="mt-2">
                          <JsonBlock value={step.input} />
                        </div>
                      </details>
                    )}
                    {step.output !== null && step.output !== undefined && (
                      <details>
                        <summary className="text-base-content/70 cursor-pointer text-sm">
                          Output
                        </summary>
                        <div className="mt-2">
                          <JsonBlock value={step.output} />
                        </div>
                      </details>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-base-content/70 text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
