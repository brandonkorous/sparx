'use client';

// Who a supplier is, how to reach them and the terms that usually apply: the
// first three sections of the supplier form.

import type { ReactNode } from 'react';
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { CurrencyField } from '../../components/currency-field';
import type { SupplierFormFields } from './supplier-input';
import type { SetSupplierField } from './supplier-detail-model';

interface TextFieldProps {
  label: string;
  value: string;
  onValue: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  spellCheck?: boolean;
  autoComplete?: string;
  type?: string;
  min?: number;
  inputMode?: 'numeric';
  children?: ReactNode;
}

export function SupplierTextField(props: TextFieldProps) {
  const { label, value, onValue, required, className, children, ...input } = props;
  return (
    <Field className={className}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            {...input}
            value={value}
            onChange={(event) => {
              onValue(event.target.value);
            }}
          />
        }
      />
      {children}
    </Field>
  );
}

export interface SupplierSectionProps {
  form: SupplierFormFields;
  set: SetSupplierField;
}

export function SupplierWhoSection({
  form,
  set,
  touched,
  codeOk,
}: SupplierSectionProps & { touched: boolean; codeOk: boolean }) {
  return (
    <FormSection title="Who they are">
      <div className="grid gap-3 @md:grid-cols-2">
        <SupplierTextField
          label="Name"
          required
          value={form.name}
          placeholder="Acme Wholesale"
          onValue={(next) => {
            set('name', next);
          }}
        >
          {touched && form.name.trim() === '' ? (
            <FieldStatus status="error">A supplier needs a name.</FieldStatus>
          ) : null}
        </SupplierTextField>
        <SupplierTextField
          label="Short code"
          required
          value={form.code}
          placeholder="ACME"
          spellCheck={false}
          autoComplete="off"
          onValue={(next) => {
            set('code', next);
          }}
        >
          {form.code.trim() !== '' && !codeOk ? (
            <FieldStatus status="error">
              Use only letters, numbers, hyphens or underscores.
            </FieldStatus>
          ) : (
            <FieldDescription>
              A short handle printed on orders, like ACME. Must be unique.
            </FieldDescription>
          )}
        </SupplierTextField>
      </div>
    </FormSection>
  );
}

export function SupplierReachSection({ form, set }: SupplierSectionProps) {
  return (
    <FormSection title="How to reach them">
      <div className="grid gap-3 @md:grid-cols-2">
        <SupplierTextField
          label="Contact name"
          value={form.contactName}
          placeholder="Who you deal with"
          onValue={(next) => {
            set('contactName', next);
          }}
        />
        <SupplierTextField
          label="Email"
          type="email"
          value={form.email}
          placeholder="orders@acme.com"
          spellCheck={false}
          onValue={(next) => {
            set('email', next);
          }}
        />
        <SupplierTextField
          label="Phone"
          value={form.phone}
          placeholder="(555) 010-0100"
          onValue={(next) => {
            set('phone', next);
          }}
        />
        <SupplierTextField
          label="Website"
          value={form.website}
          placeholder="acme.com"
          spellCheck={false}
          onValue={(next) => {
            set('website', next);
          }}
        />
      </div>
    </FormSection>
  );
}

export function SupplierTermsSection({ form, set }: SupplierSectionProps) {
  return (
    <FormSection
      title="Default terms"
      description="What usually applies when you order from them. You can change any of it on an individual order."
    >
      <div className="grid gap-3 @md:grid-cols-3">
        <SupplierTextField
          label="How you pay"
          value={form.paymentTerms}
          placeholder="net 30"
          onValue={(next) => {
            set('paymentTerms', next);
          }}
        >
          <FieldDescription>e.g. net 30, cash on delivery.</FieldDescription>
        </SupplierTextField>
        <SupplierTextField
          label="Days to arrive"
          type="number"
          min={0}
          inputMode="numeric"
          value={form.leadTimeDays}
          onValue={(next) => {
            set('leadTimeDays', next);
          }}
        >
          <FieldDescription>
            Their usual delivery time. It sets each new order&apos;s expected date. Left blank,
            orders have no expected date until you give one.
          </FieldDescription>
        </SupplierTextField>
        <CurrencyField
          value={form.currency}
          onChange={(next) => {
            set('currency', next);
          }}
          description="What this supplier bills you in."
        />
      </div>
    </FormSection>
  );
}
