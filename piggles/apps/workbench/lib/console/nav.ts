'use client';

import { useMemo } from 'react';
import type { PigglesIcon } from '@piggles/ui';
import { APPS, appIcon, moduleTerm, type PigglesAppDef } from '@piggles/config';
import type { PigglesGroup } from '@piggles/brand';
import { useVisibleNav } from '@/lib/surfaces/use-visible-nav';
import type { NavSection } from '@/lib/surfaces/nav';
import type { WorkbenchModule } from '@/components/module-scope';

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
  icon: PigglesIcon;
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

    // ── CLAIMED SURFACES ──────────────────────────────────────────────────────
    //
    // A surface a DIFFERENT app has claimed leaves its module's panel and joins
    // the claimant's. Partners is the case that needs it: the platform keeps
    // suppliers, purchase orders and receiving inside `inventory` beside stock
    // levels, and Piggles advertises them as their own app. See
    // `PigglesAppDef.claims`.
    //
    // Built once for every app, so the two halves — remove from here, add over
    // there — can never disagree.
    const claimedBy = new Map<string, string>();
    for (const app of APPS) {
      for (const key of app.claims ?? []) claimedBy.set(key, app.id);
    }

    /** Every claimed surface that is actually VISIBLE, with the section heading
     *  it arrived under. Anything gated away simply is not in here, so a claim
     *  can never resurrect a surface this person cannot reach. */
    const claimable = new Map<
      string,
      { surface: NavSection['surfaces'][number]; title: string | null }
    >();
    for (const entry of visible) {
      for (const section of entry.sections) {
        for (const surface of section.surfaces) {
          if (!claimedBy.has(surface.key)) continue;
          claimable.set(surface.key, { surface, title: section.title });
        }
      }
    }

    const apps: ConsoleNavApp[] = [];

    for (const app of [...APPS].sort((a, b) => a.navOrder - b.navOrder)) {
      // Only the modules that actually contributed surfaces. A module with none
      // — nothing registered, or everything gated away from this person — must
      // not leave an empty heading behind.
      const live = app.modules.filter((module) => byModule.has(module));

      const multiModule = live.length > 1;
      const sections: NavSection[] = [];

      /** Add rows under a heading, merging into one that is already there — a
       *  claimed "Buying it in" must not sit beside a same-named section this
       *  app already had. */
      const push = (title: string | null, surfaces: NavSection['surfaces']) => {
        if (surfaces.length === 0) return;
        const existing = sections.find((section) => section.title === title);
        if (existing) existing.surfaces = [...existing.surfaces, ...surfaces];
        else sections.push({ title, surfaces });
      };

      for (const [index, module] of live.entries()) {
        const entry = byModule.get(module);
        if (!entry) continue;

        for (const section of entry.sections) {
          push(
            // An untitled section is a module's landing group.
            //
            // The app's FIRST module keeps it untitled and it sits at the top —
            // that is the app's own front door, and heading it with the app's
            // own name puts "Sell" above the first row of the Sell panel, which
            // is a label explaining a thing the person just clicked. Later
            // modules in a multi-module app DO get a heading, because that is a
            // real seam: without it commerce, wholesale and dropshipping run
            // together into one thirty-row list.
            section.title ??
              (multiModule && index > 0 ? (moduleTerm(module) ?? entry.label) : null),
            // Rows another app has claimed leave this panel.
            section.surfaces.filter((surface) => (claimedBy.get(surface.key) ?? app.id) === app.id)
          );
        }
      }

      // ...and the rows this app claimed from elsewhere, under the heading they
      // arrived with.
      //
      // A claimed row that arrived UNSECTIONED is the interesting case, and the
      // right answer depends on whether this app has a front door of its own.
      // Partners does not — it is built entirely from claims — so its claimed
      // landing rows belong at the top, untitled, exactly as any other app's
      // would be. An app that DOES have its own modules keeps that slot for
      // itself, and a foreign row takes the name of the module it came from
      // rather than displacing the app's own first rows.
      for (const key of app.claims ?? []) {
        const claimed = claimable.get(key);
        if (!claimed) continue;
        const heading =
          claimed.title ??
          (live.length === 0 ? null : (moduleTerm(claimed.surface.module) ?? null));
        push(heading, [claimed.surface]);
      }

      // An app with nothing behind it is not an app this business has. Counted
      // AFTER claims are settled, so an app made entirely of claimed surfaces
      // (Partners, when dropshipping is off) still appears.
      const count = sections.reduce((total, section) => total + section.surfaces.length, 0);
      if (count === 0) continue;

      // The hue and `data-module` for this app's panes. The first live module,
      // or — for an app built purely from claims — the module the first claimed
      // surface belongs to, so a Partners pane still wears a hue rather than
      // none.
      const primary = live[0] ?? sections[0]?.surfaces[0]?.module;
      if (primary === undefined) continue;

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
