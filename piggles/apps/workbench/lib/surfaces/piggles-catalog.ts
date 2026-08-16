// Surfaces that only the Piggles console has.
//
// Imported for its SIDE EFFECT, immediately after the platform catalog, exactly
// as that catalog is imported — see components/console-shell.tsx. Order matters:
// the platform's surfaces register first, then these, so a Piggles key can never
// be silently shadowed by one arriving later.
//
// ── WHAT MAY GO IN HERE, AND WHAT MAY NOT ───────────────────────────────────
//
// ADDITIONS only. A surface here answers a question the platform does not ask,
// for an audience it was not written for. It is registered under its OWN key and
// sits beside the platform's, which stays registered and stays reachable.
//
// What must never go in here is a REPLACEMENT — re-registering a platform key
// with a Piggles component. That is a fork wearing a registry entry: the two
// implementations drift, every fix has to be made twice, and the second one is
// always found late (piggles/CLAUDE.md RULE #0). If a shared surface is wrong
// for Piggles, the fix is a prop, a token, or a registry field — upstream, where
// sparx gets it too.
//
// The rule has one honest test: after this file runs, every platform key still
// resolves to the platform's own component.

import { registerSurfaces } from '@/lib/surfaces/registry';
import { faHouse } from '@fortawesome/pro-solid-svg-icons';
import { PigglesHomeSurface } from '@/surfaces/home';

registerSurfaces([
  {
    // NOT 'workbench.home'. That key belongs to the platform's Start here, which
    // stays exactly as it is for sparx; this is a second, differently-shaped
    // answer to "what do I look at first", and only the Piggles console opens
    // it. Keys are persisted in saved layouts, so this one is permanent.
    key: 'piggles.home',
    title: 'Home',
    module: 'platform',
    icon: faHouse,
    component: PigglesHomeSurface,
    // One workspace, one Home — a second copy shows the same five numbers.
    singleton: true,
    keywords: ['home', 'today', 'what needs me', 'start'],
    order: 0,
  },
]);
