'use client';

// One step in the ladder editor.
//
// A `view` step counts a PAGE and every other step counts a person, so the page
// field appears only on a view step and clears the moment it becomes something
// else — a stale path on a capture step would be invisible and saved forever.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
} from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { STAGE_KIND_LABEL } from './presentation';
import type { FunnelStage, StageKind } from './types';

/** What a person can choose. `convert` is absent: exactly one step converts, it
 *  is always last, and offering it invites a ladder the server will refuse. */
const CHOOSABLE: StageKind[] = ['view', 'capture', 'qualify', 'engage'];

export interface StageRowProps {
  stage: FunnelStage;
  index: number;
  count: number;
  onChange: (next: FunnelStage) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

/** Move up / move down / remove. The converting step stays last and stays put. */
function RowControls({
  canMoveUp,
  canMoveDown,
  isConvert,
  onMove,
  onRemove,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  isConvert: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <Button
        size="sm"
        shape="square"
        aria-label="Move this step up"
        disabled={!canMoveUp}
        onClick={() => {
          onMove(-1);
        }}
      >
        <Icon glyph={faArrowUp} className="size-4" aria-hidden />
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
        <Icon glyph={faArrowDown} className="size-4" aria-hidden />
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
        <Icon glyph={faTrash} className="size-4" aria-hidden />
      </Button>
    </>
  );
}

export function StageRow({ stage, index, count, onChange, onMove, onRemove }: StageRowProps) {
  const isConvert = stage.kind === 'convert';

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
              onChange({ ...stage, kind, ...(kind === 'view' ? {} : { path: undefined }) });
            }}
            items={(isConvert ? (['convert'] as StageKind[]) : CHOOSABLE).map((kind) => ({
              value: kind,
              label: STAGE_KIND_LABEL[kind],
            }))}
          />
        </div>
        <RowControls
          canMoveUp={index > 0 && !isConvert}
          canMoveDown={index < count - 2 && !isConvert}
          isConvert={isConvert}
          onMove={onMove}
          onRemove={onRemove}
        />
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
