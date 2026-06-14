import Link from 'next/link';
import { GitBranch, Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  EmptyState,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

interface StageLite {
  id: string;
  customerLabel: string;
  stageType: string;
  sortOrder: number;
}
interface WorkflowRow {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  stages: StageLite[];
}

export default async function InvoicingWorkflowsPage() {
  const workflows = await api.get<WorkflowRow[]>('/v1/invoicing/workflows');

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<GitBranch className="h-5 w-5" />}
          title="Workflows"
          badge={
            <Badge color="module">
              {workflows.length} workflow{workflows.length === 1 ? '' : 's'}
            </Badge>
          }
          description="A workflow is a document's lifecycle — the ordered stages it moves through (Estimate → Approved → Invoiced → Paid). Each stage carries the customer-facing label and the behavior: when to mint a number, freeze a snapshot, or lock editing. One engine, your labels."
          actions={
            <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
              <Link href="/invoicing/workflows/new">New workflow</Link>
            </Button>
          }
        />

        {workflows.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<GitBranch className="h-5 w-5" />}
              title="No workflows yet"
              description="Create a workflow to define the stages your documents move through."
            />
          </Card>
        ) : (
          <Stack gap={3}>
            {workflows.map((wf) => {
              const stages = wf.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <Card key={wf.id} variant="module">
                  <CardContent className="py-4">
                    <Stack direction="row" align="center" justify="between" gap={3} wrap>
                      <Stack gap={2} className="min-w-0">
                        <Stack direction="row" align="center" gap={2} wrap>
                          <Text className="font-medium">{wf.name}</Text>
                          {wf.isDefault && (
                            <Badge color="module" variant="soft" className="text-xs">
                              Default
                            </Badge>
                          )}
                          <Text size="xs" variant="muted">
                            {wf.slug}
                          </Text>
                        </Stack>
                        <Stack direction="row" align="center" gap={2} wrap>
                          {stages.length === 0 ? (
                            <Text size="xs" variant="muted">
                              No stages yet
                            </Text>
                          ) : (
                            stages.map((s, i) => (
                              <Stack key={s.id} direction="row" align="center" gap={2}>
                                <Badge variant="outline" className="text-xs">
                                  {s.customerLabel}
                                </Badge>
                                {i < stages.length - 1 && (
                                  <span className="text-[var(--color-text-tertiary)]">→</span>
                                )}
                              </Stack>
                            ))
                          )}
                        </Stack>
                      </Stack>
                      <Button asChild variant="outline" size="sm" color="module">
                        <Link href={`/invoicing/workflows/${wf.id}/edit`}>Edit</Link>
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}

        <Text size="xs" variant="muted">
          Stages key off a semantic <strong>type</strong> (draft, open, committed, final, paid,
          void) that drives behavior — the label stays yours, so the same engine serves estimates,
          work orders, invoices and tickets.
        </Text>
      </Stack>
    </Container>
  );
}
