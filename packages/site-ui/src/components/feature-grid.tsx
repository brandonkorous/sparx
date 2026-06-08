// FeatureGrid — a responsive grid of feature cards (docs/51 §7). SERVER
// component. Takes resolved items; each renderer (live site + editor canvas)
// resolves bound-vs-inline itself, then hands them here so both render
// identically. Column count collapses to one on narrow containers via the
// shared `Grid` (its `md` breakpoint). Renders nothing when there are no items.
//
// Composition: COMPOSITE (docs/23 §17) — assembles Grid + Card + Text per item.

import * as React from 'react';
import { Card, CardBody, CardTitle } from './card';
import { Grid } from './grid';
import { Text } from './text';

export interface FeatureItem {
  number?: string;
  title: string;
  body?: string;
}

export interface FeatureGridProps {
  cols?: 2 | 3 | 4;
  items: FeatureItem[];
  className?: string;
}

export function FeatureGrid({
  cols = 3,
  items,
  className,
}: FeatureGridProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <Grid cols={cols} gap="lg" className={className}>
      {items.map((f, i) => (
        <Card key={i}>
          <CardBody>
            {f.number ? <Text variant="meta">{f.number}</Text> : null}
            <CardTitle as="h3">{f.title}</CardTitle>
            {f.body ? <Text variant="body">{f.body}</Text> : null}
          </CardBody>
        </Card>
      ))}
    </Grid>
  );
}
FeatureGrid.displayName = 'FeatureGrid';
