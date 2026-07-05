import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { THEME_INIT_SCRIPT } from '@sparx/ui';
import { Providers } from './providers';
import './globals.css';

// Inter powers the sparx wordmark (weight 700), exposed as --font-wordmark for
// @sparx/ui's <Wordmark>.
const interWordmark = Inter({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-wordmark',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WizeWorks Operator Console',
  description: 'Internal cross-tenant operations console for the sparx platform.',
  // Never index the operator console — it lives behind Cloudflare Access but a
  // robots directive is cheap defence-in-depth.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={interWordmark.variable}>
      <body>
        {/* Apply the persisted theme before paint (no FOUC). */}
        <Script id="sparx-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
