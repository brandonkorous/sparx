// Hover3DCard — a card that tilts in 3D on hover (docs/46 §5.2). SERVER component,
// structural (CSS perspective + transform; no JS pointer tracking). Reduced-motion
// disables the tilt.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface Hover3DCardProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Hover3DCard({
  className,
  style,
  id,
  children,
}: Hover3DCardProps): React.ReactElement {
  return (
    <div className={cx('sf-card3d', className)} style={style} id={id}>
      <div className="sf-card3d__inner">{children}</div>
    </div>
  );
}
Hover3DCard.displayName = 'Hover3DCard';
