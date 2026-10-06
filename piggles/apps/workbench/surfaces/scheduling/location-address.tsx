'use client';

// Where a place is — the postal address a customer reads, and the optional map
// pin.
//
// Its own file because it is the long half of the form and shares nothing with
// the rest of it but the draft: a market stall and a clinic do not need the same
// lines, so every field here is optional and none of them gates the save.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
} from '@wizeworks/silicaui-react';
import { CountryField } from '../../components/country-field';
import { FormSection } from '../../components/form-section';
import type { Coordinates, Draft } from './location-draft';

type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

/** One text line of the address. Twelve near-identical Fields is what this
 *  screen was before; the differences are the label and the field.
 *
 *  No made-up example sits in the box (issue 086): a grey "123 Main St" in an
 *  empty field reads as an address already on file. */
function AddressLine({
  label,
  field,
  draft,
  set,
}: {
  label: string;
  field: keyof Pick<Draft, 'line1' | 'line2' | 'city' | 'region' | 'postalCode' | 'country'>;
  draft: Draft;
  set: SetField;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft[field]}
            onChange={(event) => {
              set(field, event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

/** One half of the map pin. Both halves or neither — the error belongs to the
 *  PAIR, so only the second field carries it. */
function PinField({
  label,
  field,
  draft,
  set,
  error,
}: {
  label: string;
  field: 'lat' | 'lng';
  draft: Draft;
  set: SetField;
  error?: string | null;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            inputMode="decimal"
            value={draft[field]}
            onChange={(event) => {
              set(field, event.target.value);
            }}
          />
        }
      />
      {error === undefined ? null : error ? (
        <FieldStatus status="error">{error}</FieldStatus>
      ) : (
        <FieldDescription>Used to drop a map pin. Leave both empty to skip.</FieldDescription>
      )}
    </Field>
  );
}

function Pin({ draft, set, error }: { draft: Draft; set: SetField; error: string | null }) {
  return (
    <div className="grid gap-3 @md:grid-cols-2">
      <PinField label="Latitude (optional)" field="lat" draft={draft} set={set} />
      <PinField label="Longitude (optional)" field="lng" draft={draft} set={set} error={error} />
    </div>
  );
}

export function LocationAddressSection({
  draft,
  set,
  coordinates,
}: {
  draft: Draft;
  set: SetField;
  coordinates: Coordinates;
}) {
  return (
    <FormSection
      title="Where it is"
      description="Shown to customers on your booking page. Fill in as much as makes sense: a market stall and a clinic do not need the same lines."
    >
      <AddressLine label="Street" field="line1" draft={draft} set={set} />
      <AddressLine label="Unit, floor or suite (optional)" field="line2" draft={draft} set={set} />
      <div className="grid gap-3 @md:grid-cols-2">
        <AddressLine label="Town or city" field="city" draft={draft} set={set} />
        <AddressLine label="State, county or region" field="region" draft={draft} set={set} />
        <AddressLine label="Postal code" field="postalCode" draft={draft} set={set} />
        {/* Picked by name, not typed. This line had no guidance at all,
            which is how one place came to be stored as "United States" while
            every other address in every other table holds "US". Issue 721. */}
        <CountryField
          value={draft.country}
          onChange={(next) => {
            set('country', next);
          }}
        />
      </div>

      <Pin draft={draft} set={set} error={coordinates.error} />
    </FormSection>
  );
}
