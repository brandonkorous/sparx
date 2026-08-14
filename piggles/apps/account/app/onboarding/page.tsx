import type { Metadata } from 'next';
import { requireSession } from '@sparx/auth';
import { prisma } from '@sparx/db';
import { Onboarding } from '@/components/onboarding';

export const metadata: Metadata = { title: 'Set up your business' };
export const dynamic = 'force-dynamic';

// The page is a session read and a name lookup, and nothing else. The frame,
// the form and the live rail preview beside it all share one piece of state, so
// they are one client component (components/onboarding.tsx) rather than three
// props threaded through here.

export default async function OnboardingPage() {
  const session = await requireSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { name: true },
  });

  // The tenant was born with a derived placeholder ("Brandon's workspace"). It
  // is offered back as the default so the field is never empty — but it is a
  // PLACEHOLDER being shown as a real value, which is the pattern that quietly
  // ships fake data. It is safe here for exactly one reason: this screen exists
  // to replace it, and the person cannot leave without confirming or changing
  // it. Do not reuse the placeholder anywhere a customer would see it.
  const suggestedName = tenant?.name ?? '';

  return <Onboarding suggestedName={suggestedName} />;
}
