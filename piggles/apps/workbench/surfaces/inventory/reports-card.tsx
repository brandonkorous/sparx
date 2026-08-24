'use client';

// The chrome every report card wears: a titled, ruled head over its content.
// Six cards used to repeat this block, which is six places a change to the
// house card would have to be found.

import { Heading, Text } from '@wizeworks/silicaui-react';
import { Icon, type IconGlyph } from '@piggles/ui';
import type { ReactNode } from 'react';

export function ReportCard({
  title,
  blurb,
  glyph,
  aside,
  children,
}: {
  title: string;
  blurb?: ReactNode;
  glyph?: IconGlyph;
  /** Sits opposite the title — a badge, or a control the card is about. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-wrap items-start justify-between gap-2 border-b pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading level={2} className="flex items-center gap-2 text-lg font-semibold">
            {glyph ? <Icon glyph={glyph} className="size-4" aria-hidden /> : null}
            {title}
          </Heading>
          {blurb ? <Text className="text-sm">{blurb}</Text> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Literal classes, not `text-${tone}` — the compiler only emits what it can
 *  see written out. */
const TONE = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  module: 'text-module',
} as const;

export type FigureTone = keyof typeof TONE;

/** One big number under its label — the shape every figure on this pane takes. */
export function Figure({
  value,
  label,
  tone,
}: {
  value: string;
  label: ReactNode;
  tone?: FigureTone;
}) {
  return (
    <div className="flex flex-col">
      <Text className={`text-2xl font-semibold tabular-nums ${tone ? TONE[tone] : ''}`}>
        {value}
      </Text>
      <Text className="text-sm">{label}</Text>
    </div>
  );
}
