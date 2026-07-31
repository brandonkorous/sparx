// Hover3DCard — a container whose contents tilt in 3D on hover.
//
// One of the sparx components filling a gap in silicaui (root CLAUDE.md RULE #1).
// It paints nothing itself — no background, no border, no ink — so whatever is
// dropped inside (usually a silica `card`) keeps its own theming and this only
// contributes the perspective + tilt. That is why it is a plain Tailwind
// composition rather than a re-skin of a silica control.
//
// SERVER component: the tilt is a CSS hover transform, not pointer tracking, so
// no JavaScript ships. `motion-safe:` gates it — a visitor who asked their OS for
// reduced motion gets a static card.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

export interface Hover3DCardProps {
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

export function Hover3DCard({ className, id, children }: Hover3DCardProps): React.ReactElement {
  return (
    <div className={cx('group perspective-distant', className)} id={id}>
      <div className="transition-transform duration-300 ease-out transform-3d motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-x-6 motion-safe:group-hover:rotate-y-6">
        {children}
      </div>
    </div>
  );
}
Hover3DCard.displayName = 'Hover3DCard';
