// Run detail (docs/81 §7, §7.1) — one execution with its ordered per-step
// records: status, timing, input/output, error, and the gate_log audit trail
// (why each action ran, was gated/denied, transformed, or deferred). Read-only;
// enough to debug a failure without guessing.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { History } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';
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
    <pre className="overflow-x-auto rounded-md bg-[var(--color-bg-subtle)] p-3 font-mono text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function GateLog({ entries }: { entries: GateLogEntry[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Text size="sm" variant="muted">
        Gate decisions
      </Text>
      <ul className="flex flex-col gap-1">
        {entries.map((g, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge color={GATE_DECISION_COLOR[g.decision] ?? 'neutral'} variant="soft" size="sm">
              {g.decision}
            </Badge>
            <code className="font-mono text-xs">{g.gate}</code>
            {g.reason && (
              <Text size="sm" variant="muted">
                — {g.reason}
              </Text>
            )}
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
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<History className="h-5 w-5" />}
          title="Run detail"
          badge={<RunStatusBadge status={run.status} />}
          description={
            <Link
              href={`/automations/${id}/runs`}
              className="text-sm text-[var(--module-active)] hover:underline"
            >
              ← Back to run history
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Meta label="Started" value={formatTimestamp(run.startedAt)} />
              <Meta
                label="Completed"
                value={run.completedAt ? formatTimestamp(run.completedAt) : 'In progress'}
              />
              <Meta label="Steps" value={String(run.actionsTotal)} />
              <Meta label="Cascade depth" value={String(run.causeDepth)} />
            </div>
            {run.errorMessage && (
              <Text size="sm" variant="danger">
                {run.errorMessage}
              </Text>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)]">
                Trigger event
              </summary>
              <div className="mt-2">
                <JsonBlock value={run.triggerEvent} />
              </div>
            </details>
          </CardContent>
        </Card>

        <Stack gap={3}>
          {run.steps.length === 0 ? (
            <Text size="sm" variant="muted">
              No steps recorded for this run.
            </Text>
          ) : (
            run.steps.map((step) => (
              <Card key={step.id}>
                <CardHeader>
                  <CardTitle>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[var(--color-text-tertiary)]">
                        Step {step.actionIndex + 1}
                      </span>
                      <code className="font-mono text-sm">{step.actionType}</code>
                      <StepStatusBadge status={step.status} />
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Text size="sm" variant="muted">
                    {formatTimestamp(step.startedAt)}
                    {step.completedAt ? ` → ${formatTimestamp(step.completedAt)}` : ''}
                  </Text>
                  {step.error && (
                    <Text size="sm" variant="danger">
                      {step.error}
                    </Text>
                  )}
                  {step.gateLog && step.gateLog.length > 0 && <GateLog entries={step.gateLog} />}
                  {step.input !== null && step.input !== undefined && (
                    <details>
                      <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)]">
                        Input
                      </summary>
                      <div className="mt-2">
                        <JsonBlock value={step.input} />
                      </div>
                    </details>
                  )}
                  {step.output !== null && step.output !== undefined && (
                    <details>
                      <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)]">
                        Output
                      </summary>
                      <div className="mt-2">
                        <JsonBlock value={step.output} />
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </div>
  );
}
