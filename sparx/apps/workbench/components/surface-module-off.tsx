'use client';

// What a pane shows when its module is switched off.
//
// The fourth state, and it had no home. A pane's content could be waiting, empty
// or unloadable — and a surface belonging to a module this account has not turned
// on is none of those. It was arriving as the third: api-rest answers a disabled
// module with a 404, the pane called it a failed load, and a shop read
//
//   "Something went wrong reaching the server. Try again in a moment."
//
// over a **Try again** button that could not work on the first press or the
// hundredth. Nothing had gone wrong and nothing was unreachable. She had turned
// Email off, and the console could not tell her that.
//
// ── WHY THE MOUNT AND NOT THE PANE ──────────────────────────────────────────
//
// Because the pane is the wrong place to ask. There are ~100 surfaces and the
// answer is the same for every one of them, so asking per-pane means a hundred chances
// to forget — and 34 of them had already forgotten to pass their error along at
// all, which is how this reached "server unreachable" rather than even the
// missing-record wording.
//
// It is also knowable EARLIER. The shell already holds the module list that
// builds the rail, so a pane opened onto a switched-off module can say so before
// a single request is made. The gate here is `surfaceIsVisible` — the same
// predicate the rail and the command palette use, called a third time rather
// than written a third way. That file's own comment asks for exactly this: the
// rail and the launcher disagreeing about what exists is the bug it was written
// to prevent.
//
// ── HOW SOMEBODY GETS HERE AT ALL ───────────────────────────────────────────
//
// Not from the rail, which hides the module. From a saved layout pinned to the
// pane before it was switched off, a bookmark, a shared link, or the back
// button. Every one of those is somebody who had this open when it worked — so
// the sentence that matters most is that their work is still there.

import { ToggleLeft } from 'lucide-react';
import { Button, EmptyState } from '@wizeworks/silicaui-react';

import { moduleLabel } from '../lib/surfaces/nav';
import type { SurfaceDefinition } from '../lib/surfaces/registry';
import type { SurfaceContext } from '../lib/surfaces/registry';

/** Where somebody turns it back on. */
const MODULES_SURFACE = 'platform.settings.modules';

export function SurfaceModuleOff({
  definition,
  ctx,
}: {
  definition: SurfaceDefinition;
  ctx: SurfaceContext;
}) {
  const name = moduleLabel(definition.module);

  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1 px-6 py-10">
      <EmptyState
        // Warning, not error. Switching a module off is a decision somebody
        // made, and painting it red tells them their account is broken when
        // they are looking at the consequence of their own choice.
        icon={
          <span className="text-warning">
            <ToggleLeft className="size-6" aria-hidden />
          </span>
        }
        title={`${name} is switched off`}
        description={`Nothing you made in ${name} is lost. It is hidden until you turn it back on. Everything else in your account is unaffected.`}
        actions={
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open(MODULES_SURFACE, {}, { target: 'beside' });
            }}
          >
            Turn it back on
          </Button>
        }
      />
    </div>
  );
}
