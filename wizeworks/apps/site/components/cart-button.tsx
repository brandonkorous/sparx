'use client';

// Cart action in the header. Shows the live line count and opens the
// mini-cart drawer. Falls back to a plain /cart link if JS is disabled.
//
// Mounted by the `site.cart-button` host core. It sat unused until then, so a
// silica-framed shop had no cart in its header at all (sparx persona issue 325).

import Link from 'next/link';

import { Badge, Button, Indicator, IndicatorItem } from '@wizeworks/silicaui-react';

import { useCart } from './cart-provider';

export function CartButton() {
  const { count, openDrawer } = useCart();

  const button = (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      render={<Link href="/cart" />}
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      onClick={(e) => {
        // Progressive enhancement: open the drawer instead of navigating.
        e.preventDefault();
        openDrawer();
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
      </svg>
    </Button>
  );

  if (count === 0) return button;
  return (
    <Indicator>
      <IndicatorItem>
        <Badge color="primary" size="xs" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </Badge>
      </IndicatorItem>
      {button}
    </Indicator>
  );
}
