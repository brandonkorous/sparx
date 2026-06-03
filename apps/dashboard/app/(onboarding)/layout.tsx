import Link from 'next/link';
import { Container, ModuleProvider } from '@sparx/ui';
import { SignOutLink } from './onboarding/_components/sign-out-link';

// The onboarding flow is its own route group so it sits OUTSIDE the dashboard
// shell (no sidebar, no topbar) — a focused, full-screen guided setup. It wraps
// everything in ModuleProvider module="builder" so the Stepper + accents pick
// up Builder Indigo (the site-building module color), matching where the
// tenant lands afterwards.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="builder">
      <div className="flex min-h-screen flex-col bg-[var(--color-bg-subtle)]">
        <header className="flex items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-4">
          <Link href="/" className="font-medium tracking-tight">
            <span>Spar</span>
            <span className="text-[var(--color-primary)]">x</span>
          </Link>
          <SignOutLink />
        </header>
        <main className="flex flex-1 justify-center px-4 py-10">
          <Container size="md">{children}</Container>
        </main>
      </div>
    </ModuleProvider>
  );
}
