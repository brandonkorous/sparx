'use client';

// Add-stage form — appended below the sortable list. Picks the next sort_order so
// the new stage lands at the end. Captures the essentials (name, customer label,
// type) plus the behavior toggles; finer tuning (color) is on the row after add.

import * as React from 'react';
import { Plus } from 'lucide-react';

import { toast } from '@sparx/ui';
import { Button, Checkbox, Input, Label } from 'silicaui-react';

import { createWorkflowStageAction } from '../../../../workflow-actions';

const SELECT_CLASS =
  'flex h-9 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]';

type StageType = 'draft' | 'open' | 'committed' | 'final' | 'paid' | 'void';

const STAGE_TYPES: { value: StageType; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'committed', label: 'Committed' },
  { value: 'final', label: 'Final' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

export function AddStageForm({
  workflowId,
  nextSortOrder,
  onAdded,
}: {
  workflowId: string;
  nextSortOrder: number;
  onAdded: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState('');
  const [customerLabel, setCustomerLabel] = React.useState('');
  const [stageType, setStageType] = React.useState<StageType>('draft');
  const [numberOnEnter, setNumberOnEnter] = React.useState(false);
  const [numberPrefix, setNumberPrefix] = React.useState('');
  const [snapshotOnEnter, setSnapshotOnEnter] = React.useState(false);
  const [locksEditing, setLocksEditing] = React.useState(false);

  function reset() {
    setName('');
    setCustomerLabel('');
    setStageType('draft');
    setNumberOnEnter(false);
    setNumberPrefix('');
    setSnapshotOnEnter(false);
    setLocksEditing(false);
  }

  function add() {
    const label = customerLabel.trim() || name.trim();
    if (!name.trim()) {
      toast.error('A stage name is required.');
      return;
    }
    startTransition(async () => {
      const result = await createWorkflowStageAction(workflowId, {
        name: name.trim(),
        customerLabel: label,
        stageType,
        numberOnEnter,
        numberPrefix: numberOnEnter ? numberPrefix.trim() || null : null,
        snapshotOnEnter,
        locksEditing,
        sortOrder: nextSortOrder,
      });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not add stage');
        return;
      }
      toast.success('Stage added');
      reset();
      onAdded();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-row flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="new-stage-name">New stage name</Label>
          <Input
            id="new-stage-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Estimate"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="new-stage-label">Customer label</Label>
          <Input
            id="new-stage-label"
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
            placeholder="Defaults to the name"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-stage-type">Type</Label>
          <select
            id="new-stage-type"
            value={stageType}
            onChange={(e) => setStageType(e.target.value as StageType)}
            className={SELECT_CLASS}
          >
            {STAGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          color="module"
          size="sm"
          disabled={pending || !name.trim()}
          onClick={add}
          iconStart={<Plus className="h-3.5 w-3.5" />}
        >
          Add
        </Button>
      </div>

      <div className="flex flex-row flex-wrap items-center gap-4 px-1">
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Checkbox
            color="module"
            checked={numberOnEnter}
            onChange={(e) => setNumberOnEnter(e.target.checked)}
          />
          Mint a number
        </label>
        {numberOnEnter && (
          <Input
            value={numberPrefix}
            onChange={(e) => setNumberPrefix(e.target.value)}
            maxLength={12}
            className="h-8 w-24"
            placeholder="INV-"
            aria-label="Number prefix"
          />
        )}
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Checkbox
            color="module"
            checked={snapshotOnEnter}
            onChange={(e) => setSnapshotOnEnter(e.target.checked)}
          />
          Freeze a snapshot
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Checkbox
            color="module"
            checked={locksEditing}
            onChange={(e) => setLocksEditing(e.target.checked)}
          />
          Lock editing
        </label>
        <p className="text-base-content/70 text-xs">Tune the color on the stage after adding.</p>
      </div>
    </div>
  );
}
