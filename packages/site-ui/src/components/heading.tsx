// Heading — h1/h2/h3 in the tenant heading font (docs/46 §5.2).
// SERVER component. Harvested from the storefront renderer's `headingStyle`
// (the parity baseline): sizes 2.5 / 1.75 / 1.25rem, weight 600, line-height
// 1.15. Themed by --sf-font-heading.

import * as React from 'react';
import { cx } from '../utils/cx';

export type HeadingLevel = 'h1' | 'h2' | 'h3';

export interface HeadingProps {
  level?: HeadingLevel;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const LEVEL_CLASS: Record<HeadingLevel, string> = {
  h1: 'sf-h--1',
  h2: 'sf-h--2',
  h3: 'sf-h--3',
};

export function Heading({ level = 'h2', className, style, id, children }: HeadingProps) {
  const Tag = level;
  return (
    <Tag className={cx('sf-h', LEVEL_CLASS[level], className)} style={style} id={id}>
      {children}
    </Tag>
  );
}
Heading.displayName = 'Heading';
