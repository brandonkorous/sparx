import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ConfirmProvider, THEME_INIT_SCRIPT, Toaster, TooltipProvider } from '@sparx/ui';
import { PostHogProvider } from '../components/posthog-provider';
import './globals.css';

// Inter powers the Sparx wordmark (bold, to match the monogram mark). Exposed
// as --font-wordmark, which @sparx/ui's <Wordmark> consumes.
const interWordmark = Inter({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-wordmark',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sparx Dashboard',
  description: 'Merchant admin for the Sparx commerce platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={interWordmark.variable}>
      <body>
        {/* Applies the persisted theme to <html> before paint (no FOUC).
            `beforeInteractive` injects this into the server HTML ahead of
            hydration, so React never reconciles a content-bearing <script> in
            the tree (React 19 warns on that). See @sparx/ui/use-theme. */}
        <Script id="sparx-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <PostHogProvider>
          <TooltipProvider delayDuration={150}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </TooltipProvider>
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );
}
