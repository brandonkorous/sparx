'use client';

// One labelled box in the domain registrant contact form.

import { Field, FieldControl, FieldLabel, FieldStatus, Input } from '@wizeworks/silicaui-react';

export function ContactField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  maxLength,
  className,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  type?: string;
  maxLength?: number;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            ref={inputRef}
            color={error ? 'error' : 'module'}
            type={type}
            value={value}
            onChange={onChange}
            maxLength={maxLength}
            className={className}
          />
        }
      />
      {error ? <FieldStatus status="error">{error}</FieldStatus> : null}
    </Field>
  );
}
