import type { Metadata } from 'next';
import { Fredoka, Inter } from 'next/font/google';
import { PRODUCT } from '@piggles/config';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

// getpiggles.com — sign up, sign in, set the business up, and pay us.
//
// ── WHY THIS IS A SEPARATE APP ──────────────────────────────────────────────
//
// The money a customer pays WizeWorks and the money a customer's own customers
// pay THEM are different concerns that read identically in code — both are
// "subscriptions", "invoices", "payment methods", "past due". Holding them in
// one console is what made this confusing in sparx, and the confusion is not
// cosmetic: it is how a support person ends up looking at the wrong invoice
// list, and how a developer ends up reusing a billing component against the
// wrong tenant. Two apps on two domains makes the mistake impossible rather
// than merely discouraged (piggles/CLAUDE.md, "The three surfaces").
//
// This app is also the AUTH AUTHORITY. mypiggles.com has no sign-in UI at all —
// it bounces here, and this app hands a session back across the domain boundary
// (@piggles/auth-handoff).
//
// No SiteHeader/SiteFooter from the marketing site. This is a utility surface:
// somebody here is trying to finish one task, and a nav bar offering them
// "Pricing" and "Trust" is an invitation to leave in the middle of it.

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
  // An account app has no business being indexed: every page is either behind a
  // session or a form that only makes sense arriving from somewhere specific.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // NO `data-theme` on <html>, and that is load-bearing rather than an omission.
  // React owns every attribute it renders and re-asserts it whenever the element
  // is created, so a hardcoded value here is a second writer racing the script
  // below — able to put somebody who chose dark back on white after the script
  // had already decided otherwise. THEME_SCRIPT is the one thing allowed to put
  // an appearance on this document at load; @piggles/ui's `useAppearance` is the
  // one thing allowed to change it afterwards. `suppressHydrationWarning` is its
  // counterpart: the attribute the client sees was never in the server's markup.
  // See lib/theme.ts.
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fredoka.variable}`}>
      <head>
        {/* In <head> and blocking, so it lands before anything is painted. An
            effect, a provider or a server-read cookie are all later than the
            first frame, which is the one frame this exists to fix — and on a
            sign-in page a white flash is the first thing a customer sees of us. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
