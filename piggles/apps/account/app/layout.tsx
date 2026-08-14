import type { Metadata } from 'next';
import { Inter, Nunito } from 'next/font/google';
import { PRODUCT } from '@piggles/config';
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
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});

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
  return (
    <html lang="en" data-theme="light" className={`${inter.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
