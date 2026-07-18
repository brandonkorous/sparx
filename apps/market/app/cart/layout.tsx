// The cart page is a client component, so it cannot export `metadata` itself.
// This layout carries the noindex for it: a cart is per-session and must never
// surface as a search result. robots.ts also disallows /cart, but a disallow
// only stops crawling — an externally-linked URL can still be indexed without
// it, so this meta tag is the second fence.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cart',
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
