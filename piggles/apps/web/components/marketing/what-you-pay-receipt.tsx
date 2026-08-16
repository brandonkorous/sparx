import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';
import {
  amountOf,
  BILL_ROWS,
  type Bills,
  count,
  countCap,
  type Figures,
  PRICE,
  usd,
} from './what-you-pay-rows';

// Their bills, added up, with ours underneath.
//
// The same navy panel answer-receipt.tsx uses, because it is the same job: the
// site has one device for "here is your answer" and a second one would be a
// second design system. Everything redraws on every keystroke — there is no
// button to press, because unlike the home page's total this figure genuinely
// changes as you type.
//
// ── IT HAS TO BE ABLE TO SAY "DON'T BUY THIS" ───────────────────────────────
//
// <Verdict> has a branch for somebody whose bills come to less than $49, and it
// tells them plainly that Piggles is not the cheaper option for them. That
// branch is the reason the other two are worth reading. A calculator that
// arrives at "you are better off" from every set of inputs is an advert with
// fields in it, and this page's argument is that nothing here is hidden.
//
// ── AND IT NEVER CLAIMS THE HOURS BACK ──────────────────────────────────────
//
// <TimeCost> describes what the retyping costs TODAY. It does not promise that
// figure back, because we have not measured it on anybody and DESIGN.md §10 is
// absolute about that. The only claim attached is the structural one the whole
// site already makes: there is one place to type it, so the second and third
// typing is the part that goes.
//
// ── ONE BILL IS ITS OWN SENTENCE, EVERYWHERE ────────────────────────────────
//
// Every line here reads at f.bills === 1. That is not fussiness: the panel's
// whole argument is "several of these, against one of ours", and "one things
// that have never spoken to each other" is the exact register in which a page
// stops sounding like it was written by somebody.

const ROW = 'border-base-content/25 flex items-baseline justify-between gap-4 border-b py-2.5';

/**
 * The two ways a space beside a figure goes wrong, and the two different fixes.
 *
 * ── THE BUG: JSX EATS IT ────────────────────────────────────────────────────
 *
 * This panel rendered "You are spending $20a month" — measured, not feared. A
 * plain space next to an interpolation in JSX text is subject to the transform's
 * whitespace trimming and does not reliably survive. ui-kit.tsx records the same
 * fault and prescribes `{' '}`, which prettier then collapses back to a plain
 * space on the next format run — so that fix does not hold in a repo that
 * formats on push, and it did not hold here.
 *
 * Every sentence in this file that interpolates a figure is therefore ONE
 * template string. A JS string has no JSX whitespace rules to lose a space to,
 * and prettier will not reach inside it.
 *
 * ── THE TYPOGRAPHY: A FIGURE AND ITS UNIT SHOULD NOT BREAK ──────────────────
 *
 * `&nbsp;` would also survive both hazards, but it is a NON-BREAKING space and
 * using it as a general bug fix welds ordinary prose together — a narrow column
 * then wraps badly for a reason nobody can see. It is right in exactly one
 * place: between a number and the unit it belongs to, where "$221" alone at the
 * end of a line is the thing you were trying to avoid anyway.
 *
 * So: template strings for the bug, this for the typography.
 */
// Built from its code point, never typed as the character: a raw non-breaking
// space in source looks exactly like a normal one, so it gets "tidied" back to
// a plain space by the next person to touch the line — and nothing reports it.
const NB = String.fromCharCode(160);

function Line({ label, value }: { label: string; value: string }) {
  return (
    <li className={ROW}>
      <span className="text-base font-bold">{label}</span>
      <span className="text-base font-bold tabular-nums">{value}</span>
    </li>
  );
}

/** The two figures their own numbers add up to. Only once something is priced —
 *  a total of $0 beside nine ticked bills is a worse answer than no total. */
function Totals({ f }: { f: Figures }) {
  return (
    <div className="mt-6">
      <p className="flex items-baseline justify-between gap-4">
        <span className="text-xl font-bold">Every month</span>
        {/* tabular-nums is load-bearing: without it the row jitters sideways
            on every keystroke. */}
        <b className="font-heading text-4xl font-black tabular-nums sm:text-5xl">
          {usd(f.monthly)}
        </b>
      </p>
      <p className="mt-1 flex items-baseline justify-between gap-4">
        <span className="text-base font-bold">Every year</span>
        <b className="text-lg font-bold tabular-nums">{usd(f.yearly)}</b>
      </p>
    </div>
  );
}

/** What their answer means, said three different ways because there are three
 *  honest answers and only one of them is the flattering one. */
function Verdict({ f }: { f: Figures }) {
  if (f.difference > 0) {
    return (
      <>
        <p className="text-primary font-heading mt-4 text-2xl leading-tight font-black">
          {`${usd(f.difference * 12)}${NB}a year, on the software alone.`}
        </p>
        <p className="mt-3 text-base">
          {`That is the difference between what you typed in and $49 — your figures, not ours. ${
            f.bills > 1
              ? `The renewal dates, the logins, and ${count(f.bills, 'thing that has', 'things that have')} never once spoken to each other go with it.`
              : 'The renewal date and the separate login go with it.'
          }`}
        </p>
      </>
    );
  }

  if (f.difference === 0) {
    return (
      // "for one bill instead of one bill" is what the general sentence renders
      // at a single ticked row, and it is the exact kind of line that ships.
      <p className="mt-4 text-lg font-bold">
        {f.bills > 1
          ? `Exactly what you pay now, for one bill instead of ${count(f.bills, 'bill', 'bills')}.`
          : 'Exactly what that one thing costs you — for all fifteen apps.'}
      </p>
    );
  }

  return (
    <>
      <p className="font-heading mt-4 text-2xl leading-tight font-black">
        Piggles is not the cheaper option for you.
      </p>
      <p className="mt-3 text-base">
        {`You are spending ${usd(f.monthly)}${NB}a month, which is under the price. What you would be buying is the joining up — one place, one login, and never typing the same customer’s name into the fourth thing. If that is not worth ${usd(-f.difference)} to you, it is not, and we would rather you knew that here than in month three.`}
      </p>
    </>
  );
}

/** What the double-entry costs them a year. A description of today. */
function TimeCost({ hoursYearly }: { hoursYearly: number }) {
  return (
    <div className="border-base-content/25 mt-6 border-t pt-6">
      <p className="flex items-baseline justify-between gap-4">
        <span className="text-base font-bold">And the retyping costs</span>
        <b className="text-2xl font-black tabular-nums">{usd(hoursYearly)}</b>
      </p>
      <p className="mt-2 text-base">
        A year of your own hours, at the value you put on them. Piggles cannot hand you back the
        work — it can hand you back the part where you do it twice, because there is only one place
        to type it.
      </p>
    </div>
  );
}

/** Ours, under theirs. The one place on this page the price now appears with
 *  something standing next to it. */
function Ours({ f }: { f: Figures }) {
  return (
    <>
      <Totals f={f} />
      <p className="border-base-content/25 mt-6 flex items-baseline justify-between gap-4 border-t pt-6">
        <span className="text-xl font-bold">All of it, on Piggles</span>
        <b className="font-heading text-primary text-4xl font-black tabular-nums sm:text-5xl">
          {usd(PRICE)}
        </b>
      </p>
      <Verdict f={f} />
    </>
  );
}

export function WhatYouPayReceipt({ bills, f }: { bills: Bills; f: Figures }) {
  return (
    // aria-live on the region rather than the figure: a reader needs the lines
    // and the number, and announcing a bare total means nothing.
    //
    // A REAL THEME ISLAND, not `bg-secondary text-secondary-content`.
    //
    // DESIGN.md §3 says a dark band is an island rather than a background class,
    // and the theme toggle is what makes that bite. `--color-secondary` is
    // #2d3443 in light and #d7dbe3 in dark — so the utility form is a navy panel
    // for half the site's visitors and a PALE one for the other half, with
    // `text-primary` pink sitting on it either way. Pink on #d7dbe3 is the
    // failure this palette is most prone to.
    //
    // `data-theme="dark"` + `bg-base-200` is dark in BOTH themes, and everything
    // inside — ink, borders, the focus ring on the button — resolves against the
    // island rather than against the page it happens to be sitting on. The pink
    // then lands on the dark ground home.tsx measured at 6.56:1.
    <div
      aria-live="polite"
      data-theme="dark"
      className="bg-base-200 rounded-box flex grow flex-col p-6 sm:p-8"
    >
      <p className="font-heading text-3xl font-black sm:text-4xl">
        {`${countCap(f.bills, 'bill', 'bills')}. ${countCap(f.bills, 'renewal date', 'renewal dates')}.`}
      </p>

      <ul className="mt-6">
        {BILL_ROWS.filter((row) => bills[row.id].on).map((row) => (
          <Line
            key={row.id}
            label={row.label}
            value={amountOf(bills[row.id].amount) > 0 ? usd(amountOf(bills[row.id].amount)) : ''}
          />
        ))}
      </ul>

      {f.priced > 0 ? (
        <Ours f={f} />
      ) : (
        <p className="mt-6 text-lg">
          {`Put what each one costs beside it and this works out where you stand. Or leave them empty — ${count(f.bills, 'thing', 'things')} to keep paying for is an answer on its own, and Piggles is one.`}
        </p>
      )}

      {f.hoursYearly !== null ? <TimeCost hoursYearly={f.hoursYearly} /> : null}

      <a
        className={`${buttonClasses({ color: 'primary', size: 'lg', block: true })} mt-8`}
        href={accountUrl('signup', 'pricing-calculator')}
      >
        Start free for 14 days
      </a>
      <p className="mt-3 text-base">
        No card needed. $49 covers one business, one website and three people — the whole list is
        right below.
      </p>
    </div>
  );
}
