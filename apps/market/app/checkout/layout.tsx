// The checkout page is a client component, so it cannot export `metadata`
// itself. This layout carries the noindex for it: checkout is per-session and
// transactional, and must never surface as a search result. See cart/layout.tsx
// for why the robots.ts disallow alone is not sufficient.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
