import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import {
  ChunkReloadGuard,
  ConfirmProvider,
  THEME_INIT_SCRIPT,
  Toaster,
  TooltipProvider,
} from '@sparx/ui';
import { QueryProvider } from '@sparx/query/provider';
import { PostHogProvider } from '../components/posthog-provider';
import { TopProgressBar } from '../components/top-progress-bar';
import { UpdateNotifier } from '../components/update-notifier';
// MUST load before globals.css: declares the cascade-layer order so silicaui's
// base-layer output (tokens + `.btn`/`.card`/… classes) ranks correctly against
// the coexisting @sparx/ui styles + Tailwind preflight. See @sparx/brand/layers.css.
import '@sparx/brand/layers.css';
import './globals.css';

// Inter powers the sparx wordmark (bold, to match the monogram mark). Exposed
// as --font-wordmark, which @sparx/ui's <Wordmark> consumes.
const interWordmark = Inter({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-wordmark',
  display: 'swap',
});

// The dashboard is an authenticated application, never a public destination.
// Every route sits behind auth, but `noindex` is cheap defence-in-depth against
// a route that leaks (an unauthenticated error page, a public preview, a
// misconfigured redirect) quietly ending up in an index. Mirrors apps/admin.
export const metadata: Metadata = {
  title: 'sparx Dashboard',
  description: 'Admin for the sparx content and commerce platform.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={interWordmark.variable}>
      <head>
        {/* Adobe Fonts (Typekit) kit serving Europa, the platform's heading font
            (--font-heading in @sparx/brand/theme.css). */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/rzb8qcq.css" />
      </head>
      <body>
        {/* Applies the persisted theme to <html> before paint (no FOUC).
            `beforeInteractive` injects this into the server HTML ahead of
            hydration, so React never reconciles a content-bearing <script> in
            the tree (React 19 warns on that). See @sparx/ui/use-theme. */}
        <Script id="sparx-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {/* Page-top navigation/loading bar — overlays everything at the top edge. */}
        <TopProgressBar />
        <PostHogProvider>
          <QueryProvider>
            <TooltipProvider delayDuration={150}>
              <ConfirmProvider>{children}</ConfirmProvider>
            </TooltipProvider>
            <Toaster />
            {/* Runtime guards: notify when a new release is deployed, and recover
                stale tabs whose chunks were purged by that deploy. */}
            <UpdateNotifier />
            <ChunkReloadGuard />
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
