'use client';

import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from '@wizeworks/silicaui-react';
import { Section } from './section';

// Base UI's accordion is interactive, so it cannot render from a server
// component. This is the client boundary — the pages using it stay static.

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * The FAQ block, whole: heading, optional lede, and the disclosures.
 *
 * Shared because four surfaces had four different wrappers around the same
 * accordion — two column counts, two heading scales, sticky on one of them —
 * so the same content read as a different component on every page.
 */
export function FaqSection({
  heading,
  lede,
  items,
  className = '',
}: {
  /** ReactNode, not string: headings here color a word to carry the emphasis. */
  heading: ReactNode;
  lede?: string;
  items: FaqItem[];
  /** Lands on the panel, for a surface. Default is the page ground. */
  className?: string;
}) {
  return (
    <Section className={className}>
      {/* The heading is pinned and the questions scroll past it. A full-width
          stack of disclosures under a heading left half the panel empty. */}
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start lg:gap-14">
        <div className="lg:sticky lg:top-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">{heading}</h2>
          {lede ? <p className="mt-5 text-lg">{lede}</p> : null}
        </div>

        {/* `multiple`: opening one answer must not close the one you were half
            way through reading. */}
        <Accordion multiple className="bg-base-100 border-base-300 border-t">
          {items.map((item, i) => (
            <AccordionItem key={item.q} value={String(i)}>
              <AccordionTrigger className="py-5 text-left text-lg font-bold">
                {item.q}
              </AccordionTrigger>
              <AccordionPanel>
                {/* `pt-2`: without it the answer's first line sits on the
                    trigger's bottom edge and reads as part of the question. */}
                <p className="pt-2 pb-5 text-base">{item.a}</p>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
