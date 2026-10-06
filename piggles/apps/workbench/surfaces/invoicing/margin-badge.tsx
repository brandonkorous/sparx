'use client';

// The margin on a line as a state on it (sparx persona issue 086): green is
// healthy, amber thin, red below cost. Shared by the line editor and the row.

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
