import { redirect } from 'next/navigation';
import { listEnabledModules, requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import { listProperties, getActivePropertyId, type Property } from '@/lib/sites';
import { DashboardShell } from './_components/dashboard-shell';
import { EmailVerificationBanner } from './_components/email-verification-banner';
import { getUserPreferences } from './_shell/preferences';
import { DEFAULT_PREFERENCES } from './_shell/preferences-types';
import { listFavorites, listRecents } from './_shell/service';

// Server-side session gate. requireSession() redirects to /sign-in when there
// is no session, so by the time we hit the shell we have a known user +
// tenantId. The shell needs the user, the tenant's display name, the user's
// pinned favorites, recents, and preferences — all fetched in parallel via
// api-rest (`GET /v1/tenant`, `/v1/me/favorites`, `/v1/me/recents`,
// `/v1/me/preferences`).
//
// `detail` is the `@detail` parallel slot: a server-rendered detail body
// (or null) driven by the `?drawer=` / `?modal=` search param. We pass it
// straight through to the shell, which adds chrome and mounts it.
export default async function DashboardLayout({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  const { user } = await requireSession();

  // Mandatory onboarding: a tenant that hasn't finished setup is always routed
  // to the wizard before it can reach any dashboard page. `finishedAt` is set
  // when the wizard finishes (or the user explicitly bows out). Fail OPEN on a
  // read error so an API hiccup can never lock anyone out or cause a loop — the
  // (onboarding) group has its own layout, so it's exempt from this guard.
  const onboarding = await api
    .get<{ finishedAt: string | null }>('/v1/tenant/onboarding')
    .catch(() => null);
  if (onboarding && !onboarding.finishedAt) {
    redirect('/onboarding');
  }

  const ctx = { userId: user.id, tenantId: user.tenantId };

  const [tenant, favorites, recents, preferences, enabledModules, sites, activePropertyId] =
    await Promise.all([
      api.get<{ name: string }>('/v1/tenant').catch(() => ({ name: 'Workspace' })),
      listFavorites(ctx).catch(() => []),
      listRecents(ctx).catch(() => []),
      getUserPreferences(user.id).catch(() => DEFAULT_PREFERENCES),
      listEnabledModules(user.tenantId).catch(() => []),
      // Multi-site switcher data (docs/49 §6). Defensive: a failed read just
      // hides the Site segment (single-site behavior).
      listProperties().catch(() => [] as Property[]),
      getActivePropertyId().catch(() => null),
    ]);

  const navModules: string[] = [...enabledModules];

  return (
    <DashboardShell
      user={user}
      tenantName={tenant?.name ?? 'Workspace'}
      enabledModules={navModules}
      sites={sites}
      activePropertyId={activePropertyId}
      favorites={favorites}
      recents={recents}
      preferences={preferences}
      detail={detail}
    >
      {!user.emailVerified && <EmailVerificationBanner email={user.email} />}
      {children}
    </DashboardShell>
  );
}
