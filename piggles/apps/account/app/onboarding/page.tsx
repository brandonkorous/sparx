import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@wizeworks/auth';
import { prisma } from '@wizeworks/db';
import { acquisitionFrom } from '@/lib/attribution';
import { listBlueprints } from '@/lib/furnish';
import { recordAcquisitionOnce } from '@/lib/late-acquisition';
import { tradeOptions } from '@/lib/trades';
import { Onboarding } from '@/components/onboarding';

export const metadata: Metadata = { title: 'Set up your business' };
export const dynamic = 'force-dynamic';

// Setup happens once. `settings.piggles.onboardedAt` PRESENT proves it finished, so
// a return visit goes to /account (not /handoff, which spends a single-use token).
// ABSENT proves nothing: a seeded business never passes through here, so never force one in.

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

function isOnboarded(settings: unknown): boolean {
  const s = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const piggles = (s as { piggles?: { onboardedAt?: unknown } }).piggles;
  return typeof piggles?.onboardedAt === 'string' && piggles.onboardedAt.length > 0;
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession();
  const tenantId = session.user.tenantId;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, settings: true },
  });
  if (isOnboarded(tenant?.settings)) redirect('/account');

  // A Google signup arrives with its source on the address (lib/signup-source).
  // Best-effort: a missing source must never stop somebody setting up.
  const params = await searchParams;
  await recordAcquisitionOnce(tenantId, acquisitionFrom(one(params.from), one(params.a))).catch(
    () => undefined
  );

  // The provisioning placeholder ("Brandon's workspace"), offered back only because
  // this screen exists to replace it. Never show it anywhere a customer would.
  const suggestedName = tenant?.name ?? '';
  // Server-side: the list depends on the tenant's brand. Empty falls back to the default.
  const blueprints = await listBlueprints(tenantId);

  return (
    <Onboarding suggestedName={suggestedName} blueprints={blueprints} trades={tradeOptions()} />
  );
}
