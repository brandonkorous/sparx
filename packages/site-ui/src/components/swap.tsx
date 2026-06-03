// Swap — toggles between two contents via a native checkbox (docs/46 §5.2). SERVER
// component: the checkbox drives the swap in pure CSS (`:checked`), so no client
// runtime is needed; standard input props (defaultChecked/checked/onChange) flow
// through. `animation` adds a rotate or flip transition.

import * as React from 'react';
import { cx } from '../utils/cx';

export type SwapAnimation = 'none' | 'rotate' | 'flip';

export interface SwapProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  /** Transition between the two states. Defaults to `none`. */
  animation?: SwapAnimation;
  /** Shown when checked (the "on" state). */
  on: React.ReactNode;
  /** Shown when unchecked (the "off" state). */
  off: React.ReactNode;
  className?: string;
}

export function Swap({
  animation = 'none',
  on,
  off,
  className,
  ...rest
}: SwapProps): React.ReactElement {
  return (
    <label className={cx('sf-swap', `sf-swap--${animation}`, className)}>
      <input {...rest} type="checkbox" className="sf-swap__input" />
      <span className="sf-swap__on">{on}</span>
      <span className="sf-swap__off">{off}</span>
    </label>
  );
}
Swap.displayName = 'Swap';
