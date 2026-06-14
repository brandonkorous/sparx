// Alert — a COMPOUND feedback banner (docs/46 §3.6). Color × variant (chip
// treatment) off the shared recipe, plus PARTS: Alert.Icon / Alert.Title /
// Alert.Body (the Card pattern — attached to the root AND exported by name). A
// `vertical` modifier stacks the icon above the content. SERVER component;
// `role="alert"` by default so assistive tech announces it.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  chipTreatmentVariants,
  colorClass,
  type ChipTreatmentKey,
  type ColorKey,
} from './_recipes/variants';

export interface AlertProps {
  /** Semantic color slot. Defaults to `info`. */
  color?: ColorKey | (string & {});
  /** Chip treatment. Defaults to `soft`. */
  variant?: ChipTreatmentKey;
  /** Stack the icon above the content instead of beside it. Defaults to false. */
  vertical?: boolean;
  /** ARIA role. Defaults to `alert`; use `status` for non-urgent messages. */
  role?: 'alert' | 'status';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface AlertSlotProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function AlertRoot({
  color = 'info',
  variant = 'soft',
  vertical = false,
  role = 'alert',
  className,
  style,
  id,
  children,
}: AlertProps): React.ReactElement {
  return (
    <div
      role={role}
      className={cx(
        'st-alert',
        colorClass(color),
        chipTreatmentVariants[variant],
        vertical && 'st-alert--vertical',
        className
      )}
      style={style}
      id={id}
    >
      {children}
    </div>
  );
}
AlertRoot.displayName = 'Alert';

function AlertIcon({ className, style, children }: AlertSlotProps): React.ReactElement {
  return (
    <span className={cx('st-alert__icon', className)} style={style} aria-hidden="true">
      {children}
    </span>
  );
}
AlertIcon.displayName = 'AlertIcon';

function AlertTitle({ className, style, children }: AlertSlotProps): React.ReactElement {
  return (
    <div className={cx('st-alert__title', className)} style={style}>
      {children}
    </div>
  );
}
AlertTitle.displayName = 'AlertTitle';

function AlertBody({ className, style, children }: AlertSlotProps): React.ReactElement {
  return (
    <div className={cx('st-alert__body', className)} style={style}>
      {children}
    </div>
  );
}
AlertBody.displayName = 'AlertBody';

/** Alert with its parts attached: `<Alert.Icon>` / `<Alert.Title>` / `<Alert.Body>`.
 *  The same parts are also available as named exports. */
const Alert = Object.assign(AlertRoot, {
  Icon: AlertIcon,
  Title: AlertTitle,
  Body: AlertBody,
});

export { Alert, AlertIcon, AlertTitle, AlertBody };
