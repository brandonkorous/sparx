'use client';

// Workflow editor — workflow header (name · default · archive) + a drag-and-drop
// stage list + the add form. Reorder writes new sort_order in one atomic
// transaction so the unique (workflow_id, sort_order) index doesn't trip mid-move.
// Mirrors the CRM pipeline editor (docs/87 §3 deliberately reuses that shape).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { toast, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

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

  const v = useFieldValidation({ name }, { name: rule.required('A workflow name is required.') });

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
    if (!v.validate()) return;
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <CardTitle>Workflow</CardTitle>
          <div className="flex flex-col gap-4">
            <Field {...v.field('name')}>
              <FieldLabel required>Name</FieldLabel>
              <FieldControl
                name="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
              />
              <FieldDescription>
                Slug <code className="font-mono">{workflow.slug}</code> is the stable identifier and
                can’t change.
              </FieldDescription>
            </Field>
            <div className="flex flex-row items-center gap-2">
              <Checkbox
                color="module"
                id="wf-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <Label htmlFor="wf-default">
                Default workflow (preselected in the create wizard)
              </Label>
            </div>
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
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
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle>
            <div className="flex flex-row items-center gap-2">
              Stages{' '}
              <Badge color="neutral" variant="soft" size="sm">
                {stages.length}
              </Badge>
            </div>
          </CardTitle>
          {stages.length === 0 ? (
            <p className="text-base-content pb-4 text-sm">
              No stages yet. Add the first stage below — a one-stage “Invoice” workflow is perfectly
              valid.
            </p>
          ) : (
            <DndContext id={dndId} sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {stages.map((s) => (
                    <SortableStageRow key={s.id} stage={s} workflowId={workflow.id} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="border-base-300 mt-4 border-t pt-4">
            <AddStageForm
              workflowId={workflow.id}
              nextSortOrder={stages.length}
              onAdded={() => router.refresh()}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
