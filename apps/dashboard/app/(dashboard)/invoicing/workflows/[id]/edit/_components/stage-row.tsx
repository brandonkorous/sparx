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

import { toast, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

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
  'flex h-9 rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

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

  const v = useFieldValidation(
    { name, customerLabel },
    {
      name: rule.required('An internal name is required.'),
      customerLabel: rule.required('A customer label is required.'),
    }
  );

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
    if (!v.validate()) return;
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
    <div ref={setNodeRef} style={style} className="border-base-300 rounded-md border p-3">
      <div className="flex flex-row items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-base-content hover:text-module cursor-grab"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Field {...v.field('name')} className="flex-1">
          <FieldLabel className="text-xs">Internal name</FieldLabel>
          <FieldControl
            name="stage-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Estimate"
            {...v.control('name')}
          />
        </Field>
        <Field {...v.field('customerLabel')} className="flex-1">
          <FieldLabel className="text-xs">Customer label</FieldLabel>
          <FieldControl
            name="stage-customer-label"
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
            placeholder="Estimate"
            {...v.control('customerLabel')}
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">Type</FieldLabel>
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
        </Field>
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
      </div>

      <div className="mt-3 flex flex-row flex-wrap items-center gap-4 px-1">
        <label className="text-base-content flex items-center gap-1.5 text-xs">
          <Checkbox
            color="module"
            checked={numberOnEnter}
            onChange={(e) => setNumberOnEnter(e.target.checked)}
          />
          Mint a number on entry
        </label>
        {numberOnEnter && (
          <div className="flex flex-row items-center gap-2">
            <Label className="text-xs">Prefix</Label>
            <Input
              value={numberPrefix}
              onChange={(e) => setNumberPrefix(e.target.value)}
              maxLength={12}
              className="h-8 w-24"
              placeholder="INV-"
              aria-label="Number prefix"
            />
          </div>
        )}
        <label className="text-base-content flex items-center gap-1.5 text-xs">
          <Checkbox
            color="module"
            checked={snapshotOnEnter}
            onChange={(e) => setSnapshotOnEnter(e.target.checked)}
          />
          Freeze a snapshot
        </label>
        <label className="text-base-content flex items-center gap-1.5 text-xs">
          <Checkbox
            color="module"
            checked={locksEditing}
            onChange={(e) => setLocksEditing(e.target.checked)}
          />
          Lock editing
        </label>
        <label className="text-base-content flex items-center gap-1.5 text-xs">
          <Checkbox
            color="module"
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
            className="border-base-300 h-7 w-10 cursor-pointer rounded border bg-transparent"
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
      </div>

      {numberOnEnter && !numberPrefix.trim() && (
        <p className="text-base-content mt-1 px-1 text-xs">
          Without a prefix, numbers mint as plain sequence (e.g. 000123). Add one like INV- or EST-.
        </p>
      )}
    </div>
  );
}
