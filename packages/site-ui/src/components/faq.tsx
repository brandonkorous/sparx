// FAQ — a list of question/answer pairs (docs/51 §7). SERVER component. Takes
// resolved entries; each renderer (live site + editor canvas) resolves
// bound-vs-inline itself, then hands them here so both render identically.
// Renders nothing when there are no entries.
//
// Composition: COMPOSITE (docs/23 §17) — assembles Heading + Text per entry.

import * as React from 'react';
import { cx } from '../utils/cx';
import { Heading } from './heading';
import { Text } from './text';

export interface FaqEntry {
  question: string;
  answer?: string;
}

export interface FaqProps {
  items: FaqEntry[];
  className?: string;
}

export function FAQ({ items, className }: FaqProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className={cx('sf-faq', className)}>
      {items.map((it, i) => (
        <div key={i} className="sf-faq__item">
          <Heading level="h3">{it.question}</Heading>
          {it.answer ? <Text variant="body">{it.answer}</Text> : null}
        </div>
      ))}
    </div>
  );
}
FAQ.displayName = 'FAQ';
