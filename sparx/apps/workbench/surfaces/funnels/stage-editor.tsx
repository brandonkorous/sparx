'use client';

// The ladder editor — the steps a campaign counts, in order.
//
// ── THE TWO RULES THIS UI HAS TO TEACH WITHOUT A MANUAL ────────────────────
//
// 1. **The key is the identity, the name is the label.** History is recorded
//    against the key, so renaming a step keeps its past results and re-keying it
//    strands them. The key is therefore minted ONCE, from the name, and never
//    rewritten — the editor simply does not offer to change it, which is easier
//    to be right about than a warning nobody reads.
//
// 2. **A `view` step counts a PAGE, and every other step counts a person.** That
//    is the privacy line the whole module is built around: above it a step is an
//    anonymous count, below it it is somebody who told you who they are. So the
//    page field appears only on a view step, and disappears the moment the step
//    becomes something else.
//
// The converting step is fixed at the bottom and cannot be removed or moved,
// because a ladder is a sequence of narrowing and a step below the outcome is a
// step nobody can reach without having already finished.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
} from '@wizeworks/silicaui-react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { STAGE_KIND_LABEL, type FunnelStage, type StageKind } from './data';

/** Every kind a person can choose. `convert` is absent on purpose: exactly one
 *  step converts, it is always the last, and offering it as a dropdown value
 *  invites a ladder the server will refuse to save. */
const CHOOSABLE: StageKind[] = ['view', 'capture', 'qualify', 'engage'];

/** A key from a name, minted once. Collisions get a numeric suffix rather than
 *  silently merging two steps into one number. */
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

function StageRow({
  stage,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  stage: FunnelStage;
  index: number;
  count: number;
  onChange: (next: FunnelStage) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const isConvert = stage.kind === 'convert';
  // The converting step is the outcome; it stays last and stays put.
  const canMoveUp = index > 0 && !isConvert;
  const canMoveDown = index < count - 2 && !isConvert;

  return (
    <li className="border-base-300 bg-base-100 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-40 flex-1">
          <FieldLabel>What happened</FieldLabel>
          <FieldControl
            render={
              <Input
                size="sm"
                color="module"
                value={stage.name}
                onChange={(event) => {
                  onChange({ ...stage, name: event.target.value });
                }}
              />
            }
          />
        </Field>
        <div className="w-48">
          <Select
            size="sm"
            aria-label="What this step counts"
            value={stage.kind}
            disabled={isConvert}
            onValueChange={(value) => {
              const kind = value as StageKind;
              // Dropping the page when the step stops counting one: a stale path
              // on a capture step is invisible and would be saved forever.
              onChange({ ...stage, kind, ...(kind === 'view' ? {} : { path: undefined }) });
            }}
            items={(isConvert ? (['convert'] as StageKind[]) : CHOOSABLE).map((kind) => ({
              value: kind,
              label: STAGE_KIND_LABEL[kind],
            }))}
          />
        </div>
        <Button
          size="sm"
          shape="square"
          aria-label="Move this step up"
          disabled={!canMoveUp}
          onClick={() => {
            onMove(-1);
          }}
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          shape="square"
          aria-label="Move this step down"
          disabled={!canMoveDown}
          onClick={() => {
            onMove(1);
          }}
        >
          <ArrowDown className="size-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          color="danger"
          variant="ghost"
          shape="square"
          aria-label="Remove this step"
          disabled={isConvert}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {stage.kind === 'view' ? (
        <Field>
          <FieldLabel>Which page</FieldLabel>
          <FieldControl
            render={
              <Input
                size="sm"
                color="module"
                placeholder="/pricing"
                value={stage.path ?? ''}
                onChange={(event) => {
                  onChange({ ...stage, path: event.target.value || undefined });
                }}
              />
            }
          />
          <FieldDescription>
            Leave this empty to count visits to the campaign&rsquo;s landing page.
          </FieldDescription>
        </Field>
      ) : null}
    </li>
  );
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
  const move = (index: number, delta: number) => {
    const next = [...stages];
    const target = index + delta;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  };

  const add = () => {
    const keys = stages.map((s) => s.key);
    const step: FunnelStage = {
      key: mintKey('Next step', keys),
      name: 'Next step',
      kind: 'engage',
    };
    // Always inserted ABOVE the converting step, which is what keeps the ladder
    // a sequence without asking anybody to understand why.
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
              move(index, delta);
            }}
            onRemove={() => {
              onChange(stages.filter((_, i) => i !== index));
            }}
          />
        ))}
      </ol>
      <div>
        <Button size="sm" variant="outline" color="module" disabled={disabled} onClick={add}>
          <Plus className="size-4" aria-hidden />
          Add a step
        </Button>
      </div>
    </div>
  );
}
