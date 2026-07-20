'use client';

// The ordered stage list — a workflow's actual substance.
//
// A workflow's header (name, slug, default) is trivia; the stages ARE the thing
// being configured, so this is the one section that gets to be complicated. It
// is a list rather than a table because a stage has four booleans and two names,
// and a six-column table of checkboxes tells you nothing about the SEQUENCE —
// which is the only reason the list is ordered in the first place. Collapsed, a
// row says what the stage is and what entering it does, in a sentence. Expanded,
// it is the full editor.
//
// Reorder is buttons FIRST, drag second, and that ordering is deliberate. Native
// HTML5 drag does not exist on touch and is invisible to a keyboard, so a
// drag-only list would be unusable on the tablet this app is meant to run on and
// unreachable without a mouse. Move-up/move-down works everywhere, is the whole
// interaction for the two-to-six stages a real workflow has, and drag is layered
// on top as a mouse convenience rather than the only way in. (dnd-kit would give
// nicer drag, but it is not a workbench dependency and adding one is Brandon's
// call, not this file's.)
//
// Editing here NEVER writes. Every change lands in the parent's draft and waits
// for Save, which is what lets a reorder plus three renames be one operation
// instead of seven, and what makes the pane's dirty guard meaningful.

import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { blankStage, type StageDraft } from './workflow-data';
import { stageTone, type DocumentStageType } from './types';

/**
 * The six semantic roles, in the order a document actually travels through them,
 * each labelled with what it MEANS rather than what it is called in the schema.
 * `stageType` is the only thing system behaviour keys off, so choosing one is
 * the single most consequential field on this screen — and "committed" tells a
 * shop owner nothing on its own.
 */
const STAGE_TYPES: { value: DocumentStageType; label: string; hint: string }[] = [
  {
    value: 'draft',
    label: 'Draft — still being put together',
    hint: 'Nothing is promised to the customer yet.',
  },
  {
    value: 'open',
    label: 'Open — sent, still changeable',
    hint: 'The customer can see it and you can still edit it.',
  },
  {
    value: 'committed',
    label: 'Committed — the customer approved it',
    hint: 'They have said yes. The work can start.',
  },
  {
    value: 'final',
    label: 'Final — billable, awaiting payment',
    hint: 'This is what they owe. Usually where you stop editing.',
  },
  {
    value: 'paid',
    label: 'Paid — settled',
    hint: 'The money has arrived and the document is done.',
  },
  {
    value: 'void',
    label: 'Void — cancelled',
    hint: 'Kept for the record, but it is not owed and not collectable.',
  },
];

function typeLabel(type: DocumentStageType): string {
  // The short half of the option label — the part before the em dash.
  return (
    (STAGE_TYPES.find((option) => option.value === type)?.label ?? type).split(' — ')[0] ?? type
  );
}

/** What entering this stage does, as a sentence fragment per effect. Mirrors the
 *  wording `lifecycle.tsx` uses in its advance confirm, so the thing configured
 *  here and the thing an operator is warned about later read the same. */
function effectSummary(stage: StageDraft): string {
  const effects: string[] = [];
  if (stage.numberOnEnter) {
    const prefix = stage.numberPrefix.trim();
    effects.push(prefix ? `numbers it ${prefix}…` : 'numbers it');
  }
  if (stage.snapshotOnEnter) effects.push('freezes a permanent record');
  if (stage.locksEditing) effects.push('locks it from edits');
  if (effects.length === 0) return 'Arriving here changes nothing about the document.';
  const joined =
    effects.length === 1
      ? effects[0]
      : `${effects.slice(0, -1).join(', ')} and ${effects[effects.length - 1] ?? ''}`;
  return `Arriving here ${joined ?? ''}.`;
}

interface StageRowProps {
  stage: StageDraft;
  index: number;
  count: number;
  expanded: boolean;
  dropTarget: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<StageDraft>) => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function StageRow({
  stage,
  index,
  count,
  expanded,
  dropTarget,
  onToggle,
  onChange,
  onRemove,
  onMove,
  onDragStart,
  onDragOver,
  onDragEnd,
}: StageRowProps) {
  const label = stage.customerLabel.trim() || stage.name.trim() || 'Untitled stage';
  // The internal name only earns a line when it actually differs — repeating
  // "Invoice / Invoice" on every row is noise that makes the rows that DO differ
  // harder to spot.
  const internalDiffers =
    stage.name.trim() !== '' && stage.name.trim() !== stage.customerLabel.trim();

  return (
    <li
      // Dragging is disabled while expanded: the expanded body is full of inputs,
      // and a draggable ancestor eats text selection inside them.
      draggable={!expanded}
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragEnd();
      }}
      onDragEnd={onDragEnd}
      className={`border-base-300 bg-base-100 rounded-md border ${
        dropTarget ? 'border-module border-dashed' : ''
      }`}
    >
      <div className="flex items-start gap-2 p-3">
        <div className="flex shrink-0 flex-col items-center pt-0.5">
          {/* Present for mouse users as the "this row moves" cue. Not a drag
              HANDLE — the whole row is the drag surface — so it is decorative
              and the real reorder controls are the two buttons below it. */}
          <GripVertical className="size-4 cursor-grab" aria-hidden />
        </div>

        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className="flex flex-wrap items-center gap-2">
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            )}
            <span className="text-base font-semibold">{label}</span>
            <Badge color={stageTone(stage.stageType)} variant="soft" size="sm">
              {typeLabel(stage.stageType)}
            </Badge>
            {/* Where every new document lands. Only true of the first row, and
                it is the one thing about ordering that has a consequence. */}
            {index === 0 ? (
              <Badge color="module" variant="soft" size="sm">
                Documents start here
              </Badge>
            ) : null}
          </span>
          <Text className="text-sm">{effectSummary(stage)}</Text>
          {internalDiffers ? (
            <Text className="text-sm">Your team sees this as “{stage.name.trim()}”.</Text>
          ) : null}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            aria-label={`Move ${label} earlier`}
            title="Move earlier"
            disabled={index === 0}
            onClick={() => {
              onMove(index, index - 1);
            }}
          >
            <ChevronUp className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            aria-label={`Move ${label} later`}
            title="Move later"
            disabled={index === count - 1}
            onClick={() => {
              onMove(index, index + 1);
            }}
          >
            <ChevronDown className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            aria-label={`Remove ${label}`}
            title="Remove this stage"
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-base-300 flex flex-col gap-4 border-t p-3">
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field>
              <FieldLabel>What your customers see</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={stage.customerLabel}
                    placeholder="Invoice"
                    onChange={(event) => {
                      onChange({ customerLabel: event.target.value });
                    }}
                  />
                }
              />
              <FieldDescription>
                The word printed at the top of the document at this stage — Estimate, Invoice, Work
                order, Receipt.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>What your team calls it</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={stage.name}
                    placeholder="Invoice"
                    onChange={(event) => {
                      onChange({ name: event.target.value });
                    }}
                  />
                }
              />
              <FieldDescription>
                Only ever shown inside sparx. Often the same as above — make it different when your
                team&apos;s word for the step isn&apos;t the customer&apos;s.
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel>What this stage means</FieldLabel>
            <NativeSelect
              color="module"
              aria-label="What this stage means"
              value={stage.stageType}
              onChange={(event) => {
                onChange({ stageType: event.target.value as DocumentStageType });
              }}
            >
              {STAGE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>
              {STAGE_TYPES.find((option) => option.value === stage.stageType)?.hint}
            </FieldDescription>
          </Field>

          <div className="flex flex-col gap-3">
            <Text className="text-base font-semibold">What happens when a document gets here</Text>

            <label className="flex items-start gap-2">
              <Checkbox
                color="module"
                className="mt-1"
                checked={stage.numberOnEnter}
                aria-label="Give it a number"
                onChange={(event) => {
                  onChange({ numberOnEnter: event.target.checked });
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span">Give it a number</Text>
                <Text as="span" className="text-sm">
                  The document is stamped with the next number in sequence, once. It keeps that
                  number for good.
                </Text>
              </span>
            </label>

            {stage.numberOnEnter ? (
              <Field className="ml-7 max-w-xs">
                <FieldLabel>Number prefix</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={stage.numberPrefix}
                      placeholder="INV-"
                      maxLength={12}
                      onChange={(event) => {
                        onChange({ numberPrefix: event.target.value });
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Goes in front of the number — “INV-” gives you INV-000001. Leave it empty for
                  plain numbers.
                </FieldDescription>
              </Field>
            ) : null}

            <label className="flex items-start gap-2">
              <Checkbox
                color="module"
                className="mt-1"
                checked={stage.snapshotOnEnter}
                aria-label="Freeze a permanent copy"
                onChange={(event) => {
                  onChange({ snapshotOnEnter: event.target.checked });
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span">Freeze a permanent copy</Text>
                <Text as="span" className="text-sm">
                  Saves the document exactly as it stands, forever. Later edits never change it —
                  this is what you show a customer who disputes what they agreed to.
                </Text>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <Checkbox
                color="module"
                className="mt-1"
                checked={stage.locksEditing}
                aria-label="Stop it being edited"
                onChange={(event) => {
                  onChange({ locksEditing: event.target.checked });
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span">Stop it being edited</Text>
                <Text as="span" className="text-sm">
                  The charges can no longer be changed. Payments can still be recorded — a locked
                  invoice is exactly the one getting paid.
                </Text>
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </li>
  );
}

interface StageListProps {
  stages: StageDraft[];
  onChange: (stages: StageDraft[]) => void;
}

export function StageList({ stages, onChange }: StageListProps) {
  // Which rows are open, by session key rather than index — an open row must
  // stay open when it moves, and an index would hand its open state to whoever
  // takes its place.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= stages.length || from === to) return;
    const next = [...stages];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  const patch = (index: number, changes: Partial<StageDraft>) => {
    onChange(stages.map((stage, i) => (i === index ? { ...stage, ...changes } : stage)));
  };

  const remove = (index: number) => {
    onChange(stages.filter((_, i) => i !== index));
  };

  const add = () => {
    const stage = blankStage();
    onChange([...stages, stage]);
    // Opened immediately: a stage added blank is unusable until it is named, so
    // landing on a collapsed "Untitled stage" would just be a second click.
    setOpen((current) => new Set(current).add(stage.key));
  };

  return (
    <div className="@container flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.key}
            stage={stage}
            index={index}
            count={stages.length}
            expanded={open.has(stage.key)}
            dropTarget={over === index && dragging !== null && dragging !== index}
            onToggle={() => {
              setOpen((current) => {
                const next = new Set(current);
                if (next.has(stage.key)) next.delete(stage.key);
                else next.add(stage.key);
                return next;
              });
            }}
            onChange={(changes) => {
              patch(index, changes);
            }}
            onRemove={() => {
              remove(index);
            }}
            onMove={move}
            onDragStart={() => {
              setDragging(index);
            }}
            onDragOver={() => {
              setOver(index);
            }}
            onDragEnd={() => {
              if (dragging !== null && over !== null) move(dragging, over);
              setDragging(null);
              setOver(null);
            }}
          />
        ))}
      </ul>

      <div>
        <Button size="sm" variant="outline" color="module" onClick={add}>
          <Plus className="size-4" aria-hidden />
          Add a stage
        </Button>
      </div>
    </div>
  );
}
