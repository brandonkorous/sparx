// HOW to photograph each surface — the recipe the registry does not carry.
//
// `content/shots.ts` says WHAT exists and how it is described. This says how to
// get the console into that state. Two files because they answer to different
// people: a docs author edits the registry, nobody but this script reads a plan.
//
// ── THE ARRANGEMENT IS BUILT THE WAY A PERSON BUILDS ONE ────────────────────
//
// A URL names ONE destination — that is the workbench's whole address model, and
// the multi-pane form it used to have is legacy the app is retiring. So a shot
// arrives on its primary surface by link, then opens its companions through the
// LAUNCHER, with the modifier that says where each one lands (↵ tab, ⇧↵
// alongside, ⌥↵ its own window). That contract is the product's, so a capture
// can only ever compose an arrangement somebody could compose by hand.
//
// ── `ready` IS THE "REAL DATA OR NO SHOT" RULE, MECHANISED ──────────────────
//
// Every entry names a string that only appears once REAL Wildroot data has
// rendered — a product, a location, a person. A selector that matches an empty
// table would let a picture of nothing through, and an empty list photographed
// honestly is still a picture of nothing.

/** The site is not in any URL: Wildroot has one business, so the session is
 *  already in the right workspace and `?site=` would only add a way to be wrong. */
export const PLAN = {
  stock: {
    levels: {
      path: '/inventory/stock',
      ready: 'Garden Roses, by the Bunch',
      mode: 'tabs',
      then: [{ open: 'Products', where: 'beside', ready: 'The Market Bouquet' }],
      // Stock stays focused: the pane the page is ABOUT should be the one the
      // eye lands on, and `beside` focuses whatever it just opened.
      focus: 'Stock',
    },
    // Windows mode, so the two land as floating panes rather than a split. Same
    // `beside` move: `where: 'window'` is advertised by the launcher and does
    // nothing (dock-host's `positionFor` has no case for it and `add` never pops
    // out), so nothing here may rely on it until that is fixed.
    batches: {
      path: '/inventory/lots',
      ready: 'Garden Roses, by the Bunch',
      mode: 'windows',
      then: [{ open: 'Stock', where: 'beside', ready: 'Shop Cooler' }],
      focus: 'Batches and serial numbers',
    },
    locations: {
      path: '/inventory/locations',
      ready: 'Shop Cooler',
      mode: 'tabs',
      then: [{ open: 'Batches and serial numbers', where: 'tab', ready: 'Garden Roses' }],
      focus: 'Locations',
    },
    // Not `counts`: the florist pack seeds warehouses and lots and no inventory
    // count, so that surface has only its empty state to photograph.
    reorder: {
      path: '/inventory/reorder',
      ready: 'Ranunculus, by the Bunch',
      mode: 'tabs',
    },
  },
};

/** Every viewport a shot is taken at, unless the entry narrows it. */
export const DEFAULT_VIEWPORTS = ['desktop', 'mobile'];

/** Both, always. The page serves the one matching the visitor's theme. */
export const THEMES = ['light', 'dark'];

/**
 * The recipe for one surface, or null when there is none.
 *
 * Null is not an error at the top level: a plan entry may exist for a surface
 * the registry has not described yet (that is how a new surface gets shot before
 * anybody can write its alt text), and a registry entry with no plan is caught
 * by the runner rather than here.
 */
export function recipeFor(app, surface) {
  return PLAN[app]?.[surface] ?? null;
}

/** Every (app, surface) pair the plan knows how to shoot. */
export function plannedShots() {
  return Object.entries(PLAN).flatMap(([app, surfaces]) =>
    Object.keys(surfaces).map((surface) => ({ app, surface }))
  );
}
