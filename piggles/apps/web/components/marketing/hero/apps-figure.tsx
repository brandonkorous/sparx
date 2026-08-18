import { Icon } from '@piggles/ui';
import { APPS, appIcon } from '@piggles/config';
import { HeroPanel } from './panel';

// /apps — the count, made countable.
//
// The page's whole job is to be believed about "fifteen", and it opened with the
// claim over blank space. Fifteen tiles is the claim done rather than said: you
// can count them, and counting is exactly the thing a visitor was about to be
// sceptical of.
//
// ── THE GRID IS 5×3 BECAUSE THE REGISTRY IS 15 ──────────────────────────────
//
// Not a decorative choice — an exact fill with no gap and no sixteenth slot, so
// the shape itself says the set is complete. If an app is ever added the grid
// re-flows rather than breaking, but the number in the copy around it is
// hand-written on four pages and this is one more place to check.
//
// ── SOLID HUES, ORDERED BY THE RAIL ─────────────────────────────────────────
//
// `bg-module` + `text-module-content` — the group hue as a FILL with its own
// ink, which is what these tokens are for and the only way a pale hue carries at
// this size. `navOrder` keeps each group contiguous, so the color blocks arrive
// in runs and a visitor reads six families before anybody explains that there
// are six. The rail teaches the same thing on day one, in the same order.

export function AppsFigure() {
  return (
    <HeroPanel>
      <div className="grid grid-cols-3 gap-px sm:grid-cols-5">
        {APPS.map((app) => (
          <div
            key={app.id}
            data-group={app.group}
            className="bg-module text-module-content grid aspect-square place-content-center gap-2 p-2 text-center"
          >
            <Icon glyph={appIcon(app.id)} aria-hidden className="mx-auto size-6" />
            <span className="text-sm leading-tight font-bold text-balance">{app.label}</span>
          </div>
        ))}
      </div>

      {/* The line under the wall is the part that is hard to believe, so it sits
          with the thing that proves it rather than in the body copy. */}
      <p className="px-5 py-4 text-base font-semibold">
        Every one of them, on every plan, from your first day.
      </p>
    </HeroPanel>
  );
}
