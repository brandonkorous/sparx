'use client';

// The margin on a line, as a state on it (sparx persona issue 086).
//
// Its color IS the reading: green is a healthy margin, amber a thin one, red a
// line that sells below cost. One badge, used by the line editor while a price
// is typed and by the line row once it is on the quote, so both say the same
// thing in the same words. Staff only: nothing here is ever sent to a customer.

import { Badge } from '@wizeworks/silicaui-react';
import { marginWords, type LineMargin } from './line-margin';

export function MarginBadge({
  margin,
  currency,
  size,
}: {
  margin: LineMargin;
  currency: string;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge color={margin.tone} variant="soft" {...(size ? { size } : {})}>
      {marginWords(margin, currency)}
    </Badge>
  );
}
