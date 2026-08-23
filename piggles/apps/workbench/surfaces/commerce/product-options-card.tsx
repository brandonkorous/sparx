'use client';

// One axis a product is sold along, and the things a shopper can pick under it.
//
// ── Typing a list of sizes should feel like typing a list ────────────────
//
// It did not. Every value cost a mouse trip to "Add a size" and a second one to
// the field it created, because the button did not focus what it made and Enter
// did nothing. Five sizes and three colors is sixteen deliberate mouse moves on
// ONE product; a womenswear catalogue is five of those (issue 168).
//
// So: Enter adds the next value and puts the cursor in it, the button focuses
// what it creates, and the new row lands directly after the one you were in
// rather than at the bottom.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { faChevronDown, faChevronUp, faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import {
  blankValue,
  displayItems,
  MAX_VALUES,
  swap,
  type OptionDraft,
  type OptionProblem,
  type ValueDraft,
} from './product-options-draft';
import { ValueRow } from './product-options-value-row';
import type { OptionDisplayType } from './products-data';

export function OptionCard({
  option,
  problem,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
  onRemove,
}: {
  option: OptionDraft;
  problem: OptionProblem | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (change: Partial<OptionDraft>) => void;
  onMove: (direction: 1 | -1) => void;
  onRemove: () => void;
}) {
  const name = option.name.trim();
  // Which row to put the cursor in. Set when a row is CREATED, so it moves the
  // cursor exactly once and never steals focus from someone typing elsewhere.
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const setValues = (values: ValueDraft[]) => {
    onChange({ values });
  };

  const addValue = (afterIndex: number) => {
    if (option.values.length >= MAX_VALUES) return;
    const entry = blankValue();
    setValues([
      ...option.values.slice(0, afterIndex + 1),
      entry,
      ...option.values.slice(afterIndex + 1),
    ]);
    setFocusKey(entry.key);
  };

  return (
    <FormSection
      title={name === '' ? 'A new choice' : name}
      action={
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            shape="square"
            aria-label={`Move ${name || 'this choice'} earlier`}
            disabled={!canMoveUp}
            onClick={() => {
              onMove(-1);
            }}
          >
            <Icon glyph={faChevronUp} className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            shape="square"
            aria-label={`Move ${name || 'this choice'} later`}
            disabled={!canMoveDown}
            onClick={() => {
              onMove(1);
            }}
          >
            <Icon glyph={faChevronDown} className="size-4" aria-hidden />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 @md:flex-row">
        <Field className="min-w-0 flex-1">
          <FieldLabel>What is the shopper choosing?</FieldLabel>
          <FieldControl
            render={
              <Input
                color={problem?.field === 'name' ? 'error' : 'module'}
                value={option.name}
                placeholder="Size"
                onChange={(event) => {
                  onChange({ name: event.target.value });
                }}
              />
            }
          />
          <FieldDescription>Shown above the choices on the product&apos;s page.</FieldDescription>
        </Field>

        <Field className="min-w-0 flex-1">
          <FieldLabel>How they pick it</FieldLabel>
          <Select
            color="module"
            items={displayItems(option.displayType)}
            value={option.displayType}
            aria-label={`How shoppers pick ${name || 'this choice'}`}
            onValueChange={(next) => {
              onChange({ displayType: next as OptionDisplayType });
            }}
          />
          <FieldDescription>
            {option.displayType === 'swatch'
              ? 'Each option shows as a colored dot, so pick the color of the real thing.'
              : 'How the choices appear on the product’s page.'}
          </FieldDescription>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <Heading level={3} className="text-base font-semibold">
          What they can pick
        </Heading>
        {option.values.map((value, index) => (
          <ValueRow
            key={value.key}
            value={value}
            swatch={option.displayType === 'swatch'}
            optionName={name || 'this choice'}
            focus={value.key === focusKey}
            canMoveUp={index > 0}
            canMoveDown={index < option.values.length - 1}
            onChange={(change) => {
              setValues(
                option.values.map((entry) =>
                  entry.key === value.key ? { ...entry, ...change } : entry
                )
              );
            }}
            onEnter={() => {
              addValue(index);
            }}
            onMove={(direction) => {
              setValues(swap(option.values, index, index + direction));
            }}
            onRemove={() => {
              setValues(option.values.filter((entry) => entry.key !== value.key));
            }}
          />
        ))}

        {problem ? <FieldStatus status="error">{problem.message}</FieldStatus> : null}

        <div>
          <Button
            size="sm"
            variant="outline"
            color="module"
            disabled={option.values.length >= MAX_VALUES}
            onClick={() => {
              addValue(option.values.length - 1);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add {name === '' ? 'an option' : `a ${name.toLowerCase()}`}
          </Button>
          {/* A <Text>, not a <FieldDescription> — the latter reads a Field
              context that is not here, and takes the pane down with it. */}
          <Text className="mt-1.5 text-sm">Or press Enter in any of them to add the next one.</Text>
        </div>
      </div>

      {/* Removing an axis is rare and it takes SKUs off sale when committed. As a
          card of its own beside the fields someone came here to edit it would
          carry the same weight as the work — a plain row after it is the honest
          rank. */}
      <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <Text>
          Remove this and every version that depends on it stops being sold. The summary at the top
          says exactly which.
        </Text>
        <Button size="sm" variant="ghost" color="danger" onClick={onRemove}>
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Remove {name === '' ? 'this choice' : name}
        </Button>
      </div>
    </FormSection>
  );
}
