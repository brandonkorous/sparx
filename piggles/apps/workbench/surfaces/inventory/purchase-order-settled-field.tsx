// A value on an order that is settled and can no longer be typed into.

import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldLabel } from '@wizeworks/silicaui-react';

/** Full ink, no box, nothing suggesting it can be typed into (issue 494).
 *  `min-h-10` is the silica field height, so it lines up with live controls. */
export function SettledField({
  label,
  value,
  empty,
  description,
}: {
  label: string;
  value: string | null;
  /** Said in words when there is nothing, because a blank cannot be read. */
  empty: string;
  description?: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <p className="flex min-h-10 items-center text-sm">
        {value === null || value === '' ? empty : value}
      </p>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}
