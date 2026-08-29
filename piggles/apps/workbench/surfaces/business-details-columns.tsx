'use client';

// The two columns of the business record: what a document says about you on the
// left, what it charges and when on the right. Split out so business-details.tsx
// can be about loading and saving rather than about eighteen fields.

import { Checkbox, Field, FieldLabel, NativeSelect, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../components/form-section';
import { TextField, TimezoneField } from './business-details-fields';
import { ENTITY_TYPES, type FormState } from './business-details-form';
import type { TimezoneOption } from '../lib/timezones';

interface ColumnProps {
  form: FormState;
  set: (key: keyof FormState) => (value: string) => void;
  setForm: (update: (prev: FormState) => FormState) => void;
}

export function BusinessMainColumn({
  form,
  set,
  emailError,
  onEmailBlur,
}: Omit<ColumnProps, 'setForm'> & { emailError: string | null; onEmailBlur: () => void }) {
  return (
    <>
      <FormSection
        title="Business"
        description="Who you are as a business. This is what gets printed on invoices, receipts and purchase orders — it is not the name of any of your sites."
      >
        {/* No placeholder. Every placeholder in this form is a FORMAT hint
            ("Suite, unit, floor", "US", "USD") and a business name has no
            format, so the only thing one can hold is an example — which is how
            this box came to suggest the name of the company selling her the
            software (issue 321). The label and description say what goes here. */}
        <TextField
          label="Business name"
          value={form.businessName}
          onChange={set('businessName')}
          description="The name customers know you by. It may differ from your registered company name."
        />
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field>
            <FieldLabel>Business type</FieldLabel>
            <NativeSelect
              color="module"
              aria-label="Business type"
              value={form.entityType}
              onChange={(event) => {
                set('entityType')(event.target.value);
              }}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <TextField
            label="Company number"
            value={form.registrationNumber}
            onChange={set('registrationNumber')}
            description="As issued when you registered the business."
          />
        </div>
      </FormSection>

      <FormSection
        title="Address"
        description="Where the business is registered. This prints under your name on documents you send."
      >
        <TextField label="Street" value={form.addressLine1} onChange={set('addressLine1')} />
        <TextField
          label="Street line 2"
          value={form.addressLine2}
          onChange={set('addressLine2')}
          placeholder="Suite, unit, floor"
        />
        <div className="grid gap-4 @lg:grid-cols-3">
          <TextField label="City" value={form.city} onChange={set('city')} />
          <TextField label="State / region" value={form.region} onChange={set('region')} />
          <TextField label="Postal code" value={form.postalCode} onChange={set('postalCode')} />
        </div>
        <TextField
          label="Country"
          value={form.country}
          onChange={set('country')}
          placeholder="US"
          description="Two-letter country code, e.g. US, GB, AU."
        />
      </FormSection>

      <FormSection
        title="Contact"
        description="How customers reach you. Shown on documents alongside your address."
      >
        <div className="grid gap-4 @lg:grid-cols-2">
          <TextField label="Phone" value={form.phone} onChange={set('phone')} />
          <TextField
            label="Support email"
            type="email"
            value={form.supportEmail}
            onChange={set('supportEmail')}
            error={emailError}
            onBlur={onEmailBlur}
            description="Where customers should write with a question."
          />
        </div>
      </FormSection>
    </>
  );
}

export function BusinessRailColumn({
  form,
  set,
  setForm,
  zones,
}: ColumnProps & { zones: TimezoneOption[] }) {
  return (
    <>
      <FormSection title="Tax" description="Only filled in if you are registered to charge tax.">
        <label className="flex items-center gap-2">
          <Checkbox
            color="module"
            checked={form.taxRegistered}
            aria-label="Registered for sales tax or VAT"
            onChange={(event) => {
              const { checked } = event.target;
              setForm((prev) => ({ ...prev, taxRegistered: checked }));
            }}
          />
          <Text as="span">Registered for sales tax / VAT</Text>
        </label>
        <TextField
          label="Tax ID"
          value={form.taxId}
          onChange={set('taxId')}
          description="Your EIN, VAT, GST or ABN number."
        />
        {/* Printing a tax number you are not registered under is a compliance
            problem, not a cosmetic one — so say plainly that the toggle, not the
            field, decides. */}
        {form.taxId.trim() && !form.taxRegistered ? (
          <Text className="text-warning text-sm">
            This will not be shown on documents until you tick the box above.
          </Text>
        ) : null}
      </FormSection>

      <FormSection title="Defaults" description="Used when nothing more specific applies.">
        <TextField
          label="Currency"
          value={form.defaultCurrency}
          onChange={set('defaultCurrency')}
          placeholder="USD"
          description="Three-letter code, e.g. USD, GBP, AUD."
        />
        <TimezoneField value={form.timezone} zones={zones} onChange={set('timezone')} />
      </FormSection>
    </>
  );
}
