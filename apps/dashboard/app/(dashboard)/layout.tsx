import { listEnabledModules, requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import { listProperties, getActivePropertyId, type Property } from '@/lib/sites';
import { DashboardShell } from './_components/dashboard-shell';
import { getUserPreferences } from './_shell/preferences';
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

  const ctx = { userId: user.id, tenantId: user.tenantId };

  const [tenant, favorites, recents, preferences, enabledModules, sites, activePropertyId] =
    await Promise.all([
      api.get<{ name: string }>('/v1/tenant'),
      listFavorites(ctx),
      listRecents(ctx),
      getUserPreferences(user.id),
      listEnabledModules(user.tenantId),
      // Multi-site switcher data (docs/49 §6). Defensive: a failed read just
      // hides the Site segment (single-site behavior).
      listProperties().catch(() => [] as Property[]),
      getActivePropertyId(),
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
      {children}
    </DashboardShell>
  );
}
