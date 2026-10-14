'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import type { physicalLocations } from './data';
import { BIN_TYPES } from './bins-data';
import type { Draft, SetDraftField } from './bin-draft';

interface WhatProps {
  draft: Draft;
  set: SetDraftField;
  isNew: boolean;
  isSystem: boolean;
  activeLocations: ReturnType<typeof physicalLocations>;
}

function BinLocationField({ draft, set, isNew, activeLocations }: WhatProps) {
  return (
    <Field>
      <FieldLabel>Location</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            value={draft.warehouseId}
            disabled={!isNew}
            onChange={(event) => {
              set('warehouseId', event.target.value);
            }}
          >
            <option value="">Choose a location…</option>
            {activeLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {!isNew ? (
        <FieldDescription>
          A shelf cannot move between locations. Add one at the other place instead.
        </FieldDescription>
      ) : null}
    </Field>
  );
}

function BinKindField({ draft, set, isSystem }: WhatProps) {
  return (
    <Field>
      <FieldLabel>Kind</FieldLabel>
      <FieldDescription>
        {BIN_TYPES.find((t) => t.value === draft.type)?.hint ?? ''}
      </FieldDescription>
      <FieldControl
        render={
          <NativeSelect
            value={draft.type}
            disabled={isSystem}
            onChange={(event) => {
              set('type', event.target.value);
            }}
          >
            {BIN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </Field>
  );
}

export function BinWhatSection(props: WhatProps) {
  const { draft, set, isSystem } = props;
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <Heading level={2} className="text-lg font-semibold">
        What this shelf is
      </Heading>

      <Field>
        <FieldLabel>Label</FieldLabel>
        <FieldDescription>
          What is written on the shelf. People type this on a phone next to the rack, so keep it
          short.
        </FieldDescription>
        <FieldControl
          render={
            <Input
              value={draft.code}
              disabled={isSystem}
              placeholder="A-01-03"
              onChange={(event) => {
                set('code', event.target.value.toUpperCase());
              }}
            />
          }
        />
      </Field>

      <BinLocationField {...props} />
      <BinKindField {...props} />

      <Field>
        <FieldLabel>Description</FieldLabel>
        <FieldControl
          render={
            <Input
              value={draft.name}
              placeholder="Front bay, top shelf"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
      </Field>
    </section>
  );
}
