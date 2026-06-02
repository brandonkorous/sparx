// Text — body / eyebrow / meta paragraph (docs/46 §5.2).
// SERVER component. Harvested from the storefront renderer's `textStyle`:
// `eyebrow` is the uppercase brand kicker, `meta` is muted fine print, `body`
// inherits color at 1.6 line-height.

import * as React from 'react';
import { cx } from '../utils/cx';

export type TextVariant = 'body' | 'eyebrow' | 'meta';

export interface TextProps {
  variant?: TextVariant;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const VARIANT_CLASS: Record<TextVariant, string> = {
  body: 'sf-text--body',
  eyebrow: 'sf-text--eyebrow',
  meta: 'sf-text--meta',
};

export function Text({ variant = 'body', className, style, id, children }: TextProps) {
  return (
    <p className={cx('sf-text', VARIANT_CLASS[variant], className)} style={style} id={id}>
      {children}
    </p>
  );
}
Text.displayName = 'Text';
