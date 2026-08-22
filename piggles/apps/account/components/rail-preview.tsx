'use client';

import { APPS, appIcon, railHasApp } from '@piggles/config';
import { Icon } from '@piggles/ui';
import type { PigglesGroup } from '@piggles/brand';

// The panel beside onboarding: what your Piggles looks like, updating as you
// answer.
//
// ── WHY ONBOARDING GETS A DIFFERENT PANEL FROM SIGN-IN ──────────────────────
//
// The credential screens put a promise beside the form, because somebody there
// is deciding. Somebody HERE has already decided — they have an account. Running
// the same pitch at them would be a product that has not noticed they said yes,
// and it would be answering a question they are no longer asking.
//
// The question they ARE asking is the one the form creates: "if I don't tick
// 'I sell things', have I just given up selling?" Every person who has ever used
// software with paid tiers has been trained to read a checklist as a purchase.
// The form answers it in words — "everything is included either way" — and words
// are the weaker half of the answer. This is the stronger half: the apps you did
// not tick are RIGHT THERE, named, in the same list, visibly present rather than
// visibly missing. Nothing is greyed out of existence, because nothing is.
//
// ── HOW ON AND OFF ARE DISTINGUISHED ────────────────────────────────────────
//
// By COLOR, never by fading. An app that is not starting on the rail keeps a
// fully readable label — DESIGN.md §3 reserves faded ink for text deliberately
// not meant to be read, and every name in this list is meant to be read; that is
// the entire point of showing them. What changes is the tile: the group's hue
// when the app starts on the rail, a plain recessed square when it does not.
//
// Ordering is the registry's `navOrder`, which is deliberately group-contiguous
// (see apps.ts), so ticking one box lights a solid RUN of the list rather than
// scattered rows. That run is the six-color system explaining itself before
// anybody has been in the product.

export function RailPreview({ picked }: { picked: PigglesGroup[] }) {
  const apps = [...APPS].sort((a, b) => a.navOrder - b.navOrder);
  // The SAME rule the answer is saved with — `railAppIds` in @piggles/config.
  //
  // This used to be `group === 'home' || picked.includes(group)`, which drew a
  // rail nobody ever got: several apps are on for everybody regardless of the
  // ticks, so a business that ticked website · sell · invoice was shown NINE and
  // given THIRTEEN. Issue #011. The rule lives in one place now, because this
  // panel's only job is to be a truthful picture of the result.
  const onCount = apps.filter((app) => railHasApp(app, picked)).length;

  return (
    <div className="rounded-box bg-base-100 border-base-300 border p-6">
      <h2 className="text-xl font-bold">What you will see</h2>
      {/* No "just Home for now" branch, because there is no such state: twelve
          apps are on the rail before anybody ticks anything, and saying
          otherwise was half of issue #011. The count starting high is the point
          — ticking a box ADDS to a working rail rather than unlocking one. */}
      <p className="mt-1 text-base">
        {onCount} apps, ready to go. The rest are one tap away whenever you want them.
      </p>

      <ul className="mt-5 flex flex-col gap-1">
        {apps.map((app) => {
          const on = railHasApp(app, picked);
          const glyph = appIcon(app.id);

          return (
            // `data-group` repoints `--color-module` for this row via the bridge
            // in @piggles/brand — the same mechanism the console's rail uses, so
            // this preview cannot drift from the thing it previews.
            <li key={app.id} data-group={app.group} className="flex items-center gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  on ? 'bg-module text-module-content' : 'bg-base-200 border-base-300 border'
                }`}
              >
                <Icon glyph={glyph} className="size-4.5" aria-hidden />
              </span>
              <span className={`text-base ${on ? 'font-bold' : ''}`}>{app.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
