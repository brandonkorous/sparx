import type { Metadata } from 'next';
import { Fredoka, Inter } from 'next/font/google';
import { Suspense } from 'react';
import { PRODUCT } from '@piggles/config';
import { ChunkReloadGuard } from '@wizeworks/app-kit';
import { HeaderNoticeSlot } from '@/components/header-notice-slot';
import { WizeLens } from '@/components/wizelens';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

// getpiggles.com: sign up, sign in, set the business up, and pay us. Separate from
// the console so the money customers pay us never shares screens with the money
// their customers pay them. Also the auth authority. No marketing nav, on purpose.

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Variable, not a weight list: Fredoka's wght axis stops at 700.
const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(`https://${PRODUCT.hosts.account}`),
  title: {
    default: `${PRODUCT.name} account`,
    template: `%s · ${PRODUCT.name}`,
  },
  description: `Sign in to ${PRODUCT.name}, set your business up, and manage your subscription.`,
  // Every page is behind a session or a form; none belongs in a search index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // NO `data-theme`: THEME_SCRIPT writes it at load and `useAppearance` after, and
  // a React default would race them. `suppressHydrationWarning` is the counterpart.
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fredoka.variable}`}>
      <head>
        {/* Blocking in <head>: a white flash is the first thing a customer would see. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* A tab left open across a release reloads once instead of crashing. */}
        <ChunkReloadGuard />
        {/* Tracing (WizeLens): on only when this page's server traces it; no HUD outside development. */}
        <WizeLens />
        {/* The marketing site's bar too: an offer dropped at signup reads as withdrawn. */}
        <Suspense fallback={null}>
          <HeaderNoticeSlot />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
