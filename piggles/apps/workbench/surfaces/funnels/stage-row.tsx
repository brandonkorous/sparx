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
  Text,
} from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { STAGE_KIND_LABEL } from './presentation';
import type { FunnelStage, StageKind } from './types';
import { recordedBy } from './recorded-by';

/** What a person can choose. `convert` is absent: exactly one step converts, it
 *  is always last, and offering it invites a ladder the server will refuse. */
const CHOOSABLE: StageKind[] = ['view', 'capture', 'qualify', 'engage'];

export interface StageRowProps {
  stage: FunnelStage;
  index: number;
  count: number;
  /** Does this campaign have a landing page of its own? It decides whether
   *  leaving the page field empty counts anything, so it decides what the hint
   *  under that field is allowed to promise. */
  hasLandingPage: boolean;
  /** May this person change the ladder at all? Nothing below read this until
   *  2026-09-25, so a viewer could retype every step, reorder them and delete
   *  them, and only find out at the Save button that none of it could be kept. */
  disabled: boolean;
  onChange: (next: FunnelStage) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

/** Move up / move down / remove. The converting step stays last and stays put. */
function RowControls({
  canMoveUp,
  canMoveDown,
  isConvert,
  disabled,
  onMove,
  onRemove,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  isConvert: boolean;
  disabled: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <Button
        size="sm"
        shape="square"
        aria-label="Move this step up"
        title="Move this step up"
        disabled={disabled || !canMoveUp}
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
        title="Move this step down"
        disabled={disabled || !canMoveDown}
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
        title={isConvert ? 'The last step is the outcome and stays' : 'Remove this step'}
        disabled={disabled || isConvert}
        onClick={onRemove}
      >
        <Icon glyph={faTrash} className="size-4" aria-hidden />
      </Button>
    </>
  );
}

export function StageRow({
  stage,
  index,
  count,
  hasLandingPage,
  disabled,
  onChange,
  onMove,
  onRemove,
}: StageRowProps) {
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
                disabled={disabled}
                onChange={(event) => {
                  onChange({ ...stage, name: event.target.value });
                }}
              />
            }
          />
        </Field>
        {/* A LABEL somebody can see. This had an `aria-label` and nothing else,
            so it sat flush against a labelled field as an unnamed dropdown: the
            person reading the screen was the one who could not tell what it was
            for, while the screen reader was told. */}
        <Field className="w-48">
          <FieldLabel>What it counts</FieldLabel>
          <FieldControl
            render={
              <Select
                size="sm"
                value={stage.kind}
                disabled={disabled || isConvert}
                onValueChange={(value) => {
                  const kind = value as StageKind;
                  onChange({ ...stage, kind, ...(kind === 'view' ? {} : { path: undefined }) });
                }}
                items={(isConvert ? (['convert'] as StageKind[]) : CHOOSABLE).map((kind) => ({
                  value: kind,
                  label: STAGE_KIND_LABEL[kind],
                }))}
              />
            }
          />
        </Field>
        <RowControls
          canMoveUp={index > 0 && !isConvert}
          canMoveDown={index < count - 2 && !isConvert}
          isConvert={isConvert}
          disabled={disabled}
          onMove={onMove}
          onRemove={onRemove}
        />
      </div>

      {/* WHY three controls on this one row are greyed out. The last step is
          the outcome the whole campaign is measured against, so it stays last
          and stays put — true, load-bearing, and said nowhere on the screen
          until now. A locked control with no reason reads as a broken one. */}
      {isConvert ? (
        <Text className="text-sm">
          This is the outcome you are counting towards, so it stays at the bottom and cannot be
          removed. You can still rename it.
        </Text>
      ) : null}

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
                disabled={disabled}
                onChange={(event) => {
                  onChange({ ...stage, path: event.target.value || undefined });
                }}
              />
            }
          />
          {/* A hint may only offer what the campaign actually has. This always
              read "leave this empty to count the campaign's landing page" — and
              a landing page is a server field that NOTHING in this console
              sets, so for every campaign made here, leaving it empty counts
              nobody and blocks the Turn it on button with a message about this
              very field. [[feedback_a_promise_in_copy_is_a_contract]] */}
          <FieldDescription>
            {hasLandingPage
              ? 'The address of the page on your site, starting with a slash. Leave it empty to count this campaign’s own landing page instead.'
              : 'The address of the page on your site, starting with a slash — /spring-sale, or just / for your home page. This campaign has no page of its own, so a step with nothing here counts nobody.'}
          </FieldDescription>
        </Field>
      ) : null}
      <Text className="text-sm">{recordedBy(stage)}</Text>
    </li>
  );
}
