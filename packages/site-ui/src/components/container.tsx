// Container — a max-width content wrapper (docs/47 §11 B1). Centers content and
// caps it at a width; the `lg` default reads the tenant `--st-container` token.
// SERVER component — pure markup + classes, no color axis (purely structural).

import * as React from 'react';
import { cx } from '../utils/cx';

export type ContainerWidth = 'sm' | 'md' | 'lg' | 'full';

export interface ContainerProps {
  /** Max content width. `lg` reads `--st-container`; `full` removes the cap.
   *  Defaults to `lg`. */
  width?: ContainerWidth;
  /** Semantic element. Defaults to `div`. */
  as?: 'div' | 'section' | 'main' | 'article';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const WIDTH_CLASS: Record<ContainerWidth, string> = {
  sm: 'st-container--sm',
  md: 'st-container--md',
  lg: 'st-container--lg',
  full: 'st-container--full',
};

export function Container({
  width = 'lg',
  as = 'div',
  className,
  style,
  id,
  children,
}: ContainerProps): React.ReactElement {
  const Tag = as as React.ElementType;
  return (
    <Tag className={cx('st-container', WIDTH_CLASS[width], className)} style={style} id={id}>
      {children}
    </Tag>
  );
}
Container.displayName = 'Container';
