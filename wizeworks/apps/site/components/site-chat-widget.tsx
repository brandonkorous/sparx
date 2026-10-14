'use client';

// The storefront's chat widget, told when something modal owns the screen.
//
// The launcher is `position: fixed` in a bottom corner at `z-index: 2147483000`,
// which beats every overlay on the page — including the mini-cart, whose own
// footer buttons live in that same corner. At 390px the bubble covered the
// right-hand 56px of the drawer's "View cart" and won the hit test, so a tap
// aimed at the cart opened a conversation instead.
//
// Nothing here reaches into the widget: `hideLauncher` is its own prop, and an
// OPEN conversation is deliberately left alone — the visitor put it there, and
// hiding it mid-sentence would be worse than the overlap.

import { ChatWidget } from '@wizeworks/chat-widget';
import type { ComponentProps } from 'react';

import { useCart } from './cart-provider';
import { useCustomer } from './customer-provider';

type Props = Omit<
  ComponentProps<typeof ChatWidget>,
  'hideLauncher' | 'propertySlug' | 'startVia' | 'signedInAs'
>;

// Who is chatting (sparx persona issue 164). A shopper signed in on this site was
// asked for their name and email like a stranger, and their chat reached the shop
// as a "Possible customer" matched on a typed address. The first message now goes
// through this site's own `/api/sparx` relay, which carries the sign-in cookie, so
// the server ties the chat to their customer record; and the widget says who they
// are chatting as instead of asking.
export function SiteChatWidget(props: Props) {
  const { drawerOpen } = useCart();
  const { customer, propertySlug } = useCustomer();
  const name = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || null
    : null;
  return (
    <ChatWidget
      {...props}
      hideLauncher={drawerOpen}
      propertySlug={propertySlug}
      startVia="/api/sparx"
      signedInAs={customer ? { name, email: customer.email } : null}
    />
  );
}
