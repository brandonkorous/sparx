// Steps — a progress stepper (docs/46 §3.6). Compound (Steps + Step). Color-bearing:
// completed/active markers read the role var `--c-bg`. `orientation` runs the track
// horizontally or vertically; each Step has a `state`. SERVER component. The marker
// shows a CSS-counter number unless an `icon` is given.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export type StepsOrientation = 'horizontal' | 'vertical';
export type StepState = 'complete' | 'active' | 'upcoming';

export interface StepsProps {
  /** Track direction. Defaults to `horizontal`. */
  orientation?: StepsOrientation;
  /** Color slot for completed/active markers. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface StepProps {
  /** Step state. Defaults to `upcoming`. */
  state?: StepState;
  /** Custom marker content (replaces the auto number). */
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function StepsRoot({
  orientation = 'horizontal',
  color = 'primary',
  className,
  style,
  id,
  children,
}: StepsProps): React.ReactElement {
  return (
    <ol
      className={cx('st-steps', `st-steps--${orientation}`, colorClass(color), className)}
      style={style}
      id={id}
    >
      {children}
    </ol>
  );
}
StepsRoot.displayName = 'Steps';

function Step({
  state = 'upcoming',
  icon,
  className,
  style,
  children,
}: StepProps): React.ReactElement {
  return (
    <li
      className={cx('st-step', `st-step--${state}`, icon != null && 'st-step--has-icon', className)}
      style={style}
    >
      <span className="st-step__marker">{icon}</span>
      <span className="st-step__label">{children}</span>
    </li>
  );
}
Step.displayName = 'Step';

const Steps = Object.assign(StepsRoot, { Step });

export { Steps, Step };
