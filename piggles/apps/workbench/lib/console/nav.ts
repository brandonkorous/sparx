'use client';

import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { APPS, appIcon, moduleTerm, type PigglesAppDef } from '@piggles/config';
import type { PigglesGroup } from '@piggles/brand';
import { useVisibleNav } from '@workbench/lib/surfaces/use-visible-nav';
import type { NavSection } from '@workbench/lib/surfaces/nav';
import type { WorkbenchModule } from '@workbench/components/module-scope';

// The console's navigation: fifteen APPS, built from the platform's surfaces.
//
// ── THE TRANSLATION THIS FILE PERFORMS ──────────────────────────────────────
//
// The shared workbench organises itself by MODULE, because that is what sparx
// sells. Piggles sells one plan with everything in it, so a module is not a unit
// anybody here is aware of — the unit is "the thing I'm doing". This is where
// the one becomes the other: the platform's surfaces, regrouped under the app
// registry, in the order the registry declares.
//
// ── WHY IT BUILDS ON `useVisibleNav` AND NOT ON `buildNav` ──────────────────
//
// `buildNav()` is the static catalog. `useVisibleNav()` is what this operator
// can actually reach, and it does two things a static read cannot:
//
//   • It gates per SURFACE. A person restricted to Invoices should not have ten
//     other apps in their rail — the API would refuse them anyway, and a refusal
//     is a worse way to learn that than simply not being offered.
//   • It adds the record types THIS BUSINESS INVENTED. A tenant who defines
//     "Projects" gets a Projects row inside Customers. Building from the static
//     catalog would show every built-in and none of the tenant's own — which is
//     a bug the shared shell has already had once, in this exact place.
//
// Note what the gate does NOT mean here. sparx hides a module the account has
// not bought; Piggles has no module pricing and every app is included
// (piggles/CLAUDE.md RULE #2), so on a correctly provisioned Piggles business
// the entitlement half of that gate never fires. What survives is the per-person
// half, which is real under both brands. If an app is missing from a Piggles
// rail, the fault is in provisioning, not here.
//
// ── WHY SECTIONS SOMETIMES GAIN A HEADING ───────────────────────────────────
//
// A single-module app looks exactly as it does in sparx: the module's own
// sections, in the module's own order. A MULTI-module app is the interesting
// case — "Sell" is commerce + B2B + dropship — and there the three modules'
// surfaces would otherwise run together into one thirty-row list with no seam.
// So each module's landing group (the surfaces registered with no section) is
// titled with what Piggles calls that module, and because the modules are laid
// out in the registry's declared order, each one's rows stay contiguous
// underneath it. Their own sections keep their own names.

export interface ConsoleNavApp {
  app: PigglesAppDef;
  /** Rail label. The registry's, never a module's. */
  label: string;
  group: PigglesGroup;
  icon: LucideIcon;
  /** The app's primary module — what its panes wear as a hue by default, and
   *  what its chrome sets `data-module` to. The first of the app's modules that
   *  actually has surfaces, so an app whose lead module is restricted still
   *  wears a hue rather than none. */
  module: WorkbenchModule;
  sections: NavSection[];
  /** Total surfaces, so the rail can skip an app with nothing behind it. */
  count: number;
}

/**
 * The whole rail, in registry order, with each app's surfaces attached.
 *
 * Memoised on the visible nav, which is itself memoised on the module states and
 * the tenant's record types — so this recomputes when navigation genuinely
 * changes and not on every render.
 */
export function useConsoleNav(): ConsoleNavApp[] {
  const visible = useVisibleNav();

  return useMemo(() => {
    // Keyed by plain string: @piggles/config holds module keys as bare strings
    // on purpose (the platform owns that list and Piggles must not keep a stale
    // copy of it), so the lookup has to accept one.
    const byModule = new Map<string, (typeof visible)[number]>(
      visible.map((entry) => [entry.module, entry])
    );
    const apps: ConsoleNavApp[] = [];

    for (const app of [...APPS].sort((a, b) => a.navOrder - b.navOrder)) {
      // Only the modules that actually contributed surfaces. A module with none
      // — nothing registered, or everything gated away from this person — must
      // not leave an empty heading behind.
      const live = app.modules.filter((module) => byModule.has(module));
      const primary = live[0];
      if (primary === undefined) continue;

      const multiModule = live.length > 1;
      const sections: NavSection[] = [];
      let count = 0;

      for (const module of live) {
        const entry = byModule.get(module);
        if (!entry) continue;
        count += entry.count;

        for (const section of entry.sections) {
          sections.push({
            // An untitled section is a module's landing group. Alone in its app
            // it stays untitled and sits at the top, exactly as the platform
            // intends. Sharing an app, it takes the module's name so the seam is
            // visible.
            title: section.title ?? (multiModule ? (moduleTerm(module) ?? entry.label) : null),
            surfaces: section.surfaces,
          });
        }
      }

      apps.push({
        app,
        label: app.label,
        group: app.group,
        icon: appIcon(app.id),
        module: primary as WorkbenchModule,
        sections,
        count,
      });
    }

    return apps;
  }, [visible]);
}

/** Every app in the registry, whether or not it is switched on. */
export interface ConsoleApp {
  app: PigglesAppDef;
  label: string;
  group: PigglesGroup;
  icon: LucideIcon;
  /** Whether this app has anything behind it right now — i.e. at least one of
   *  its modules is active AND reachable by this person. */
  active: boolean;
  /** Screens available, or 0 for an app that has not been added. */
  count: number;
}

/**
 * The full catalogue — the answer to "what else is there?".
 *
 * ── WHY THIS IS NOT `useConsoleNav()` ───────────────────────────────────────
 *
 * The rail is built from what is ACTIVE, because an app with no active modules
 * has no screens to list and an empty panel is worse than no row. But "not on
 * the rail" must never mean "does not exist" — Piggles has one plan with
 * everything in it, so an app the owner did not ask for at signup is not
 * something they have to buy, it is something they have not switched on yet.
 *
 * That distinction only survives if the un-added apps are somewhere a person can
 * SEE them. This is that list. Adding one is a tap, instantly, with no price
 * attached — which is what makes onboarding's question a preference rather than
 * a purchase (piggles/CLAUDE.md RULE #2: it HIDES, it never gates).
 *
 * Built from the REGISTRY rather than from the visible nav, because the whole
 * point is the apps the visible nav cannot see.
 */
export function useAllApps(): ConsoleApp[] {
  const live = useConsoleNav();

  return useMemo(() => {
    const byId = new Map(live.map((entry) => [entry.app.id, entry]));
    return [...APPS]
      .sort((a, b) => a.navOrder - b.navOrder)
      .map((app) => {
        const entry = byId.get(app.id);
        return {
          app,
          label: app.label,
          group: app.group,
          icon: appIcon(app.id),
          active: entry !== undefined,
          count: entry?.count ?? 0,
        };
      });
  }, [live]);
}

/**
 * Modules the platform offers that no Piggles app claims.
 *
 * This exists because the failure it catches is invisible. A module added to the
 * platform tomorrow registers surfaces, appears in sparx's rail, and simply does
 * not exist in Piggles — no error, no empty state, no gap anybody can see. Every
 * screen behind it is unreachable, and the only symptom is a customer eventually
 * asking where a feature went.
 *
 * The shell reports this once at boot in development. Deliberately not a thrown
 * error: a missing rail entry must never take the whole workspace down, and
 * shipping a module a day before its registry entry is a normal ordering, not a
 * fault.
 */
export function useUnclaimedModules(): WorkbenchModule[] {
  const visible = useVisibleNav();
  return useMemo(() => {
    const claimed = new Set(APPS.flatMap((app) => app.modules));
    return visible.map((entry) => entry.module).filter((module) => !claimed.has(module));
  }, [visible]);
}

/** The app a module belongs to, for chrome that has a module in hand and needs
 *  to say where it lives — a search result, a notification, a deep link that
 *  arrived naming a surface rather than an app. */
export function appForModule(nav: ConsoleNavApp[], module: string): ConsoleNavApp | undefined {
  return nav.find((entry) => entry.app.modules.includes(module));
}
