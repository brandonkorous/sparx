import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button, Container, PageHeader, Stack } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { WorkflowEditor } from './_components/workflow-editor';
import type { StageRow } from './_components/stage-row';

export const dynamic = 'force-dynamic';

interface WorkflowDetail {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  stages: StageRow[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWorkflowPage({ params }: PageProps) {
  const { id } = await params;

  let workflow: WorkflowDetail;
  try {
    workflow = await api.get<WorkflowDetail>(`/v1/invoicing/workflows/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const stages = workflow.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-8">
        <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          <Link href="/invoicing/workflows">All workflows</Link>
        </Button>
        <PageHeader
          title={workflow.name}
          description="Edit the workflow and shape its stages. Drag to reorder; each stage's type drives behavior while its label stays customer-facing."
        />
        <WorkflowEditor
          workflow={{
            id: workflow.id,
            name: workflow.name,
            slug: workflow.slug,
            isDefault: workflow.isDefault,
            stages,
          }}
        />
      </Stack>
    </Container>
  );
}
