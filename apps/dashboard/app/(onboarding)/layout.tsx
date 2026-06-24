import { ModuleProvider } from '@sparx/ui';

// The onboarding flow is its own route group so it sits OUTSIDE the dashboard
// shell (no sidebar, no topbar) — a focused, full-screen guided setup. It wraps
// everything in ModuleProvider module="builder" so the SurfaceFrame rail and the
// step accents pick up Builder Indigo (the site-building module color), matching
// where the tenant lands afterwards.
//
// No chrome here: the SurfaceFrame's page variant owns the whole viewport and its
// rail carries the brand wordmark + Save & exit, so a layout header would just
// fight the 100vh two-pane grid.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <ModuleProvider module="builder">{children}</ModuleProvider>;
}
