// Run history for one automation (docs/81 §8 "Execution History"). Lists recent
// runs newest-first; each opens a run detail with the per-step gate_log. Read-only.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { History } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { AutomationDto, RunDto } from '../../_lib/types';
import { RunStatusBadge, formatTimestamp } from '../../_lib/presentation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AutomationRunsPage({ params }: PageProps) {
  const { id } = await params;
  await requireSession();

  let automation: AutomationDto;
  try {
    automation = await api.get<AutomationDto>(`/v1/automations/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const runs = await api.get<RunDto[]>(`/v1/automations/${id}/runs?limit=100`).catch(() => []);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<History className="h-5 w-5" />}
          title={`Runs · ${automation.name}`}
          description={
            <Link
              href={`/automations/${automation.id}`}
              className="text-sm text-[var(--module-active)] hover:underline"
            >
              ← Back to automation
            </Link>
          }
        />

        {runs.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title="No runs yet"
              description="Runs appear here once this automation's trigger fires."
            />
          </Card>
        ) : (
          <Stack gap={2}>
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/automations/${automation.id}/runs/${run.id}`}
                className="block rounded-md border border-[var(--color-border-default)] px-4 py-3 hover:bg-[var(--color-bg-subtle)]"
              >
                <Stack direction="row" align="center" justify="between" wrap gap={3}>
                  <Stack direction="row" align="center" gap={3}>
                    <RunStatusBadge status={run.status} />
                    <Text size="sm" variant="muted">
                      Started {formatTimestamp(run.startedAt)}
                    </Text>
                  </Stack>
                  <Stack direction="row" align="center" gap={4}>
                    {run.errorMessage && (
                      <Text size="sm" variant="danger" className="max-w-md truncate">
                        {run.errorMessage}
                      </Text>
                    )}
                    <Text size="sm" variant="muted">
                      {run.completedAt ? `Done ${formatTimestamp(run.completedAt)}` : 'In progress'}
                    </Text>
                    <Text size="sm" variant="muted">
                      {run.actionsTotal} step{run.actionsTotal === 1 ? '' : 's'}
                    </Text>
                  </Stack>
                </Stack>
              </Link>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
