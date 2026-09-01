'use client';

// The two fields and the one row that hang off the target picker, split from
// blueprint-detail-target under RULE #0.5. That file owns the picker, the
// sentence about what an install does, and the one action; this owns the
// controls that only appear in particular states.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { examplesSentence } from './blueprints-words';
import type { NewSiteTarget } from './blueprint-new-site';

/** Naming the site that does not exist yet. ONE field, not the whole New site
 *  form: this is a detour inside another job, so the handle is derived from the
 *  name and somebody who wants to choose their own address still has New site. */
export function NewSiteField({ newSite }: { newSite: NewSiteTarget }) {
  return (
    <Field>
      <FieldLabel>What to call it</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={newSite.name}
            placeholder="Sample Sale"
            autoComplete="off"
            aria-label="What to call the new site"
            onChange={(event) => {
              newSite.setName(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>
        {newSite.problem ??
          (newSite.host
            ? `It will be at ${newSite.host}, and you can point your own web address at it later.`
            : 'You can change the name later. The web address is fixed once the site exists.')}
      </FieldDescription>
    </Field>
  );
}

/** The choice the whole of issue 098 is about. Only shown before an install: once
 *  a design is in, the answer is a fact about it rather than a control. */
export function ExamplesField({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel>Bring its examples</FieldLabel>
      <FieldControl
        render={
          <Switch
            color="module"
            checked={value}
            disabled={disabled}
            onCheckedChange={onChange}
            aria-label="Bring this design's examples"
          />
        }
      />
      <FieldDescription>{examplesSentence(value)}</FieldDescription>
    </Field>
  );
}

export function RemoveRow({
  targetName,
  removing,
  disabled,
  onRemove,
}: {
  targetName: string;
  removing: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  // Removal is rare and irreversible, so it is a plain row under a divider —
  // never a button with equal weight to publishing.
  return (
    <div className="border-base-300 mt-1 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="flex min-w-0 flex-col">
        <Text className="font-medium">Remove this design from {targetName}</Text>
        <Text className="text-sm">
          Deletes everything it added to that site. This cannot be undone.
        </Text>
      </div>
      <Button
        variant="outline"
        color="danger"
        size="sm"
        loading={removing}
        disabled={disabled}
        onClick={onRemove}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        Remove
      </Button>
    </div>
  );
}
