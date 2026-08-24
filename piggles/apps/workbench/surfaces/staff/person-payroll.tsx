'use client';

// PAYROLL AND NOTES — their id in whoever actually runs payroll, and anything
// else worth writing down about them.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { productCopy } from '../../lib/product';
import type { FormState } from './person-form';
import type { SetField } from './person-identity';

export function PersonPayroll({ form, set }: { form: FormState; set: SetField }) {
  return (
    <FormSection
      title="Payroll and notes"
      description={productCopy(
        'staff.payroll.sectionNote',
        'Piggles records hours and rates. Whoever runs your payroll gets the export.'
      )}
    >
      <Field>
        <FieldLabel>Their ID in your payroll system</FieldLabel>
        <FieldControl
          render={
            <Input
              value={form.externalPayrollId}
              onChange={(event) => {
                set('externalPayrollId', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          Carried on the hours export so nobody has to match names in a spreadsheet.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Notes</FieldLabel>
        <FieldControl
          render={
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => {
                set('notes', event.target.value);
              }}
            />
          }
        />
      </Field>
    </FormSection>
  );
}
