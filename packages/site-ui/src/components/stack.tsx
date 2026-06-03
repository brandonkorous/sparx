// Stack — vertical or horizontal flow with a gap scale (docs/47 §11 B1). The
// flexbox workhorse for one-dimensional layout, with optional alignment and
// justification. SERVER component — purely structural, no color axis.

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

export type StackDirection = 'vertical' | 'horizontal';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface StackProps {
  /** Flow axis. Defaults to `vertical`. */
  direction?: StackDirection;
  /** Gap between children. Defaults to `md`. */
  gap?: SizeKey;
  /** Cross-axis alignment (`align-items`). */
  align?: StackAlign;
  /** Main-axis distribution (`justify-content`). */
  justify?: StackJustify;
  /** Allow children to wrap onto multiple lines. Defaults to false. */
  wrap?: boolean;
  /** Semantic element. Defaults to `div`. */
  as?: 'div' | 'ul' | 'ol' | 'section' | 'nav';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const GAP_CLASS: Record<SizeKey, string> = {
  xs: 'sf-stack--gap-xs',
  sm: 'sf-stack--gap-sm',
  md: 'sf-stack--gap-md',
  lg: 'sf-stack--gap-lg',
  xl: 'sf-stack--gap-xl',
};
const ALIGN_CLASS: Record<StackAlign, string> = {
  start: 'sf-stack--align-start',
  center: 'sf-stack--align-center',
  end: 'sf-stack--align-end',
  stretch: 'sf-stack--align-stretch',
  baseline: 'sf-stack--align-baseline',
};
const JUSTIFY_CLASS: Record<StackJustify, string> = {
  start: 'sf-stack--justify-start',
  center: 'sf-stack--justify-center',
  end: 'sf-stack--justify-end',
  between: 'sf-stack--justify-between',
  around: 'sf-stack--justify-around',
};

export function Stack({
  direction = 'vertical',
  gap = 'md',
  align,
  justify,
  wrap = false,
  as = 'div',
  className,
  style,
  id,
  children,
}: StackProps): React.ReactElement {
  const Tag = as as React.ElementType;
  return (
    <Tag
      className={cx(
        'sf-stack',
        direction === 'horizontal' ? 'sf-stack--horizontal' : 'sf-stack--vertical',
        GAP_CLASS[gap],
        align && ALIGN_CLASS[align],
        justify && JUSTIFY_CLASS[justify],
        wrap && 'sf-stack--wrap',
        className
      )}
      style={style}
      id={id}
    >
      {children}
    </Tag>
  );
}
Stack.displayName = 'Stack';
