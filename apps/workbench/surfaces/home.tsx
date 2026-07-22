'use client';

// The pane a new workbench opens with.
//
// Its job is to teach the one idea the app depends on — that panels are yours to
// arrange — and then get out of the way. It is not a dashboard: no KPI tiles, no
// charts. A summary screen would quietly re-teach the opposite lesson, that
// someone else decides what you look at first.
//
// What it teaches depends on what the DEVICE can do. Half these gestures don't
// exist on a phone, and a first-run screen that opens by describing three
// things you cannot do is worse than one that says less: it reads as an app
// that doesn't know where it is running. So each lesson declares what it
// requires and the ones this presentation can't honour are omitted — not shown
// greyed out, omitted. See PaneHost.capabilities.

import { Search, Columns2, ExternalLink, Save } from 'lucide-react';
import { Button, Heading, Kbd, Text } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../lib/surfaces/registry';
import { useWorkbench } from '../lib/workbench/context';
import { WelcomeBanner } from './onboarding/welcome/welcome-banner';

interface Gesture {
  icon: typeof Search;
  title: string;
  body: string;
  /** Used instead of `body` where there is no arrangement to speak of. */
  compactBody?: string;
  /** Omitted unless the current presentation can do this. */
  requires?: 'split' | 'popout';
}

const GESTURES: Gesture[] = [
  {
    icon: Search,
    title: 'Open anything by name',
    body: 'Press ⌘K and start typing. No menus to learn — if you know what you want, say it.',
    compactBody:
      'Tap the magnifying glass and start typing. No menus to learn — if you know what you want, say it.',
  },
  {
    icon: Columns2,
    title: 'Put things side by side',
    body: 'Drag a tab to the edge of a panel to split it. Hold ⇧ when opening to place something alongside what you are already looking at.',
    requires: 'split',
  },
  {
    icon: ExternalLink,
    title: 'Pull a panel onto another screen',
    body: 'Drag a tab out of the window and let go. It becomes its own window you can move to a second monitor.',
    requires: 'popout',
  },
  {
    icon: Save,
    title: 'Keep an arrangement',
    body: 'Everything comes back exactly as you left it. Save a workspace for each kind of work you do, and open it whenever that work comes round.',
    // No workspaces here — there is no arrangement to name. What survives
    // is what you had open, which is the part that matters on a phone.
    compactBody: 'Whatever you had open comes back next time, exactly as you left it.',
  },
];

export function HomeSurface({ ctx }: { ctx: SurfaceContext }) {
  const { controller } = useWorkbench();
  const capabilities = controller.capabilities();
  const gestures = GESTURES.filter(
    (gesture) => !gesture.requires || capabilities[gesture.requires]
  );

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10 @[40rem]:px-8 @[40rem]:py-12">
        {/* The post-setup nudge — renders nothing once the checklist is done or
            the window has passed, so it never crowds the teaching content. */}
        <div className="mb-6 empty:mb-0">
          <WelcomeBanner ctx={ctx} />
        </div>
        <Heading level={1} className="text-2xl">
          Your workbench
        </Heading>
        <Text className="mt-2">
          {capabilities.split
            ? 'Every panel here is yours to move, resize, split, or pull onto a second screen. Nothing is fixed in place.'
            : 'Everything you open stays open. Move between what you have open along the bottom of the screen.'}
        </Text>

        <div className="mt-8 flex flex-col gap-5">
          {gestures.map((gesture) => (
            <div key={gesture.title} className="flex gap-3">
              <gesture.icon className="text-module mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">{gesture.title}</p>
                <Text className="mt-0.5 text-sm">
                  {!capabilities.split && gesture.compactBody ? gesture.compactBody : gesture.body}
                </Text>
              </div>
            </div>
          ))}
        </div>

        <div className="border-base-300 mt-10 flex flex-wrap items-center gap-3 border-t pt-6">
          <Button
            color="module"
            onClick={() => {
              ctx.open('invoicing.invoices.list');
            }}
          >
            Open invoices
          </Button>
          {/* The keyboard hint only makes sense where there is a keyboard. */}
          {capabilities.split ? (
            <Text className="text-sm">
              or press <Kbd size="sm">⌘</Kbd> <Kbd size="sm">K</Kbd> to search
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
