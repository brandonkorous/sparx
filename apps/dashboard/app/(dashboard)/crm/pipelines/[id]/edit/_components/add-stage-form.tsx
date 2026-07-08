'use client';

// Add-stage form — appended below the sortable list. Picks the next
// sort_order so the new stage lands at the end, then refreshes the parent.

import * as React from 'react';
import { Plus } from 'lucide-react';

import { Button, Input, Label } from 'silicaui-react';
import { toast } from '@sparx/ui';

import { createPipelineStageAction } from '../../../../pipeline-actions';

const SELECT_CLASS =
  'flex h-9 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]';

export function AddStageForm({
  pipelineId,
  nextSortOrder,
  onAdded,
}: {
  pipelineId: string;
  nextSortOrder: number;
  onAdded: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState('');
  const [probability, setProbability] = React.useState(0);
  const [stageType, setStageType] = React.useState<'open' | 'won' | 'lost'>('open');

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createPipelineStageAction(pipelineId, {
        name: name.trim(),
        probability,
        stageType,
        sortOrder: nextSortOrder,
      });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not add stage');
        return;
      }
      toast.success('Stage added');
      setName('');
      setProbability(0);
      setStageType('open');
      onAdded();
    });
  }

  return (
    <div className="flex flex-row items-end gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="new-stage-name">New stage</Label>
        <Input
          id="new-stage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Stage name"
        />
      </div>
      <div className="flex w-24 flex-col gap-1">
        <Label htmlFor="new-stage-prob">Prob</Label>
        <Input
          id="new-stage-prob"
          type="number"
          min="0"
          max="100"
          value={probability}
          onChange={(e) => setProbability(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-stage-type">Type</Label>
        <select
          id="new-stage-type"
          value={stageType}
          onChange={(e) => setStageType(e.target.value as 'open' | 'won' | 'lost')}
          className={SELECT_CLASS}
        >
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
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
  );
}
