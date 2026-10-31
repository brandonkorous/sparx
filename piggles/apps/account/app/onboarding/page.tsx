import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@wizeworks/auth-client-server';
import { readBusiness } from '@/lib/account-load';
import { acquisitionFrom } from '@/lib/attribution';
import { readSetupOptions } from '@/lib/furnish';
import { recordAcquisitionOnce } from '@/lib/late-acquisition';
import { isOnboarded } from '@/lib/needs-setup';
import { Onboarding } from '@/components/onboarding';

export const metadata: Metadata = { title: 'Set up your business' };
export const dynamic = 'force-dynamic';

// Setup happens once. `settings.piggles.onboardedAt` PRESENT proves it finished, so
// a return visit goes to /account (not /handoff, which spends a single-use token).
// ABSENT proves nothing: a seeded business never passes through here, so never force one in.

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession();

  const business = await readBusiness();
  if (business && isOnboarded(business)) redirect('/account');

  // A Google signup arrives with its source on the address (lib/signup-source).
  // Best-effort: a missing source must never stop somebody setting up.
  const params = await searchParams;
  await recordAcquisitionOnce(acquisitionFrom(one(params.from), one(params.a))).catch(
    () => undefined
  );

  // The provisioning placeholder ("Brandon's workspace"), offered back only because
  // this screen exists to replace it. Never show it anywhere a customer would.
  const suggestedName = business?.name ?? '';
  // Server-side: the templates depend on the business's brand, and the trades on
  // the sample packs api-rest holds. An empty template list falls back to the default.
  const { blueprints, trades } = await readSetupOptions();

  return <Onboarding suggestedName={suggestedName} blueprints={blueprints} trades={trades} />;
}
