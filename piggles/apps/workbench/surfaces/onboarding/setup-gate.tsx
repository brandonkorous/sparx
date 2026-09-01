'use client';

// The guard in front of both setup flows, and what a business sees when it does
// not need them.
//
// ── WHY A GUARD AT ALL ──────────────────────────────────────────────────────
//
// In this console the two setup flows are ONLY reachable as surfaces: from the
// menu, from search, from a link. There is no first-run gate that mounts them
// before the workbench exists. So everybody who ever opens "Describe your
// business" or "Set up step by step" already has an account, and most of them
// already have a business behind it.
//
// Both flows were written for the other case. Neither reads a single thing about
// the business it is pointed at:
//
//   • The story canvas opens on a pristine salon — the first curated example —
//     and its one button says "Build my salon" to a womenswear label with fifty
//     pages and a year of orders.
//   • The switchboard opens on THAT salon's apps, so it shows Messages, Trade
//     customers, Connections and Dropshipping switched off on an account that
//     has all four switched on.
//
// And the first commit in either flow writes that fiction back. `saveModules`
// sends the whole switchboard at once, every app the story does not mention set
// to false, so one press turns off seven apps a running business is using. The
// step after installs a ready-made site into the site she already built, and the
// step after that renames the business and the site.
//
// None of that is reachable by accident today only because nobody has pressed
// the button. That is not a guard.
//
// ── WHY IT REFUSES RATHER THAN CONFIRMS ─────────────────────────────────────
//
// A confirm dialog is the usual answer to a destructive button, and it is the
// wrong one here, because every outcome setup can produce is already reachable
// without breaking anything:
//
//   adding or putting away an app   → All apps, in the rail
//   starting from a ready-made site → Ready-made sites, which installs alongside
//   renaming the business or site   → Business details
//   what is still worth doing       → Get set up, worked out from real rows
//
// So running setup again is never the better path to anything. Offering it
// behind a warning would be offering a strictly worse route and asking her to
// accept the risk of taking it. The screen says what it would have done, and
// where each part of it lives now.
//
// A business PART-WAY through setup is untouched by any of this and still gets
// the flow — see `isBusinessRunning`, which is careful about exactly that.

import type { ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faGear, faListCheck, faTableLayout } from '@fortawesome/pro-solid-svg-icons';

import { PaneWaiting } from '../../components/pane-waiting';
import { useOnboarding, useOnboardingProgress } from '../../lib/onboarding/api';
import { isBusinessRunning } from '../../lib/onboarding/entry';
import { useTenant } from '../../lib/api/shell-data';
import { surfaceTitle, type SurfaceContext } from '../../lib/surfaces/registry';

/** Where each thing setup does lives once a business is running. */
const ELSEWHERE = [
  {
    surface: 'workbench.welcome',
    icon: faListCheck,
    what: 'What is still worth doing, worked out from your own pages, orders and settings rather than from a checklist you ticked once.',
  },
  {
    surface: 'builder.blueprints',
    icon: faTableLayout,
    what: 'A whole site somebody else designed, ready to start from. It arrives beside what you already have, so nothing you built is replaced.',
  },
  {
    surface: 'platform.settings.general',
    icon: faGear,
    what: 'What your business is called and the web address people reach it at.',
  },
] as const;

export function SetupGate({ ctx, children }: { ctx: SurfaceContext; children: ReactNode }) {
  const onboarding = useOnboarding();
  const progress = useOnboardingProgress();

  // Wait for both before deciding. Mounting the flow and pulling it away a beat
  // later would show a salon to somebody who is not being offered one.
  if (onboarding.isLoading || progress.isLoading) {
    return <PaneWaiting label="Finding your business…" />;
  }

  // Neither read landing is not a reason to block setup: a business that cannot
  // be measured is treated as one that still needs it, which is the state the
  // flows were built for. The flow's own error handling takes it from here.
  const running = isBusinessRunning(onboarding.data ?? null, progress.data?.pageCount ?? 0);
  if (!running) return <>{children}</>;

  return <AlreadySetUp ctx={ctx} />;
}

function AlreadySetUp({ ctx }: { ctx: SurfaceContext }) {
  const tenant = useTenant();
  const name = tenant.data?.name?.trim();

  // The welcome checklist's skeleton, because this is the same kind of screen:
  // a landing surface with no toolbar, one column, and a row per place to go.
  // Same container, same row, same soft module button.
  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10 @[40rem]:px-8 @[40rem]:py-12">
        <div>
          <Heading level={1} className="text-2xl">
            {name ? `${name} is already set up` : 'This business is already set up'}
          </Heading>
          <Text className="mt-2">
            This screen builds a business from nothing, and yours is already running. Going through
            it again would switch your apps back to a starting set and lay a ready-made site over
            the one you have, so it stops here instead.
          </Text>
          <Text className="mt-2">
            Everything it would have asked you has its own screen now, and each of those changes one
            thing at a time.
          </Text>
        </div>

        {/* A row is dropped when this brand does not have that screen, rather than
            rendered as a button onto nothing. `surfaceTitle` returns null for a key
            that is unknown or hidden here, and that is its whole contract. */}
        <ul className="flex flex-col gap-3">
          {ELSEWHERE.map((entry) => {
            const title = surfaceTitle(entry.surface);
            if (!title) return null;
            return (
              <li
                key={entry.surface}
                className="border-base-300 bg-base-100 flex items-start gap-4 rounded-xl border p-4"
              >
                <Icon glyph={entry.icon} className="text-module mt-1 size-5 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="font-medium">{title}</p>
                  <Text className="text-sm">{entry.what}</Text>
                </div>
                <Button
                  size="sm"
                  color="module"
                  variant="soft"
                  className="shrink-0"
                  onClick={() => {
                    ctx.open(entry.surface, undefined, { target: 'replace' });
                  }}
                >
                  Open
                </Button>
              </li>
            );
          })}
        </ul>

        {/* Apps are the one thing with no screen to send her to: this console
            manages them from a door in the rail, never a settings page (that page
            is a per-module price list, which this product does not have). So it is
            named where it is, in the words the rest of the console uses for it. */}
        <Text>
          To add an app or put one away, open All apps, at the bottom of the menu down the side.
          Every app is included, so adding one never changes what you pay.
        </Text>
      </div>
    </div>
  );
}
