'use client';

// The ladder editor — the steps a campaign counts, in order.
//
// The key is the identity and the name is the label: history is recorded against
// the key, so the key is minted ONCE and the editor never offers to change it.

import { Button } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { StageRow } from './stage-row';
import type { FunnelStage } from './types';

/** A key from a name. Collisions get a suffix rather than silently merging two
 *  steps into one number. */
function mintKey(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'step';
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}_${String(n)}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}_${String(Date.now())}`;
}

/** Swap two steps. Returns the list unchanged if the move runs off either end. */
function swap(stages: FunnelStage[], index: number, delta: number): FunnelStage[] {
  const next = [...stages];
  const a = next[index];
  const b = next[index + delta];
  if (!a || !b) return stages;
  next[index] = b;
  next[index + delta] = a;
  return next;
}

export function StageLadderEditor({
  stages,
  onChange,
  disabled,
}: {
  stages: FunnelStage[];
  onChange: (next: FunnelStage[]) => void;
  disabled: boolean;
}) {
  const add = () => {
    const step: FunnelStage = {
      key: mintKey(
        'Next step',
        stages.map((s) => s.key)
      ),
      name: 'Next step',
      kind: 'engage',
    };
    // Always above the converting step, which keeps the ladder a sequence
    // without asking anybody to understand why.
    const at = Math.max(0, stages.length - 1);
    onChange([...stages.slice(0, at), step, ...stages.slice(at)]);
  };

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.key}
            stage={stage}
            index={index}
            count={stages.length}
            onChange={(next) => {
              onChange(stages.map((s, i) => (i === index ? next : s)));
            }}
            onMove={(delta) => {
              onChange(swap(stages, index, delta));
            }}
            onRemove={() => {
              onChange(stages.filter((_, i) => i !== index));
            }}
          />
        ))}
      </ol>
      <div>
        <Button size="sm" variant="outline" color="module" disabled={disabled} onClick={add}>
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add a step
        </Button>
      </div>
    </div>
  );
}
