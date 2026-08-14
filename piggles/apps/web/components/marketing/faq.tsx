'use client';

import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from '@wizeworks/silicaui-react';

// A thin client boundary around silica's Accordion.
//
// Base UI's accordion is interactive, so it cannot be rendered from a server
// component — and the pages that need an FAQ are otherwise entirely static. This
// keeps the boundary at the one element that actually needs it rather than
// marking a whole page `use client` to get a disclosure widget.
//
// `multiple` on purpose: an FAQ where opening the answer you want closes the one
// you were half way through reading is a widget being clever at the reader's
// expense.

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion multiple className="border-base-300 border-t">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={String(i)}>
          <AccordionTrigger className="py-5 text-left text-lg font-bold">{item.q}</AccordionTrigger>
          <AccordionPanel>
            <p className="pb-5 text-base">{item.a}</p>
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
