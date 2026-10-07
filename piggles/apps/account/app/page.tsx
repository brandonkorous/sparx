import { redirect } from 'next/navigation';
import { getSession } from '@wizeworks/auth';
import { prisma } from '@wizeworks/db';
import { acquisitionFrom } from '@/lib/attribution';
import { recordAcquisitionOnce } from '@/lib/late-acquisition';
import { needsSetup } from '@/lib/needs-setup';

export const dynamic = 'force-dynamic';

// getpiggles.com/ is a junction, not a page: signed in goes to the account home
// (not the console: this domain is for dealing with us), unless the business was
// never set up, which a brand-new Google account from the sign-in page has not been.

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function AccountRoot({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  const tenantId = session.user.tenantId;
  // A Google account made from the sign-in page arrives with its source here
  // (lib/signup-source). Written once, on a fresh business only; never blocks.
  const params = await searchParams;
  await recordAcquisitionOnce(tenantId, acquisitionFrom(one(params.from), one(params.a))).catch(
    () => undefined
  );

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  redirect(tenant && needsSetup(tenant.settings) ? '/onboarding' : '/account');
}
