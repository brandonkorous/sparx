import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Fredoka, Inter } from 'next/font/google';
import { PRODUCT } from '@piggles/config';
import { ConsoleProviders } from '@/components/console-providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
// MUST load before globals.css: declares the cascade-layer order so silicaui's
// base-layer output (tokens + .btn/.card/… classes) ranks correctly against
// Tailwind's preflight, and so Piggles' unlayered theme blocks outrank silica's
// own built-in `light` / `dark`. See @piggles/brand/layers.css for why it cannot
// live inside globals.css.
import '@piggles/brand/layers.css';
import './globals.css';

// mypiggles.com — where a business is actually run.
//
// ── WHAT THIS APP IS, AND IS NOT ────────────────────────────────────────────
//
// It is a SHELL. Every screen inside it is a shared workbench surface, mounted
// its own, forked from the platform on 2026-08-14 (piggles/CLAUDE.md RULE #0). What Piggles
// owns is everything around them: the chrome, the navigation, the vocabulary,
// the theme, and the first run.
//
// It is NOT where anybody signs in, and it must never become that. getpiggles.com
// is the auth authority; this app receives a session through a one-time handoff
// (app/auth/callback) and has no password field, no OAuth callback and no
// Better Auth handler of its own. A second thing that can mint a session is
// exactly what the three-domain split exists to prevent.
//
// It is also NOT where anybody pays us. Platform billing lives on getpiggles;
// the console carries the quick path at the point of friction and never knows a
// price (piggles/CLAUDE.md RULE #2).

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Variable, not a weight list: Fredoka's wght axis stops at 700.
const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka', display: 'swap' });

export const metadata: Metadata = {
  title: `${PRODUCT.name}`,
  description: 'Run your business.',
  // An authenticated application, never a public destination. Cheap defence in
  // depth against a route that leaks quietly ending up in an index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // A fixed application shell — pinch-zooming the chrome breaks the dock's hit
  // testing. Panes scroll and zoom internally.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // NO `data-theme` on <html>, and that is load-bearing rather than an omission.
  // React owns every attribute it renders and re-asserts it whenever the element
  // is created, so a hardcoded value here is a second writer racing the pre-paint
  // script — which is exactly how the console ended up showing light while the
  // stored choice, and the toggle's own label, both said dark. The script below
  // is the only thing that puts an appearance on this document at load;
  // lib/use-theme.ts is the only thing that changes it afterwards.
  // `suppressHydrationWarning` is its counterpart: the attribute the client sees
  // was never in the server's markup. See lib/theme.ts.
  return (
    <html lang="en" className={`${inter.variable} ${fredoka.variable}`} suppressHydrationWarning>
      <body>
        {/* Resolves the persisted choice — including `system`, against this
            machine — and applies it to <html> before paint. `beforeInteractive`
            puts it in the server HTML ahead of hydration, so React never
            reconciles a content-bearing <script> (React 19 warns on that). */}
        <Script id="piggles-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ConsoleProviders>{children}</ConsoleProviders>
      </body>
    </html>
  );
}
