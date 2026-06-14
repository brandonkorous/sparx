'use client';

// Tooltip — Radix behavior, Surface appearance (docs/47 §11 B3). Radix
// (@radix-ui/react-tooltip) owns hover/focus + positioning; styling is `st-*`.
// `color` themes the bubble off the role var (`--c-bg` fill / `--c-fg` text);
// `side` places it. The trigger is `children` (rendered `asChild`). A Provider is
// included per-instance for self-containment.

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  /** The tooltip body. */
  content: React.ReactNode;
  /** Placement. Defaults to `top`. */
  side?: TooltipSide;
  /** Bubble color slot. Defaults to `neutral`. */
  color?: ColorKey | (string & {});
  /** Open delay in ms. Defaults to 200. */
  delayDuration?: number;
  /** Start open (mainly for tests / always-on hints). */
  defaultOpen?: boolean;
  className?: string;
  /** The trigger element. */
  children: React.ReactElement;
}

export function Tooltip({
  content,
  side = 'top',
  color = 'neutral',
  delayDuration = 200,
  defaultOpen,
  className,
  children,
}: TooltipProps): React.ReactElement {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root defaultOpen={defaultOpen}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={cx('st-tooltip', colorClass(color), className)}
            side={side}
            sideOffset={6}
          >
            {content}
            <TooltipPrimitive.Arrow className="st-tooltip__arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
Tooltip.displayName = 'Tooltip';
