'use client';

// The pane a Piggles workspace opens with.
//
// ── WHY THIS EXISTS WHEN THE PLATFORM ALREADY HAS A HOME ────────────────────
//
// sparx's Start here teaches the workspace: how to split a pane, how to tear one
// onto a second monitor, how arrangements persist. Its own header says it is
// deliberately NOT a dashboard, because "a summary screen would quietly re-teach
// the opposite lesson, that someone else decides what you look at first". For
// sparx's audience — an operator who came to arrange their own screen — that is
// exactly right, and this file does not touch it.
//
// Piggles' audience is the opposite case, and the same screen is wrong for them
// twice over. They did not choose to be in software today, so a lesson in window
// management is an obstacle between them and their work; and the question they
// actually arrive with is not "how do I arrange this" but "what needs me". An
// empty canvas cannot answer that.
//
// So this is an ADDITION, not a fork (piggles/CLAUDE.md RULE #0): a surface only
// the Piggles console registers, sitting beside the platform's own. Nothing in
// sparx knows it exists, and its own Start here is untouched.
//
// ── WHY IT IS SENTENCES AND NOT A GRID OF KPI CARDS ─────────────────────────
//
// The first version of this screen laid the five counts out as a grid of tiles,
// each with a label, a figure and a status pill. It read as a dashboard, which
// is to say it read as sparx — and a dashboard answers "how is the business
// doing", a question nobody opens their software at 8am to ask.
//
// The source pack asks the question in its own words and answers it in
// sentences (docs/initial/docs/ux/MDI_WORKBENCH.md, "Home"):
//
//     3 orders need attention · 2 people booked today
//     $1,840 waiting to be paid · 4 customers wrote you
//
// That is a person telling you what happened, not a system reporting metrics,
// and the difference is the whole product. So: full-width rows, one sentence
// each, the number the loudest thing in the line, and the row itself the door.
//
// Two consequences fall out of the sentence form, and both are improvements:
//
//   • A CLEARED item is not a row. Five green "all good" pills is five things to
//     read in order to learn that there is nothing to do; one quiet line at the
//     bottom says the same thing in one glance.
//   • WHEN EVERYTHING IS CLEAR the screen has almost nothing in it, which is
//     correct and is the best news this surface can carry. That is the moment
//     the mascot is for (DESIGN.md §7 — success moments), so she grows into the
//     space rather than the space reading as a screen that failed to load.
//
// ── THE ONE RULE THIS SCREEN LIVES OR DIES BY ───────────────────────────────
//
// Every number here is a real server count or it is not a number. A row that
// says "0 late invoices" because a request failed is worse than no row at all:
// it is indistinguishable from good news, and it is the kind of wrong that stops
// people checking. lib/console/home-data.ts carries the five outcomes; this file
// renders each of them differently and has no branch that turns "we do not know"
// into a digit. `error` and `unknown` are rows in their OWN right — not-knowing
// is something that needs you, so it belongs in the list rather than hidden in
// the quiet line.
//
// A module that is OFF has no row at all — not a zero, not a greyed-out card.

import { useMemo } from 'react';
import { Button, Card, CardBody, Heading, Skeleton, Text } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PigglesMascot } from '@piggles/mascot/react';
import type { SurfaceContext } from '@/lib/surfaces/registry';
import { ModuleScope } from '@/components/module-scope';
import { useFirstName } from '@/lib/api/shell-data';
import { FirstRunPanel } from './first-run';
import { ACTIONS, isClear, needsYou, quietLine, SIGNALS } from './home/signals';
import { TemplateUpdatePanel } from './home/template-update';
import { SignalRow } from './home/signal-row';
import { greeting, todayLine, useAttention } from '@/lib/console/home-data';

export function PigglesHomeSurface({ ctx }: { ctx: SurfaceContext }) {
  const attention = useAttention();
  const name = useFirstName();
  // Computed once per mount rather than per render: neither the greeting nor the
  // date may change under somebody mid-sentence because an unrelated re-render
  // happened to cross noon or midnight.
  const now = useMemo(() => new Date(), []);

  const live = SIGNALS.filter((signal) => attention[signal.key].state !== 'off');
  const waiting = live.filter((signal) => needsYou(attention[signal.key]));
  const clear = live.filter((signal) => isClear(attention[signal.key]));
  const counting = live.some((signal) => attention[signal.key].state === 'loading');

  // Three states, and they are genuinely different sentences. "Nothing needs
  // you" is only true once every signal has actually answered — saying it while
  // the counts are still in flight is the same lie as a defaulted zero.
  const settled = !counting && live.length > 0;
  const allClear = settled && waiting.length === 0;

  return (
    <div className="bg-base-200 @container h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 @[52rem]:px-10 @[52rem]:py-12">
        {/* The one hero on the surface, and the one place brand color is used
            decoratively — which DESIGN.md §7 sanctions precisely here, as a pale
            wash. Everything below it is a plain white card on a warm neutral
            ground, so the pink stays a greeting rather than a theme.

            A GRID, not absolute positioning, and that is the whole trick. She is
            a fixed-width column of her own, so she can never squeeze the heading
            (the first attempt let her share the row and pushed "Good afternoon,
            Marta." onto two lines) and she can never be cropped at the head
            (the second anchored her to the bottom edge of a panel shorter than
            she is, and took the top off). The panel's height simply follows her.

            The one deliberate crop is the negative bottom margin against
            `overflow-hidden`: her hooves run past the panel's lower edge, so she
            reads as standing IN the frame rather than pasted onto it. */}
        <header className="bg-accent bg-soft rounded-box grid items-end gap-6 overflow-hidden px-7 py-8 @[40rem]:grid-cols-[1fr_auto] @[52rem]:px-10">
          <div className="min-w-0">
            <Text className="text-base">{todayLine(now)}</Text>
            <Heading level={1} className="mt-1 text-4xl text-balance @[52rem]:text-5xl">
              {name ? `${greeting(now)}, ${name}.` : `${greeting(now)}.`}
            </Heading>
            <Text className="mt-3 text-lg text-pretty">
              {counting
                ? 'Just having a look at what came in.'
                : allClear
                  ? 'Nothing is waiting. Your business is ticking over nicely.'
                  : waiting.length === 1
                    ? 'One thing is waiting for you.'
                    : `${waiting.length} things are waiting for you.`}
            </Text>
          </div>

          {/* Hidden on a narrow pane rather than shrunk: below about 96px she
              stops being a character and becomes a smudge, and a dock pane can
              legitimately be 300px wide. */}
          <PigglesMascot
            intent={allClear ? 'success' : 'welcome'}
            size="md"
            className="pointer-events-none -mb-8 hidden justify-self-end select-none @[40rem]:block"
          />
        </header>

        <FirstRunPanel ctx={ctx} />

        {/* An OFFER, not a demand — so it sits outside "What needs you" and out
            of the quiet line. Renders nothing when every design is current. */}
        <TemplateUpdatePanel ctx={ctx} />

        {counting || waiting.length > 0 ? (
          <section className="mt-8">
            <Heading level={2} className="text-xl">
              What needs you
            </Heading>
            <Card className="mt-4 overflow-hidden">
              {/* No CardBody: the rows carry their own padding so a hover can
                  reach the full width of the card, and so the dividers run edge
                  to edge instead of stopping short in a gutter. */}
              <ul>
                {counting
                  ? live.map((signal) => (
                      <li key={signal.key} className="border-base-300 border-b p-5 last:border-b-0">
                        <Skeleton className="h-7 w-2/3" />
                      </li>
                    ))
                  : waiting.map((signal) => (
                      <SignalRow
                        key={signal.key}
                        signal={signal}
                        count={attention[signal.key]}
                        ctx={ctx}
                      />
                    ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {allClear ? (
          <Card className="mt-8">
            <CardBody>
              <Heading level={2} className="text-xl">
                You are all caught up
              </Heading>
              <Text className="text-lg">{quietLine(clear)}</Text>
            </CardBody>
          </Card>
        ) : clear.length > 0 ? (
          <Text className="mt-6 text-base">
            Everything else is fine — {quietLine(clear, { lead: false })}
          </Text>
        ) : null}

        <section className="mt-10">
          <Heading level={2} className="text-xl">
            Start something
          </Heading>
          {/* Stacked and full width below 64rem — the exact line the compact
              shell switches at (lib/use-compact.ts), so the buttons change shape
              with the presentation rather than at some unrelated breakpoint. A
              grid item stretches by default, so `block` is the container's job
              and no Button has to name a width. */}
          <div className="mt-4 grid grid-cols-1 gap-3 lg:flex lg:flex-wrap">
            {ACTIONS.map((action) => (
              <ModuleScope key={action.label} module={action.module as never}>
                <Button
                  color="module"
                  variant="soft"
                  size="lg"
                  // `block` on the BUTTON, not stretch on the container: the grid
                  // stretches its direct children, and each of these sits inside a
                  // ModuleScope wrapper, so the button underneath stayed
                  // inline-flex at half the column. Released back to its own width
                  // at the line the compact shell switches at.
                  block
                  className="lg:w-auto"
                  onClick={() => {
                    ctx.open(action.surface, action.params);
                  }}
                >
                  <Icon glyph={faPlus} className="size-5" aria-hidden />
                  {action.label}
                </Button>
              </ModuleScope>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
