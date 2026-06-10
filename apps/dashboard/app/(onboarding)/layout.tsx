import Link from 'next/link';
import { ModuleProvider } from '@sparx/ui';
import { SignOutLink } from './onboarding/_components/sign-out-link';

// The onboarding flow is its own route group so it sits OUTSIDE the dashboard
// shell (no sidebar, no topbar) — a focused, full-screen guided setup. It wraps
// everything in ModuleProvider module="builder" so the Stepper + accents pick
// up Builder Indigo (the site-building module color), matching where the tenant
// lands afterwards.
//
// The shell is deliberately full-bleed: the template gallery wants a wide grid
// and the Launch step wants a near-full-viewport preview. Each step picks its
// own width (a centered column for the simple form steps; edge-to-edge for the
// gallery + preview), so the layout doesn't box everything into one narrow card.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="builder">
      <div className="flex min-h-screen flex-col bg-[var(--color-bg-subtle)]">
        <header className="flex items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-3.5">
          <Link href="/" className="font-medium tracking-tight">
            <span>Spar</span>
            <span className="text-[var(--color-primary)]">x</span>
          </Link>
          <SignOutLink />
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </ModuleProvider>
  );
}
