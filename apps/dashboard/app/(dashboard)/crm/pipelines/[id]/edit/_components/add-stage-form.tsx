'use client';

// Add-stage form — appended below the sortable list. Picks the next
// sort_order so the new stage lands at the end, then refreshes the parent.

import * as React from 'react';
import { Plus } from 'lucide-react';

import { Button, Field, FieldControl, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';

import { createPipelineStageAction } from '../../../../pipeline-actions';

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
      <Field className="flex-1">
        <FieldLabel>New stage</FieldLabel>
        <FieldControl
          name="new-stage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Stage name"
        />
      </Field>
      <Field className="w-24">
        <FieldLabel>Prob</FieldLabel>
        <FieldControl
          name="new-stage-prob"
          type="number"
          min="0"
          max="100"
          value={probability}
          onChange={(e) => setProbability(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        />
      </Field>
      <Field>
        <FieldLabel>Type</FieldLabel>
        <NativeSelect
          value={stageType}
          onChange={(e) => setStageType(e.target.value as 'open' | 'won' | 'lost')}
        >
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </NativeSelect>
      </Field>
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
