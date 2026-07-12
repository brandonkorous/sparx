import * as React from 'react';
import { isModuleEnabled, requireSession, type ModuleSlug } from '@sparx/auth';

import { ModuleUpsell } from './module-upsell';

// Module gate — the dashboard-side counterpart to api-rest's requireModule().
// Belongs in a module route-group layout so every page under /<module>/* gates
// from one place: a tenant without the module sees the activation upsell, never
// the real UI. The API already 404s every data call a leaked page would make,
// so this is defence-in-depth plus the right UX (an in-place upsell, not a
// broken half-loaded page).
//
// A module flip via /settings/modules calls revalidatePath('/<module>', 'layout'),
// so the next request re-runs the check.

// Function form — returns null when the module is active for the current
// tenant, otherwise the upsell node. Use this when a layout must short-circuit
// its own data fetching before deciding what to render (e.g. the Site Builder
// editor, which would otherwise fetch editor state for a tenant that can't see
// it). For the common "just gate these children" case, prefer <ModuleGate>.
//
// `module` accepts an array for routes that legitimately belong to more than
// one module (e.g. CRM's Orders section, which a commerce-only tenant without
// CRM must still be able to reach) — passes if ANY listed module is enabled.
// The upsell shown on failure names the first module in the list.
export async function requireModuleOrUpsell(
  module: ModuleSlug | ModuleSlug[]
): Promise<React.ReactNode | null> {
  const session = await requireSession();
  const modules = Array.isArray(module) ? module : [module];
  for (const m of modules) {
    if (await isModuleEnabled(session.user.tenantId, m)) return null;
  }
  const canActivate = session.user.role === 'owner' || session.user.role === 'admin';
  // `modules` is built from `[module]` or the caller's array — call sites never
  // pass an empty array, so index 0 always exists despite noUncheckedIndexedAccess.
  return <ModuleUpsell module={modules[0]!} canActivate={canActivate} />;
}

// Component form — renders `children` when the module is active, otherwise the
// upsell. Returns children bare (no wrapper element) so it's safe to drop into
// height-sensitive layouts like the Builder editor.
export async function ModuleGate({
  module,
  children,
}: {
  module: ModuleSlug | ModuleSlug[];
  children: React.ReactNode;
}) {
  return (await requireModuleOrUpsell(module)) ?? <>{children}</>;
}
