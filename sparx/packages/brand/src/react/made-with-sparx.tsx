import * as React from 'react';
import { PlatformCredit } from '@wizeworks/ui';
import { BRAND } from '../index';

// sparx's attribution badge — now a thin wrapper that supplies sparx's values to
// the brand-blind `PlatformCredit`.
//
// It used to BE the badge, with the name, the accent hex and the destination
// written into it, and `wizeworks/apps/site` mounted it on every tenant public
// site. That app serves both brands, so a Piggles business's footer said "Made
// with sparx" and linked their visitors to a company they had never heard of.
//
// The component moved to `@wizeworks/ui`; this keeps sparx's own call sites
// working and is the one place sparx's values for it live.

/** The marketing home, UTM-tagged so referral clicks from tenant sites are
 *  measurable — referral traffic and brand exposure are the real value of this
 *  badge, not link equity. */
const SPARX_HREF =
  'https://sparx.works/?utm_source=powered_by&utm_medium=site_badge&utm_campaign=made_with_sparx';

export interface MadeWithSparxProps {
  /** Attribution destination. Defaults to the sparx marketing home (UTM-tagged). */
  href?: string;
  /** Text size in px. Default 12 (extra small). */
  size?: number;
  /** Which bottom corner to anchor to. Default 'right'; the storefront flips
   *  this to 'left' when the chat launcher (also fixed bottom-right) is on. */
  placement?: 'right' | 'left';
}

export function MadeWithSparx({ href = SPARX_HREF, size, placement }: MadeWithSparxProps) {
  return (
    <PlatformCredit
      name="sparx"
      href={href}
      accentColor={BRAND.primary}
      // "spar" + an Ember "x" — the wordmark's split, preserved exactly.
      accentChars={1}
      size={size}
      placement={placement}
    />
  );
}
