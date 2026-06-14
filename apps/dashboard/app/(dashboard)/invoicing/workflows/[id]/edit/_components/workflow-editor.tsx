'use client';

// Workflow editor — workflow header (name · default · archive) + a drag-and-drop
// stage list + the add form. Reorder writes new sort_order in one atomic
// transaction so the unique (workflow_id, sort_order) index doesn't trip mid-move.
// Mirrors the CRM pipeline editor (docs/87 §3 deliberately reuses that shape).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import {
  archiveWorkflowAction,
  reorderWorkflowStagesAction,
  updateWorkflowAction,
} from '../../../../workflow-actions';
import { AddStageForm } from './add-stage-form';
import { SortableStageRow, type StageRow } from './stage-row';

interface WorkflowEditorProps {
  workflow: {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
    stages: StageRow[];
  };
}

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [stages, setStages] = React.useState<StageRow[]>(workflow.stages);
  const [name, setName] = React.useState(workflow.name);
  const [isDefault, setIsDefault] = React.useState(workflow.isDefault);
  const headerDirty = name !== workflow.name || isDefault !== workflow.isDefault;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const dndId = React.useId();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex((s) => s.id === active.id);
    const newIdx = stages.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const prev = stages;
    const next = arrayMove(stages, oldIdx, newIdx);
    setStages(next);

    startTransition(async () => {
      const result = await reorderWorkflowStagesAction(workflow.id, {
        stageIds: next.map((s) => s.id),
      });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not reorder stages');
        setStages(prev);
        return;
      }
      toast.success('Order saved');
      router.refresh();
    });
  }

  function saveHeader() {
    if (!name.trim()) {
      toast.error('A workflow name is required.');
      return;
    }
    startTransition(async () => {
      const result = await updateWorkflowAction(workflow.id, {
        name: name.trim(),
        isDefault,
      });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not save workflow');
        return;
      }
      toast.success('Workflow updated');
      router.refresh();
    });
  }

  async function archive() {
    const ok = await confirm({
      title: 'Archive this workflow?',
      description:
        'Existing documents stay on it, but new documents can no longer use it. You can’t pick it in the create wizard once archived.',
      confirmLabel: 'Archive workflow',
      tone: 'warning',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await archiveWorkflowAction(workflow.id);
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not archive workflow');
        return;
      }
      toast.success('Workflow archived');
      router.push('/invoicing/workflows');
    });
  }

  return (
    <Stack gap={6}>
      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="wf-name">Name</Label>
              <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} />
              <Text size="xs" variant="muted">
                Slug <code className="font-mono">{workflow.slug}</code> is the stable identifier and
                can’t change.
              </Text>
            </Stack>
            <Stack direction="row" align="center" gap={2}>
              <input
                type="checkbox"
                id="wf-default"
                className="h-4 w-4"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <Label htmlFor="wf-default">
                Default workflow (preselected in the create wizard)
              </Label>
            </Stack>
            <Stack direction="row" align="center" justify="between" gap={3} wrap>
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                disabled={pending}
                onClick={() => void archive()}
              >
                Archive workflow
              </Button>
              <Button
                color="module"
                disabled={!headerDirty || pending}
                onClick={saveHeader}
                loading={pending && headerDirty}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Stack direction="row" align="center" gap={2}>
              Stages <Badge variant="outline">{stages.length}</Badge>
            </Stack>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <Text size="sm" variant="muted" className="pb-4">
              No stages yet. Add the first stage below — a one-stage “Invoice” workflow is perfectly
              valid.
            </Text>
          ) : (
            <DndContext id={dndId} sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <Stack gap={2}>
                  {stages.map((s) => (
                    <SortableStageRow key={s.id} stage={s} workflowId={workflow.id} />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          )}

          <div className="mt-4 border-t border-[var(--color-border-default)] pt-4">
            <AddStageForm
              workflowId={workflow.id}
              nextSortOrder={stages.length}
              onAdded={() => router.refresh()}
            />
          </div>
        </CardContent>
      </Card>
    </Stack>
  );
}
