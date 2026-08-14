import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { QueryProvider } from '@sparx/query/provider';
import { ImperativeAlertDialogProvider, ToastProvider } from '@wizeworks/silicaui-react';
import { PostHogProvider } from '../components/posthog-provider';
import { CrashListeners } from '../components/crash-listeners';
import { RootBoundary } from '../components/root-boundary';
import { WriteFailureReporter } from '../components/write-failure-reporter';
import { THEME_INIT_SCRIPT } from '../lib/theme';
// MUST load before globals.css: declares the cascade-layer order so silicaui's
// base-layer output (tokens + .btn/.card/… classes) ranks correctly against
// Tailwind's preflight. See @sparx/brand/layers.css for why it can't live in
// globals.css itself.
import '@sparx/brand/layers.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'sparx Workbench',
  description: 'Arrange your work the way you want it.',
  // Authenticated application, never a public destination. Cheap defence in
  // depth against a route that leaks quietly ending up in an index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The workbench is a fixed application shell — pinch-zooming the chrome breaks
  // the dock's hit testing. Panes scroll and zoom internally.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Adobe Fonts (Typekit) kit serving Europa, the platform's heading font
            (--font-heading in @sparx/brand/theme.css). */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/rzb8qcq.css" />
      </head>
      <body>
        {/* Applies the persisted theme to <html> before paint. `beforeInteractive`
            puts it in the server HTML ahead of hydration, so React never
            reconciles a content-bearing <script> (React 19 warns on that). */}
        <Script id="sparx-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {/* Wraps the PROVIDERS, which app/error.tsx cannot reach — it boundaries
            their children, not them. Without this, a throw in the query client,
            analytics, toasts or the confirm dialog fell all the way to
            app/global-error.tsx and its literal-hex replacement document. The
            layout's own JSX has already rendered by then, so globals.css is
            there and a real screen is possible. See components/root-boundary. */}
        <RootBoundary>
          {/* Devtools toggle bottom-right: the default bottom-left floats exactly
              over the rail footer and swallowed its clicks in dev. Pass
              `devtools={false}` to drop the floating button altogether. */}
          <QueryProvider devtools devtoolsButtonPosition="bottom-right">
            {/* Product analytics: inits PostHog in the browser, captures SPA
              route-change pageviews, and forwards Core Web Vitals. No-ops
              outside production and when no key is baked, so it's safe to wrap
              the whole tree unconditionally. */}
            <PostHogProvider>
              {/* Toasts + the imperative confirm mount once at the root so any pane
                or chrome can announce an outcome or ask "are you sure" without
                owning UI. The async confirm replaces window.confirm everywhere a
                Base UI menu is involved — a BLOCKING confirm inside a menu-item
                click freezes the menu mid-close and React reports flushSync
                errors from inside its own render. */}
              <ToastProvider>
                <ImperativeAlertDialogProvider>{children}</ImperativeAlertDialogProvider>
                {/* The floor under every failed save. A mutation rejects inside a
                  promise, so no error boundary in this app can see it — without
                  this, a write that silently did not happen leaves the screen
                  showing the change as though it did. Mounted HERE, beside the
                  toast provider it needs and above the shell, so it also covers
                  onboarding and the popout. */}
                <WriteFailureReporter />
                {/* Recovers a tab whose chunks a deploy purged, and reports every
                  other unhandled error and rejection that reaches `window` — the
                  async half that boundaries structurally cannot catch. Mounted at
                  the root rather than in the shell: a chunk error can strike
                  before the shell ever renders, which is precisely when nothing
                  else can recover it. The matching "a new version shipped" notice
                  lives in the shell instead, since it needs the dirty state. */}
                <CrashListeners />
              </ToastProvider>
            </PostHogProvider>
          </QueryProvider>
        </RootBoundary>
      </body>
    </html>
  );
}
