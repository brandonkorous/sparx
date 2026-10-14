'use client';

import { Field, FieldControl, FieldLabel, Heading, Input, Text } from '@wizeworks/silicaui-react';
import type { Draft, SetDraftField } from './bin-draft';

export function BinWhereSection({ draft, set }: { draft: Draft; set: SetDraftField }) {
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <Heading level={2} className="text-lg font-semibold">
          Where it is
        </Heading>
        <Text className="text-sm">
          Fill in whichever of these your place actually uses. They are only here to group and find
          shelves, so blanks are fine.
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-4">
        {(
          [
            ['zone', 'Zone'],
            ['aisle', 'Aisle'],
            ['rack', 'Rack'],
            ['shelf', 'Shelf'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key}>
            <FieldLabel>{label}</FieldLabel>
            <FieldControl
              render={
                <Input
                  value={draft[key]}
                  onChange={(event) => {
                    set(key, event.target.value);
                  }}
                />
              }
            />
          </Field>
        ))}
      </div>
    </section>
  );
}
