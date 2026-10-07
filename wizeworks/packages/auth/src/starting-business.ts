import { authPrisma } from './prisma';

// Which business a new session opens in.
//
// Every account has a home business: signing up makes one, even for someone who
// signed up only to accept an invitation. A session with no active business acts
// in that home. For an invited person, that is an empty workspace they never
// asked for.
//
// MEASURED 2026-10-06 on Gillett Diesel: Kendra Ruiz, invited as an editor,
// signed up, accepted, and landed in "So, what's your story?", asked to build a
// salon for $186 a month. Mike Van Der Berg did the same the day before. Any
// later sign-in would have done it again: a new session starts at home, and the
// setup screen covers the whole window, switcher and all (sparx persona issue
// 124).
//
// The rule: a person whose home was never set up, and who belongs to another
// business, opens in the one they joined most recently. A person who runs their
// own business opens at home, as always, and moves with the switcher.

export interface JoinedBusiness {
  organizationId: string;
  joinedAt: Date;
}

/** The business to open in, or null for "home". */
export function chooseStartingBusiness(input: {
  homeIsSetUp: boolean;
  joined: readonly JoinedBusiness[];
}): string | null {
  if (input.homeIsSetUp) return null;
  let latest: JoinedBusiness | null = null;
  for (const business of input.joined) {
    if (!latest || business.joinedAt > latest.joinedAt) latest = business;
  }
  return latest?.organizationId ?? null;
}

function finishedSetup(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const onboarding = (settings as { onboarding?: unknown }).onboarding;
  if (!onboarding || typeof onboarding !== 'object') return false;
  return Boolean((onboarding as { finishedAt?: unknown }).finishedAt);
}

/** Reads what the rule needs. Only active memberships, only in businesses of
 *  the same brand as the home one: an account belongs to one product. */
export async function startingBusinessFor(userId: string): Promise<string | null> {
  const user = await authPrisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });
  if (!user?.tenantId) return null;

  const home = await authPrisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { settings: true, platformBrand: true },
  });
  if (!home) return null;

  const rows = await authPrisma.member.findMany({
    where: {
      userId,
      status: 'active',
      organizationId: { not: user.tenantId },
      organization: { platformBrand: home.platformBrand },
    },
    select: { organizationId: true, createdAt: true },
  });

  return chooseStartingBusiness({
    homeIsSetUp: finishedSetup(home.settings),
    joined: rows.map((row) => ({ organizationId: row.organizationId, joinedAt: row.createdAt })),
  });
}
