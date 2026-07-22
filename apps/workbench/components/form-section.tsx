'use client';

// A labelled group of fields.
//
// A long form with no grouping is a wall — every field carries the same weight,
// so nothing tells you where "who is this for" ends and "what are they being
// charged" begins. Grouping is what makes a form skimmable by someone who only
// needs to change one thing.
//
// It's a real <section> with a real heading, so the grouping exists for screen
// readers and for the browser's landmark navigation, not just visually.

import { Heading, Text } from '@wizeworks/silicaui-react';

interface FormSectionProps {
  title: string;
  /** One line on what this group is for, in plain language. Optional — a
   *  self-evident group doesn't need explaining, and filler is worse than none. */
  description?: string;
  /** Right-aligned slot on the heading row for a section-level action. */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function FormSection({ title, description, action, children }: FormSectionProps) {
  return (
    <section className="card bg-base-100 flex flex-col gap-4 p-4">
      <div className="border-base-300 flex items-start justify-between gap-3 border-b pb-2">
        <div className="flex flex-col gap-0.5">
          {/* Has to clearly outrank a FieldLabel (14px/500) or the grouping does
              no work — at the same size and weight a section title reads as just
              one more field. Rank comes from scale and weight; the ink stays at
              full strength throughout. */}
          <Heading level={2} className="text-lg font-semibold">
            {title}
          </Heading>
          {description ? <Text className="text-sm">{description}</Text> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
