import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { APP_BY_ID } from '@piggles/config';
import type { AppMarketing } from '@/content/apps';
import { HeroPanel, HeroPanelBar } from './panel';
import { Shot } from './shot';
import { APP_SHOTS } from '@/content/shots';

// /apps/[app] — the app itself, opened.
//
// Fifteen pages shared one hero and it showed nothing on any of them, so a
// visitor who followed "Stock" from the wall arrived at a paragraph about Stock.
// This is the app as a window with its own six things in it: built from the same
// `does[]` the page renders in full below, so the fold is the contents of the
// page rather than a picture bought in to fill it.
//
// ── THE TITLES ONLY, AND THAT IS THE POINT ──────────────────────────────────
//
// `does[].title` is a sentence-length claim — "What happened while you were
// closed", "Early warning, not a post-mortem" — and six of them read as a
// capability list in four seconds. The bodies stay downstairs where there is room
// to read them. A figure that carried both would be the section below it, moved
// up and made smaller.
//
// It wears the group hue through the `data-group` the page already sets on an
// ancestor, so nothing here names a color: Stock is amber on this page for the
// same reason it is amber in the rail, and neither place was told.
//
// ── THE LIST IS THE FALLBACK, NOT THE GOAL ──────────────────────────────────
//
// `copy.shot` replaces it with a PHOTOGRAPH of the real surface, inside the same
// window chrome — the strongest thing this fold can carry, because a picture of
// the actual screen is the one claim a visitor cannot argue with. The list stays
// for every app that has not been captured yet, so the fifteen pages are never
// half-finished: an uncaptured app shows six true sentences rather than a gap
// where an image will go.
//
// A shot has to come from a REAL workspace with real data in it. An empty screen
// photographed honestly is still a picture of nothing, and it makes the product
// look emptier than the drawing it replaced.

export function AppFigure({ app, copy }: { app: string; copy: AppMarketing }) {
  const def = APP_BY_ID[app];
  if (!def) return null;

  // NO <HeroPanel> and NO <HeroPanelBar> over a shot. A capture is of the WHOLE
  // console — the rail, the business name, and the dock with every open tab in
  // it — so it arrives with its own chrome and its own frame. Wrapping it in
  // ours would put a fake window around a real one, which reads as a rendering
  // fault rather than as depth. <Shot> carries the border and the lift itself.
  //
  // The dock is deliberately IN frame rather than cropped away. Keeping several
  // things open at once is the product's central claim — it is what the home
  // page's film spends six beats building to — and a tidy screenshot of one
  // isolated pane is a picture of that argument being thrown away. It stays
  // readable because the thumbnail opens full-viewport on click, not because the
  // page was rearranged around it.
  const shots = APP_SHOTS[app];
  if (shots?.length) {
    return <Shot app={app} shots={shots} />;
  }

  return (
    <HeroPanel>
      <HeroPanelBar app={app} title={def.label} note="In your workspace" />

      <ul className="divide-base-300 grid divide-y">
        {copy.does.map((d) => (
          <li key={d.title} className="flex items-center gap-3 px-5 py-3">
            {/* The tick is the hue's one appearance as a FILL in this figure,
                which is what group tokens are for. The words beside it stay on
                the surface's own ink — six lines of pale lavender is the exact
                failure `.ink-module` exists to stop, and this is a list to be
                read rather than a heading to be identified. */}
            <span className="bg-module text-module-content grid size-5 shrink-0 place-items-center rounded-full">
              <Icon glyph={faCheck} aria-hidden className="size-2.5" />
            </span>
            <span className="text-base font-semibold">{d.title}</span>
          </li>
        ))}
      </ul>

      <p className="px-5 py-4 text-base font-semibold">
        All of it, in the $49 plan, from your first day.
      </p>
    </HeroPanel>
  );
}
