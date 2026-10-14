'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import type { Draft, SetDraftField } from './bin-draft';

interface WorkedProps {
  draft: Draft;
  set: SetDraftField;
}

function DefaultShelfSwitch({ draft, set }: WorkedProps) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        color="module"
        checked={draft.isDefault}
        aria-label="Put things here when nobody says which shelf"
        onCheckedChange={(checked) => {
          set('isDefault', checked);
        }}
      />
      <div className="flex flex-col">
        <Text>Put things here when nobody says which shelf</Text>
        <Text className="text-sm">
          {draft.isDefault
            ? 'Deliveries, transfers and returns land here unless somebody scans a different shelf. Only one shelf per location can be this, so turning it on turns it off elsewhere.'
            : 'One shelf in each location has to be this, or nothing can be booked in there at all. Turning it on here turns it off wherever it is now.'}
        </Text>
      </div>
    </div>
  );
}

function BinCountFields({ draft, set }: WorkedProps) {
  return (
    <>
      <Field>
        <FieldLabel>Walk order</FieldLabel>
        <FieldDescription>
          Lower numbers come first when someone is picking. Leave it blank and this shelf sorts to
          the end.
        </FieldDescription>
        <FieldControl
          render={
            <Input
              type="number"
              min={0}
              value={draft.pickSequence}
              onChange={(event) => {
                set('pickSequence', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>How much it holds</FieldLabel>
        <FieldDescription>
          A guide, not a limit. Nothing is ever refused for going over: a system that will not let
          you record where something actually is just gets worked around.
        </FieldDescription>
        <FieldControl
          render={
            <Input
              type="number"
              min={1}
              value={draft.capacityUnits}
              onChange={(event) => {
                set('capacityUnits', event.target.value);
              }}
            />
          }
        />
      </Field>
    </>
  );
}

export function BinWorkedSection({ draft, set }: WorkedProps) {
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <Heading level={2} className="text-lg font-semibold">
        How it is worked
      </Heading>

      {/* Every put-away (delivery, transfer, return) falls back to the default shelf.
          A location with shelves on and none marked refuses all three, and this
          switch is the only place that fixes it. */}
      <DefaultShelfSwitch draft={draft} set={set} />

      <BinCountFields draft={draft} set={set} />

      <Field>
        <FieldLabel>Notes</FieldLabel>
        <FieldControl
          render={
            <Input
              value={draft.notes}
              onChange={(event) => {
                set('notes', event.target.value);
              }}
            />
          }
        />
      </Field>
    </section>
  );
}
