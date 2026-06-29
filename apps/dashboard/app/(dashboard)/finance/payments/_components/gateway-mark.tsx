// Provider brand marks for the Payments picker. Each gateway gets a rounded chip in
// the PROVIDER's brand colour with a simple glyph — colour carries the recognition
// (Stripe indigo, Square black, PayPal blue) the way Stripe/Shopify settings do,
// without reproducing trademarked logo artwork. Brand colours are third-party identity
// (like a merchant theme colour), so they are intentionally literal hexes set via inline
// style — not sparx design tokens, and not the banned utility "fill + foreground" recipe.

import * as React from 'react';
import {
  Banknote,
  CreditCard,
  Globe,
  Landmark,
  Sparkles,
  Square,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

interface Mark {
  bg: string;
  fg: string;
  Glyph: LucideIcon;
  /** Near-bg chips (Square's black) get a hairline so they read on any surface. */
  ring?: boolean;
}

const FALLBACK: Mark = { bg: '#64748B', fg: '#ffffff', Glyph: Globe };

const MARKS: Record<string, Mark> = {
  sparx_pay: { bg: '#6366F1', fg: '#ffffff', Glyph: Sparkles },
  stripe_direct: { bg: '#635BFF', fg: '#ffffff', Glyph: CreditCard },
  square: { bg: '#1A1A1A', fg: '#ffffff', Glyph: Square, ring: true },
  authorize_net: { bg: '#0B4DA2', fg: '#ffffff', Glyph: Landmark },
  first_pay: { bg: '#0093D0', fg: '#ffffff', Glyph: CreditCard },
  paypal: { bg: '#0070BA', fg: '#ffffff', Glyph: Wallet },
  custom: FALLBACK,
  manual: { bg: '#57606A', fg: '#ffffff', Glyph: Banknote },
};

const CHIP: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
};
const GLYPH: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function GatewayMark({
  gatewayId,
  size = 'md',
  className,
}: {
  gatewayId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}): React.JSX.Element {
  const mark = MARKS[gatewayId] ?? FALLBACK;
  const { Glyph } = mark;
  return (
    <span
      aria-hidden
      className={[
        'inline-flex shrink-0 items-center justify-center',
        CHIP[size],
        mark.ring ? 'ring-1 ring-[var(--color-border-default)]' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: mark.bg, color: mark.fg }}
    >
      <Glyph className={GLYPH[size]} />
    </span>
  );
}
