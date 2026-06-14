// Heading — h1/h2/h3 in the tenant heading font (docs/46 §5.2).
// SERVER component. Harvested from the site renderer's `headingStyle`
// (the parity baseline): sizes 2.5 / 1.75 / 1.25rem, weight 600, line-height
// 1.15. Themed by --st-font-heading.

import * as React from 'react';
import { cx } from '../utils/cx';

export type HeadingLevel = 'h1' | 'h2' | 'h3';

export interface HeadingProps {
  level?: HeadingLevel;
  /** Opt into the fluid display/hero scale (docs/46), independent of the semantic
   *  level — e.g. an `h1` rendered at display size. Omit for the level's size. */
  size?: 'display';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const LEVEL_CLASS: Record<HeadingLevel, string> = {
  h1: 'st-h--1',
  h2: 'st-h--2',
  h3: 'st-h--3',
};

export function Heading({ level = 'h2', size, className, style, id, children }: HeadingProps) {
  const Tag = level;
  return (
    <Tag
      className={cx('st-h', size === 'display' ? 'st-h--display' : LEVEL_CLASS[level], className)}
      style={style}
      id={id}
    >
      {children}
    </Tag>
  );
}
Heading.displayName = 'Heading';
