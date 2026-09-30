import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@wizeworks/auth';
import { prisma } from '@wizeworks/db';
import { listBlueprints } from '@/lib/furnish';
import { tradeOptions } from '@/lib/trades';
import { Onboarding } from '@/components/onboarding';

export const metadata: Metadata = { title: 'Set up your business' };
export const dynamic = 'force-dynamic';

// The page is a session read and a name lookup, and nothing else. The frame,
// the form and the live rail preview beside it all share one piece of state, so
// they are one client component (components/onboarding.tsx) rather than three
// props threaded through here.
//
// ── SETUP HAPPENS ONCE, AND UNTIL NOW NOTHING SAID SO ───────────────────────
//
// This route had NO completion check. A business that finished setting up a
// month ago could open /onboarding — a stale bookmark, the back button, a
// browser address suggestion — and be shown the setup form PREFILLED with its
// own live name and its own live web address, under a heading reading "A few
// quick things" and a button that offers to set it all up.
//
// Pressing it is not a no-op on a going concern. It rewrites `settings.rail`
// from whatever the boxes happen to be ticked to; it re-runs furnishing, whose
// sample load CLEARS its prior rows before writing fresh ones; and it will
// CLAIM A DIFFERENT WEB ADDRESS if the field is edited — on a screen whose own
// file says the address is asked here "because it can never be here again: an
// address is an identifier, identifiers do not change, and this is the last
// moment before the site is published on it".
//
// The fact needed to stop it was already being recorded and read by nobody.
// `settings.piggles.onboardedAt` is written when setup finishes; MEASURED
// 2026-09-25, six of the eight Piggles businesses carry one, P03's dated
// 2026-08-23. [[feedback_fetched_but_never_rendered]]
//
// ── WHY THE TEST IS ONLY RUN ONE WAY ────────────────────────────────────────
//
// A marker PRESENT proves the setup finished, so bouncing is safe. A marker
// ABSENT proves nothing, and the obvious symmetric rule — force anyone without
// one INTO setup — would be wrong: the marker is written by this app's own
// action, and a tenant built by a seed or a fixture never passes through it.
// Measured, one of the two unmarked businesses is Wildroot Flowers, which has a
// trade, a real address and a working site. Forcing a going concern into a
// setup form is the very thing this guard exists to prevent, so the rule runs in
// the one direction the evidence supports. [[feedback_check_the_gate_before_accepting_it]]
//
// /account rather than /handoff: an accidental arrival should not spend a
// single-use console token, and the account home carries the way onward.

export default async function OnboardingPage() {
  const session = await requireSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { name: true, settings: true },
  });

  const settings =
    tenant?.settings && typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)
      ? (tenant.settings as Record<string, unknown>)
      : {};
  const piggles = (settings.piggles as Record<string, unknown> | undefined) ?? {};
  if (typeof piggles.onboardedAt === 'string' && piggles.onboardedAt) redirect('/account');

  // The tenant was born with a derived placeholder ("Brandon's workspace"). It
  // is offered back as the default so the field is never empty — but it is a
  // PLACEHOLDER being shown as a real value, which is the pattern that quietly
  // ships fake data. It is safe here for exactly one reason: this screen exists
  // to replace it, and the person cannot leave without confirming or changing
  // it. Do not reuse the placeholder anywhere a customer would see it.
  const suggestedName = tenant?.name ?? '';

  // Fetched here, not in the client: the list depends on the tenant's brand, and
  // deciding that on the client would mean shipping the rule to the browser.
  // Empty is a legitimate answer — the form falls back to the default template.
  const blueprints = await listBlueprints(session.user.tenantId);

  return (
    <Onboarding suggestedName={suggestedName} blueprints={blueprints} trades={tradeOptions()} />
  );
}
