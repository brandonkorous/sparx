'use client';

// The first three things, on the Home screen, for a business that has just
// arrived.
//
// ── WHAT THIS IS INSTEAD OF ─────────────────────────────────────────────────
//
// Not a wizard, not a gate, not a modal. See lib/console/first-run.ts for why —
// the short version is that getpiggles already asked the two questions worth
// asking, and a wizard opening over a working console contradicts the promise
// that you are already in.
//
// ── WHY THESE THREE ─────────────────────────────────────────────────────────
//
// Each one is a real thing a business does on its first day, each one is
// checkable against a server count, and doing all three means the software is
// genuinely in use rather than merely set up. They are ordered the way a day
// runs: something to sell, somebody to sell it to, and getting paid.
//
// Deliberately NOT here: "connect your domain", "invite your team", "set your
// tax rates". Those are real, and none of them is what somebody wants to do in
// their first ten minutes — a checklist that opens with admin is a checklist
// people close.
//
// ── AND WHY IT LEAVES ───────────────────────────────────────────────────────
//
// It disappears the moment all three are done, permanently, with no dismissal to
// hunt for. A getting-started panel that outstays its welcome is the clearest
// signal a product has stopped paying attention to the person using it.

import { Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { faArrowRight, faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PigglesMascot } from '@piggles/mascot/react';
import type { SurfaceContext } from '@/lib/surfaces/registry';
import { ModuleScope } from '@/components/module-scope';
import { useFirstRun, type FirstRunKey, type StepState } from '@/lib/console/first-run';

interface Step {
  key: FirstRunKey;
  module: string;
  /** The job, as a job. Never "Products" — that is a place, not something to do. */
  label: string;
  /** One line on why it is worth doing, in the reader's terms. */
  detail: string;
  surface: string;
  params?: Record<string, string>;
  /** What the row says once it is done — past tense, and warm. */
  doneLabel: string;
}

const STEPS: Step[] = [
  {
    key: 'product',
    module: 'commerce',
    label: 'Add the first thing you sell',
    detail: 'A product, a service, a session — whatever people pay you for.',
    surface: 'commerce.product.detail',
    params: { id: 'new' },
    doneLabel: 'You have something to sell',
  },
  {
    key: 'customer',
    module: 'crm',
    label: 'Add someone you work with',
    detail: 'Once they are here, their orders, messages and invoices gather in one place.',
    surface: 'crm.customer.detail',
    params: { id: 'new' },
    doneLabel: 'You have your first customer',
  },
  {
    key: 'invoice',
    module: 'invoicing',
    label: 'Send your first invoice',
    detail: 'Bill somebody and watch it land. This is the bit that pays for the rest.',
    surface: 'invoicing.invoice.edit',
    params: { id: 'new' },
    doneLabel: 'You have sent an invoice',
  },
];

export function FirstRunPanel({ ctx }: { ctx: SurfaceContext }) {
  const { steps, finished } = useFirstRun();

  // Its whole job is to leave. Once every applicable step is genuinely done it
  // never renders again — see lib/console/first-run.ts for why `finished` is
  // strict about what "done" means.
  if (finished) return null;

  const live = STEPS.filter((step) => steps[step.key] !== 'off');
  if (live.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardBody className="gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Heading level={2} className="text-xl">
              Let us get you going
            </Heading>
            <Text className="text-base text-pretty">
              Three things and your business is running here. Nothing else is waiting on them, so do
              them in any order — or none.
            </Text>
          </div>
          {/* Small, and only on a pane with room: this is a nudge, not an event. */}
          <PigglesMascot
            intent="welcome"
            size="sm"
            className="pointer-events-none -my-2 hidden shrink-0 select-none @[40rem]:block"
          />
        </div>

        <ul className="flex flex-col gap-2">
          {live.map((step) => (
            <StepRow key={step.key} step={step} state={steps[step.key]} ctx={ctx} />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/**
 * The marker's three jobs, and why there are three rather than two.
 *
 * `done` and `todo` are claims about the business. `asking` and `unknown` are
 * claims about US — one says we have not finished asking, the other says we
 * asked and could not get an answer. Drawing those with the job's own ring made
 * "we do not know" indistinguishable from "you have not done this", which is how
 * a checklist ends up telling somebody they have not added a product while their
 * product sits one tab away. So an unsettled step gets a plain grey ring in the
 * chassis color: visibly not an answer.
 */
function markerClass(state: StepState): string {
  if (state === 'done') {
    return 'bg-success text-success-content flex size-8 shrink-0 items-center justify-center rounded-full';
  }
  if (state === 'todo') {
    return 'border-module text-module flex size-8 shrink-0 items-center justify-center rounded-full border-2';
  }
  return 'border-base-300 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed';
}

function StepRow({ step, state, ctx }: { step: Step; state: StepState; ctx: SurfaceContext }) {
  const done = state === 'done';

  return (
    <ModuleScope module={step.module as never}>
      <li>
        <button
          type="button"
          // A done row is still a door — somebody who has added one product very
          // often wants to add a second — so it stays clickable rather than
          // going inert and grey.
          onClick={() => {
            ctx.open(step.surface, step.params);
          }}
          // `items-start`, not centre. On a phone the label wraps to two lines
          // and the sentence under it to three, and a vertically-centred tick
          // then floats beside the middle of the explanation rather than beside
          // the job it belongs to — which reads as a misaligned row rather than
          // a checklist. Aligned to the top it always sits against the first
          // line of the label, at every width.
          className="hover:bg-module hover:bg-soft rounded-box flex w-full items-start gap-3 p-3 text-left transition-colors @[26rem]:gap-4"
        >
          {/* The tick is the ONLY thing that changes on completion, and it is a
              filled shape rather than a color shift — "done" should be legible
              at a glance from across the desk (DESIGN.md RULE #4). */}
          <span className={markerClass(state)} aria-hidden>
            {done ? <Icon glyph={faCheck} className="size-4" /> : null}
          </span>

          <span className="min-w-0 flex-1">
            <Text className="font-medium">{done ? step.doneLabel : step.label}</Text>
            {/* The reason only matters while it is still a job. Once it is done
                the row is a shortcut, and the explanation is clutter. */}
            {done ? null : <Text className="text-base">{step.detail}</Text>}
            {/* Said out loud rather than left to the ring. A row that cannot be
                checked is still worth opening, but it must not pass itself off
                as one we checked and found undone. */}
            {state === 'unknown' ? (
              <Text className="text-base">We could not check this one just now.</Text>
            ) : null}
          </span>

          {/* Hidden on a phone. The whole row is the target, so the chevron is
              pure affordance — and at 390px it costs a third of the line the
              sentence needs, which turns three tidy rows into twelve. */}
          {/* Stays centred on the row while the tick and the label align to the
              top — it belongs to the whole row, not to the first line of it. */}
          <Icon
            glyph={faArrowRight}
            className="hidden size-5 shrink-0 self-center @[26rem]:block"
            aria-hidden
          />
        </button>
      </li>
    </ModuleScope>
  );
}
