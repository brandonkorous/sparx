'use client';

// Sortable stage row — the full document-stage editor (docs/87 §3). A stage's
// `customerLabel` is the noun the customer sees (Estimate, Invoice, Work Order);
// its `stageType` drives system behavior; and three toggles say what entering the
// stage DOES: mint/restamp a number (with a prefix), freeze an immutable snapshot,
// and lock the lines. Save commits a dirty row; the trash deletes (with confirm).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';

import { Badge, Button, Input, Label, Stack, Text, toast, useConfirm } from '@sparx/ui';

import { deleteWorkflowStageAction, updateWorkflowStageAction } from '../../../../workflow-actions';

export interface StageRow {
  id: string;
  name: string;
  customerLabel: string;
  stageType: 'draft' | 'open' | 'committed' | 'final' | 'paid' | 'void';
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  numberPrefix: string | null;
  locksEditing: boolean;
  color: string | null;
  sortOrder: number;
}

const SELECT_CLASS =
  'flex h-9 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]';

const STAGE_TYPES: { value: StageRow['stageType']; label: string }[] = [
  { value: 'draft', label: 'Draft — being built' },
  { value: 'open', label: 'Open — live & editable' },
  { value: 'committed', label: 'Committed — customer-approved' },
  { value: 'final', label: 'Final — billable & locked' },
  { value: 'paid', label: 'Paid — settled' },
  { value: 'void', label: 'Void — cancelled' },
];

// A blank/whitespace prefix and an absent one are the same thing for dirty-checking
// (the save path also collapses '' → null), so normalize both sides before compare.
function emptyToNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function SortableStageRow({ stage, workflowId }: { stage: StageRow; workflowId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stage.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [name, setName] = React.useState(stage.name);
  const [customerLabel, setCustomerLabel] = React.useState(stage.customerLabel);
  const [stageType, setStageType] = React.useState<StageRow['stageType']>(stage.stageType);
  const [snapshotOnEnter, setSnapshotOnEnter] = React.useState(stage.snapshotOnEnter);
  const [numberOnEnter, setNumberOnEnter] = React.useState(stage.numberOnEnter);
  const [numberPrefix, setNumberPrefix] = React.useState(stage.numberPrefix ?? '');
  const [locksEditing, setLocksEditing] = React.useState(stage.locksEditing);
  const [color, setColor] = React.useState<string | null>(stage.color);
  const [pending, startTransition] = React.useTransition();

  const dirty =
    name !== stage.name ||
    customerLabel !== stage.customerLabel ||
    stageType !== stage.stageType ||
    snapshotOnEnter !== stage.snapshotOnEnter ||
    numberOnEnter !== stage.numberOnEnter ||
    emptyToNull(numberPrefix) !== emptyToNull(stage.numberPrefix) ||
    locksEditing !== stage.locksEditing ||
    color !== stage.color;

  function save() {
    if (!name.trim() || !customerLabel.trim()) {
      toast.error('Name and customer label are required.');
      return;
    }
    startTransition(async () => {
      const result = await updateWorkflowStageAction(workflowId, stage.id, {
        name: name.trim(),
        customerLabel: customerLabel.trim(),
        stageType,
        snapshotOnEnter,
        numberOnEnter,
        numberPrefix: numberOnEnter ? numberPrefix.trim() || null : null,
        locksEditing,
        color,
      });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not save stage');
        return;
      }
      toast.success('Stage saved');
      router.refresh();
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete this stage?',
      description: `“${stage.customerLabel}” will be removed from this workflow. Documents currently on it must be moved first.`,
      tone: 'danger',
      confirmLabel: 'Delete stage',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteWorkflowStageAction(workflowId, stage.id);
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not delete stage');
        return;
      }
      toast.success('Stage deleted');
      router.refresh();
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-[var(--color-border-default)] p-3"
    >
      <Stack direction="row" align="center" gap={3}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-[var(--color-text-tertiary)] hover:text-[var(--module-active)]"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <Label className="text-xs">Internal name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Estimate" />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Customer label</Label>
          <Input
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
            placeholder="Estimate"
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select
            value={stageType}
            onChange={(e) => setStageType(e.target.value as StageRow['stageType'])}
            className={SELECT_CLASS}
            aria-label="Stage type"
          >
            {STAGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          shape="square"
          size="sm"
          disabled={pending}
          onClick={() => void remove()}
          aria-label="Delete stage"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Stack>

      <Stack direction="row" align="center" gap={4} wrap className="mt-3 px-1">
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={numberOnEnter}
            onChange={(e) => setNumberOnEnter(e.target.checked)}
          />
          Mint a number on entry
        </label>
        {numberOnEnter && (
          <Stack direction="row" align="center" gap={2}>
            <Label className="text-xs">Prefix</Label>
            <Input
              value={numberPrefix}
              onChange={(e) => setNumberPrefix(e.target.value)}
              maxLength={12}
              className="h-8 w-24"
              placeholder="INV-"
              aria-label="Number prefix"
            />
          </Stack>
        )}
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={snapshotOnEnter}
            onChange={(e) => setSnapshotOnEnter(e.target.checked)}
          />
          Freeze a snapshot
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={locksEditing}
            onChange={(e) => setLocksEditing(e.target.checked)}
          />
          Lock editing
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={color !== null}
            onChange={(e) => setColor(e.target.checked ? (color ?? '#6366f1') : null)}
          />
          Color
        </label>
        {color !== null && (
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Stage color"
            className="h-7 w-10 cursor-pointer rounded border border-[var(--color-border-default)] bg-transparent"
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <Badge color="warning" variant="soft" className="text-xs">
              Unsaved
            </Badge>
          )}
          <Button color="module" size="sm" disabled={!dirty || pending} onClick={save}>
            Save
          </Button>
        </div>
      </Stack>

      {numberOnEnter && !numberPrefix.trim() && (
        <Text size="xs" variant="muted" className="mt-1 px-1">
          Without a prefix, numbers mint as plain sequence (e.g. 000123). Add one like INV- or EST-.
        </Text>
      )}
    </div>
  );
}
