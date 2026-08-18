// The favorites page is a client component, so it cannot export `metadata`
// itself. This layout carries the noindex for it: favorites are per-shopper
// (resolved from localStorage), so the page has no stable public content to
// index. See cart/layout.tsx for why the robots.ts disallow alone is not
// sufficient.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Favorites',
  robots: { index: false, follow: false },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
