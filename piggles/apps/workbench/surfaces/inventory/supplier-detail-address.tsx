'use client';

// Where a supplier is, and the notes kept about them: the last two sections of
// the supplier form.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Textarea,
} from '@wizeworks/silicaui-react';
import { CountryField } from '../../components/country-field';
import { FormSection } from '../../components/form-section';
import { SupplierTextField, type SupplierSectionProps } from './supplier-detail-fields';

function StreetFields({ form, set }: SupplierSectionProps) {
  return (
    <>
      <SupplierTextField
        label="Street"
        className="@md:col-span-2"
        value={form.line1}
        placeholder="1 Trade Park Way"
        onValue={(next) => {
          set('line1', next);
        }}
      />
      <SupplierTextField
        label="Street line 2"
        className="@md:col-span-2"
        value={form.line2}
        placeholder="Unit 4"
        onValue={(next) => {
          set('line2', next);
        }}
      />
    </>
  );
}

export function SupplierAddressSection({ form, set }: SupplierSectionProps) {
  return (
    <FormSection title="Address">
      <div className="grid gap-3 @md:grid-cols-2">
        <StreetFields form={form} set={set} />
        <SupplierTextField
          label="Town or city"
          value={form.city}
          onValue={(next) => {
            set('city', next);
          }}
        />
        <SupplierTextField
          label="Region or state"
          value={form.region}
          onValue={(next) => {
            set('region', next);
          }}
        />
        <SupplierTextField
          label="Postal code"
          value={form.postalCode}
          onValue={(next) => {
            set('postalCode', next);
          }}
        />
        {/* Picked by name: a two-character box asked somebody to know that
            Germany is DE before they could say where a business is. Issue 721. */}
        <CountryField
          value={form.country}
          onChange={(next) => {
            set('country', next);
          }}
        />
      </div>
    </FormSection>
  );
}

export function SupplierNotesSection({ form, set }: SupplierSectionProps) {
  return (
    <FormSection title="Notes">
      <Field>
        <FieldLabel>Anything worth remembering</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={4}
              value={form.notes}
              placeholder="Minimum order, delivery days, who to ask for…"
              onChange={(event) => {
                set('notes', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>Only you see this. It never appears on an order.</FieldDescription>
      </Field>
    </FormSection>
  );
}
