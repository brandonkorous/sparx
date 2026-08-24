'use client';

// Where the place is. Its own file because an address is a self-contained thing
// with its own validity rule — required to create, and required once touched on
// an edit, but never for a plain rename.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { cleanCountry, type Draft } from './location-draft';

interface PartProps {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}

function StreetLines({ draft, set }: PartProps) {
  return (
    <>
      <Field>
        <FieldLabel>Street address</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.line1}
              placeholder="14 Mill Lane"
              onChange={(event) => {
                set('line1', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>Unit, suite or floor (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.line2}
              placeholder="Unit 3"
              onChange={(event) => {
                set('line2', event.target.value);
              }}
            />
          }
        />
      </Field>
    </>
  );
}

/** Town, region, postcode and country on one grid — they are read as one line on
 *  an envelope, so they are entered as one block. */
function PlaceLines({ draft, set }: PartProps) {
  return (
    <div className="grid gap-4 @md:grid-cols-2">
      <Field>
        <FieldLabel>Town or city</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.city}
              placeholder="Bristol"
              onChange={(event) => {
                set('city', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>County, state or region (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.region}
              placeholder="Somerset"
              onChange={(event) => {
                set('region', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>Postcode or ZIP (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.postalCode}
              placeholder="BS1 4RW"
              onChange={(event) => {
                set('postalCode', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>Country</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.country}
              placeholder="GB"
              className="max-w-24 font-mono uppercase"
              onChange={(event) => {
                set('country', cleanCountry(event.target.value));
              }}
            />
          }
        />
        <FieldDescription>
          The two-letter country code — GB for the United Kingdom, US for the United States, DE for
          Germany.
        </FieldDescription>
      </Field>
    </div>
  );
}

function PhoneLine({ draft, set }: PartProps) {
  return (
    <Field>
      <FieldLabel>Phone (optional)</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.phone}
            placeholder="+44 117 496 0000"
            onChange={(event) => {
              set('phone', event.target.value);
            }}
          />
        }
      />
      <FieldDescription>
        A number for this place, in case a delivery or a courier needs it.
      </FieldDescription>
    </Field>
  );
}

/** Names exactly what is missing, only once the address is required but not yet
 *  complete — a rename never triggers this. */
function AddressWarning({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>The address needs a little more</AlertTitle>
        <AlertDescription>
          A street address, a town or city, and a two-letter country code are needed before this can
          be saved.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function LocationAddress({
  draft,
  set,
  showAddrWarning,
}: PartProps & { showAddrWarning: boolean }) {
  return (
    <FormSection
      title="Where it is"
      description="Used on paperwork, and by couriers. A virtual location can leave most of this alone."
    >
      <StreetLines draft={draft} set={set} />
      <PlaceLines draft={draft} set={set} />
      <PhoneLine draft={draft} set={set} />
      <AddressWarning show={showAddrWarning} />
    </FormSection>
  );
}
