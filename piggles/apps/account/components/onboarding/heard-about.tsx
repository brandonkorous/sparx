'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { HEARD_ABOUT_OPTIONS } from '@/lib/heard-about';

/** One optional question. Leaving it on "Skip this" is a complete answer. */
export function HeardAboutField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>Where did you hear about Piggles?</FieldLabel>
      {/* Through FieldControl, or the label points at nothing (issue #006). */}
      <FieldControl
        render={<NativeSelect size="lg" />}
        name="heardAbout"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Skip this</option>
        {HEARD_ABOUT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </FieldControl>
      <FieldDescription>
        Optional. It tells us what is working, so we can do more of it.
      </FieldDescription>
    </Field>
  );
}
