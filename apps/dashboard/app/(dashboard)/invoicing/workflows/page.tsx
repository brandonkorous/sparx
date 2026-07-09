import Link from 'next/link';
import { GitBranch, Plus } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';

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
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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
            <EntityCreateButton
              entityType="workflow"
              newHref="/invoicing/workflows/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New workflow
            </EntityCreateButton>
          }
        />

        {workflows.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title="No workflows yet"
                description="Create a workflow to define the stages your documents move through."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {workflows.map((wf) => {
              const stages = wf.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <Card key={wf.id}>
                  <CardBody className="py-4">
                    <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-row flex-wrap items-center gap-2">
                          <p className="font-medium">{wf.name}</p>
                          {wf.isDefault && (
                            <Badge color="module" variant="soft" className="text-xs">
                              Default
                            </Badge>
                          )}
                          <p className="text-base-content/70 text-xs">{wf.slug}</p>
                        </div>
                        <div className="flex flex-row flex-wrap items-center gap-2">
                          {stages.length === 0 ? (
                            <p className="text-base-content/70 text-xs">No stages yet</p>
                          ) : (
                            stages.map((s, i) => (
                              <div key={s.id} className="flex flex-row items-center gap-2">
                                <Badge color="neutral" variant="soft" size="sm">
                                  {s.customerLabel}
                                </Badge>
                                {i < stages.length - 1 && (
                                  <span className="text-base-content/50">→</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        color="module"
                        render={<Link href={`/invoicing/workflows/${wf.id}/edit`} />}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-base-content/70 text-xs">
          Stages key off a semantic <strong>type</strong> (draft, open, committed, final, paid,
          void) that drives behavior — the label stays yours, so the same engine serves estimates,
          work orders, invoices and tickets.
        </p>
      </div>
    </div>
  );
}
