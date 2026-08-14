import { CircleCheck, Clock, LayoutGrid, type LucideIcon } from 'lucide-react';
import { ProductGlimpse } from './product-glimpse';

// The column beside the form on the credential screens.
//
// Its job is not to sell — somebody on the sign-in page already bought in, and
// somebody on the signup page clicked through from a site that did the selling.
// Its job is to make the screen feel like a place rather than a checkpoint, and
// to answer the two questions a person actually has at this exact moment:
// "what am I getting" and "is this going to be a project".
//
// ── LENGTH IS THE DESIGN HERE ───────────────────────────────────────────────
//
// Title of three or four words, then ONE short line. Nothing longer.
//
// The first version gave each point a two-line paragraph, and the screen it
// produced was a page to read rather than a door to walk through. Nobody
// arriving at a sign-in form is in a reading mood — they are three seconds from
// typing an email address, and prose spends those seconds without buying
// anything.
//
// If a point cannot be made in one short line, it is not a point for this
// screen. The long version of every one of these already exists on
// meetpiggles.com, which is where somebody goes when they actually want it.
//
// ── WHAT REPLACED THE LOGO WALL ─────────────────────────────────────────────
//
// The reference this was built from ends with "trusted by thousands of small
// businesses" over five customer logos. Piggles has not launched: there are no
// thousands, and there are no logos. Inventing either would be a lie told on the
// one page whose entire job is establishing that this software can be trusted
// with a livelihood.
//
// What is true, and does the same work, is WHO IT IS FOR. Naming the kinds of
// business it was built around lets a florist recognise herself without anybody
// claiming she is already a customer. When there are real customers willing to
// be named, that line is the right place for them — and only then.

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CircleCheck, title: 'Everything included', body: 'All fifteen apps, one price.' },
  { icon: Clock, title: 'Ready in minutes', body: 'Two questions and you are in.' },
  { icon: LayoutGrid, title: 'One place for all of it', body: 'Site, customers, stock, invoices.' },
];

export function BrandPanel({
  lead,
  emphasis,
}: {
  /** The first half of the promise, in body ink. */
  lead: string;
  /** The half that lands, in brand pink. Colour is doing the work of a second
   *  sentence here, which is the point — see root DESIGN.md on colour replacing
   *  words rather than decorating them. */
  emphasis: string;
}) {
  return (
    <div className="max-w-xl">
      {/* A `<p>`, not an `<h1>`. The page's heading is the task named on the
          card — "Welcome back" — and this is a promise sitting beside it. Two
          h1s on one page is a document with two titles.

          Which is exactly why `font-heading` is written explicitly: a heading
          ELEMENT picks up the display face from a rule in globals.css, and a
          `<p>` can only get it from this utility. That utility did not exist
          until the `@theme` block was added there — see its comment — so this
          line rendered in the body face while every real heading beside it was
          in Nunito.

          `font-black` is 900, the weight Nunito ships for display and the one
          the brand board asks for. 800 is a hair too light at this size and
          reads as a paragraph that got big rather than as a headline. */}
      <p className="font-heading text-4xl leading-tight font-black sm:text-5xl">
        {lead}
        <br />
        <span className="text-primary">{emphasis}</span>
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            {/* Brand pink, no container. These three are one category — what you
                get — so a different hue each would be colour used as decoration
                rather than as meaning (root RULE #4). The same treatment as the
                assurance band at the foot of the page, so the two icon sets read
                as one system rather than two. */}
            <Icon className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-base">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <ProductGlimpse />

      <p className="mt-8 text-base font-semibold">
        For bakeries, barbers, florists, garages and workshops.
      </p>
    </div>
  );
}
