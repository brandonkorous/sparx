// Card — the reference COMPOUND component for Surface (docs/47 §3). Proves the
// two things Button can't: PARTS and a per-component axis beyond color/size.
//
// Axes: `color` (shared role-var recipe — drives the border color) × `border`
// (the "style" axis: none / solid / dashed — named `border` because `style` is
// React-reserved) × `modifier` (none / side / image-full) × `size` (xs…xl). The
// parts — Body / Title / Actions (+ a plain <figure> child) — are exposed both as
// the compound `Card.Body` API and as named exports.
//
// SERVER component: markup + classes only, so the site and the editor canvas
// render it identically. Interactivity (e.g. a whole-card link) is a `behavior`
// axis added later, never an onClick on the base.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

/** The card's "style" axis. Exposed as `border` (not `style`, which is reserved
 *  for the inline-style object). */
export type CardBorder = 'none' | 'solid' | 'dashed';
/** Layout modifier axis. */
export type CardModifier = 'none' | 'side' | 'image-full';

export interface CardProps {
  /** Semantic color slot; drives the border color for `border`/`dash`. Any string
   *  is accepted so a runtime custom theme color works once its `.sf-c-*` rule
   *  exists. Omit for a card with no color (border falls back to `--sf-border`). */
  color?: ColorKey | (string & {});
  /** Border treatment — the "style" axis. Defaults to `none`. */
  border?: CardBorder;
  /** Layout modifier. Defaults to `none`. */
  modifier?: CardModifier;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface CardSlotProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface CardTitleProps extends CardSlotProps {
  /** Heading level for the title. Defaults to `h3`. */
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

const BORDER_CLASS: Record<CardBorder, string> = {
  none: '',
  solid: 'sf-card--border',
  dashed: 'sf-card--dash',
};
const MODIFIER_CLASS: Record<CardModifier, string> = {
  none: '',
  side: 'sf-card--side',
  'image-full': 'sf-card--image-full',
};
const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-card--sz-xs',
  sm: 'sf-card--sz-sm',
  md: 'sf-card--sz-md',
  lg: 'sf-card--sz-lg',
  xl: 'sf-card--sz-xl',
};

function CardRoot(props: CardProps): React.ReactElement {
  const {
    color,
    border = 'none',
    modifier = 'none',
    size = 'md',
    className,
    style,
    id,
    children,
  } = props;
  return (
    <div
      className={cx(
        'sf-card',
        colorClass(color),
        BORDER_CLASS[border],
        MODIFIER_CLASS[modifier],
        SIZE_CLASS[size],
        className
      )}
      style={style}
      id={id}
    >
      {children}
    </div>
  );
}
CardRoot.displayName = 'Card';

function CardBody({ className, style, children }: CardSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-card-body', className)} style={style}>
      {children}
    </div>
  );
}
CardBody.displayName = 'CardBody';

function CardTitle({ as = 'h3', className, style, children }: CardTitleProps): React.ReactElement {
  const Tag = as as React.ElementType;
  return (
    <Tag className={cx('sf-card-title', className)} style={style}>
      {children}
    </Tag>
  );
}
CardTitle.displayName = 'CardTitle';

function CardActions({ className, style, children }: CardSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-card-actions', className)} style={style}>
      {children}
    </div>
  );
}
CardActions.displayName = 'CardActions';

/** Card with its parts attached: `<Card.Body>` / `<Card.Title>` / `<Card.Actions>`.
 *  The same parts are also available as named exports. */
const Card = Object.assign(CardRoot, {
  Body: CardBody,
  Title: CardTitle,
  Actions: CardActions,
});

export { Card, CardBody, CardTitle, CardActions };
