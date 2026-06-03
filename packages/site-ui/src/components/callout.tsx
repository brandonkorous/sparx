// Callout — an editorial emphasis block for inline content (tips, notes, quotes)
// (docs/46 §3.6). Color × variant (chip treatment) off the shared recipe, with a
// prominent left accent bar in the active color. Optional `icon` + `title` slots;
// children are the body. SERVER component, presentational.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  chipTreatmentVariants,
  colorClass,
  type ChipTreatmentKey,
  type ColorKey,
} from './_recipes/variants';

export interface CalloutProps {
  /** Semantic color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Chip treatment. Defaults to `soft`. */
  variant?: ChipTreatmentKey;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Optional emphasized title rendered above the body. */
  title?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Callout({
  color = 'primary',
  variant = 'soft',
  icon,
  title,
  className,
  style,
  id,
  children,
}: CalloutProps): React.ReactElement {
  return (
    <div
      className={cx('sf-callout', colorClass(color), chipTreatmentVariants[variant], className)}
      style={style}
      id={id}
    >
      {icon ? (
        <span className="sf-callout__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="sf-callout__content">
        {title ? <div className="sf-callout__title">{title}</div> : null}
        <div className="sf-callout__body">{children}</div>
      </div>
    </div>
  );
}
Callout.displayName = 'Callout';
