'use client';

// Where the place is. Its own file because an address is a self-contained thing
// with its own validity rule — required to create, and required once touched on
// an edit, but never for a plain rename.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';
import { CountryField } from '../../components/country-field';
import { FormSection } from '../../components/form-section';
import { useBusinessAddress } from '../../lib/business-address';
import { cleanCountry, type Draft } from './location-draft';
import { addressLine, businessAddressOffer } from './location-ship-from';

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
              placeholder="123 Main St"
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

/** Business details' address, offered when this place lacks what a courier
 *  needs. It fills the fields and saves nothing; Save does that (issue 929). */
function BusinessAddressOffer({ draft, set }: PartProps) {
  const offer = businessAddressOffer(useBusinessAddress(), draft);
  if (!offer) return null;
  return (
    <Alert color="info" variant="soft">
      <AlertContent>
        <AlertTitle>Is it at your business address?</AlertTitle>
        <AlertDescription>Business details has {addressLine(offer)}.</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          size="sm"
          color="module"
          onClick={() => {
            set('line1', offer.line1);
            set('line2', offer.line2);
            set('city', offer.city);
            set('region', offer.region);
            set('postalCode', offer.postalCode);
            set('country', offer.country);
          }}
        >
          Use this address
        </Button>
      </AlertActions>
    </Alert>
  );
}

/** Town, region, postal code and country on one grid — they are read as one line on
 *  an envelope, so they are entered as one block. */
function PlaceLines({ draft, set, shipsFrom }: PartProps & { shipsFrom: boolean }) {
  return (
    <div className="grid gap-4 @md:grid-cols-2">
      <Field>
        <FieldLabel>Town or city</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.city}
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
              onChange={(event) => {
                set('region', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        {/* Not optional where parcels leave from: a courier prices postage
            from it, and the server refuses a label without it. */}
        <FieldLabel>{shipsFrom ? 'Postal code' : 'Postal code (optional)'}</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.postalCode}
              onChange={(event) => {
                set('postalCode', event.target.value);
              }}
            />
          }
        />
      </Field>

      {/* Picked by name. This field used to be a two-character box under a
          line teaching her that Germany is DE - a filing system asked to be
          learned, on the screen where she writes down where her own stock is.
          `lib/geo.ts` has said "a shop owner should never SEE a code" since it
          was written. Issue 721. */}
      <CountryField
        value={draft.country}
        onChange={(next) => {
          set('country', cleanCountry(next));
        }}
      />
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
            placeholder="+1 555 010 0000"
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
          A street address, a town or city and a country are needed before this can be saved.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function LocationAddress({
  draft,
  set,
  showAddrWarning,
  shipsFrom,
}: PartProps & { showAddrWarning: boolean; shipsFrom: boolean }) {
  return (
    <FormSection
      title="Where it is"
      description="Used on paperwork, and by couriers. A virtual location can leave most of this alone."
    >
      <BusinessAddressOffer draft={draft} set={set} />
      <StreetLines draft={draft} set={set} />
      <PlaceLines draft={draft} set={set} shipsFrom={shipsFrom} />
      <PhoneLine draft={draft} set={set} />
      <AddressWarning show={showAddrWarning} />
    </FormSection>
  );
}
