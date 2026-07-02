import { redirect } from 'next/navigation';
import { listEnabledModules, listMyMemberships, requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import { onboardingEntryHref } from '@/lib/onboarding-entry';
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
  // to the right onboarding front end before it can reach any dashboard page.
  // `onboardingEntryHref` picks the natural-language story flow (the primary) for
  // fresh/story tenants and the classic wizard for anyone mid-way through it.
  // `finishedAt` is set when onboarding finishes (or the user explicitly bows out).
  // Fail OPEN on a read error so an API hiccup can never lock anyone out or cause a
  // loop — the (onboarding) group has its own layout, so it's exempt from this guard.
  const onboarding = await api
    .get<{
      finishedAt: string | null;
      story: Record<string, unknown> | null;
      currentStep: string;
      completed: Record<string, boolean>;
    }>('/v1/tenant/onboarding')
    .catch(() => null);
  if (onboarding && !onboarding.finishedAt) {
    redirect(onboardingEntryHref(onboarding));
  }

  const ctx = { userId: user.id, tenantId: user.tenantId };

  const [
    tenant,
    favorites,
    recents,
    preferences,
    enabledModules,
    sites,
    activePropertyId,
    partner,
    memberships,
  ] = await Promise.all([
    api.get<{ name: string }>('/v1/tenant').catch(() => ({ name: 'Workspace' })),
    listFavorites(ctx).catch(() => []),
    listRecents(ctx).catch(() => []),
    getUserPreferences(user.id).catch(() => DEFAULT_PREFERENCES),
    listEnabledModules(user.tenantId).catch(() => []),
    // Multi-site switcher data (docs/49 §6). Defensive: a failed read just
    // hides the Site segment (single-site behavior).
    listProperties().catch(() => [] as Property[]),
    getActivePropertyId().catch(() => null),
    // Partner Portal gate (docs/114 §B.7). The `partners` row (or null) decides
    // whether the rail's Partner tile reads as "your portal" vs a join CTA and
    // whether the member-only sections show. A failed read fails closed to
    // "not a partner" — the tile still shows the join screen.
    api.get<{ id: string } | null>('/v1/partner/profile').catch(() => null),
    // Org memberships (docs/114 §A.4) — feeds the breadcrumb workspace switcher.
    // A single-membership user just sees their one workspace (no switcher).
    listMyMemberships(user.id).catch(() => []),
  ]);

  const navModules: string[] = [...enabledModules];

  return (
    <DashboardShell
      user={user}
      tenantName={tenant?.name ?? 'Workspace'}
      enabledModules={navModules}
      sites={sites}
      activePropertyId={activePropertyId}
      organizations={memberships}
      activeOrgId={user.tenantId}
      favorites={favorites}
      recents={recents}
      preferences={preferences}
      isPartner={partner !== null}
      detail={detail}
    >
      {!user.emailVerified && <EmailVerificationBanner email={user.email} />}
      {children}
    </DashboardShell>
  );
}
