'use client';

// What a pane shows when its module is not active on this account.
//
// The fourth state, and it had no home. A pane's content could be waiting, empty
// or unloadable — and a surface belonging to a module the account does not have
// is none of those. It was arriving as the third: api-rest answers a disabled
// module with a 404, the pane called it a failed load, and a shop read
//
//   "Something went wrong reaching the server. Try again in a moment."
//
// over a **Try again** button that could not work on the first press or the
// hundredth. Nothing had gone wrong and nothing was unreachable.
//
// ── WHY THE MOUNT AND NOT THE PANE ──────────────────────────────────────────
//
// Because the pane is the wrong place to ask. There are 215 surfaces and the
// answer is the same for every one of them, so asking per-pane means 215 chances
// to forget — and 132 of them had already forgotten to pass their error along at
// all, which is how this reached "server unreachable" rather than even the
// missing-record wording.
//
// It is also knowable EARLIER. The shell already holds the module list that
// builds the rail, so a pane opened onto an inactive module can say so before a
// single request is made. The gate is `surfaceIsVisible` — the same predicate
// the rail and the command palette use, called a third time rather than written
// a third way. That file's own comment asks for exactly this: the rail and the
// launcher disagreeing about what exists is the bug it was written to prevent.
//
// ── WHAT THIS SAYS UNDER *THIS* BRAND, AND WHY IT DIFFERS ───────────────────
//
// sparx sells modules one at a time, so a switched-off module there is a choice
// somebody made and the way back is Settings → Modules. **Piggles is one plan
// with everything in it.** All apps is a RAIL PREFERENCE — "every one of them is
// included and working; this only decides which are on your rail, and it never
// changes what you pay" — and `platform.settings.modules` is hidden under this
// brand on purpose. Measured before writing this: 0 of 8 Piggles businesses have
// a single module off.
//
// So under Piggles this state is not a setting anybody chose. It is an account
// that is missing something it is entitled to, and the copy has to say that
// rather than tell somebody to switch on a thing they cannot see and never
// switched off. Sending her to All apps would be worse than saying nothing: it
// would move a rail preference and leave the pane exactly as broken.
//
// ── HOW SOMEBODY GETS HERE AT ALL ───────────────────────────────────────────
//
// Not from the rail, which hides it. From a saved layout pinned to the pane, a
// bookmark, a shared link, or the back button. Every one of those is somebody
// who had this open when it worked — so the sentence that matters most is that
// their work is still there.

import { faCircleQuestion } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { EmptyState } from '@wizeworks/silicaui-react';

import { moduleLabel } from '../lib/surfaces/nav';
import type { SurfaceDefinition } from '../lib/surfaces/registry';

export function SurfaceModuleOff({ definition }: { definition: SurfaceDefinition }) {
  const name = moduleLabel(definition.module);

  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1 px-6 py-10">
      <EmptyState
        // Warning, not error. Nothing is broken and nothing is lost; something
        // is missing that should be here. Red would say her data is in trouble.
        icon={
          <span className="text-warning">
            <Icon glyph={faCircleQuestion} className="size-6" aria-hidden />
          </span>
        }
        title={`${name} is not switched on for this business`}
        // No button, because there is nothing to press. She did not turn this
        // off and cannot turn it on: telling her where the fix ISN'T would only
        // send her round the rail looking for a switch that is not there.
        description={`Every part of Piggles is included, so this is not something you did. Nothing you have made in ${name} is lost. Use “Get help or tell us something” at the top and we will put it right.`}
      />
    </div>
  );
}
