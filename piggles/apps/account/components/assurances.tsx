import {
  faCloudUpload,
  faDownload,
  faEyeSlash,
  faShieldCheck,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { PigglesIcon } from '@piggles/ui';
import { marketingUrl, PRODUCT } from '@piggles/config';

// The band along the foot of every credential screen.
//
// ── EVERY LINE HERE IS ONE THE PRODUCT ALREADY COMMITS TO ───────────────────
//
// These four are lifted from meetpiggles.com/trust, which is the page a careful
// owner reads before putting their business on this, and which is deliberately
// written so that every sentence is TRUE rather than reassuring. That page
// refuses, in its own header comment, to claim two things this kind of strip
// normally claims:
//
//   • certifications — "a badge on a page is the cheapest lie in this industry"
//   • uptime percentages — "a number nobody is measuring yet is not a
//     commitment, it is a decoration"
//
// So there is no "99.9% uptime" here and there are no compliance badges. There
// is also no customer count and no logo wall: Piggles has not launched, so
// "trusted by thousands of small businesses" would be an invention, and an
// invention on the sign-in page is the worst possible place for one.
//
// If you add a fifth item, it has to be true on the day it ships and it has to
// be something /trust already says. Otherwise the two surfaces disagree about
// what the company promises, and the sign-in page is not where that argument
// should be discoverable.
//
// ── WHY IT RUNS FULL WIDTH ──────────────────────────────────────────────────
//
// It is a footer, not a card. Boxed and inset to the same measure as the form,
// it read as a fifth thing to deal with; full-bleed on its own surface it reads
// as the floor of the page, which is what it is. That is also why the divider
// between items is a hairline rather than a border on four boxes — one band, four
// facts, not four panels.

const ASSURANCES: { icon: PigglesIcon; title: string; body: string }[] = [
  {
    icon: faShieldCheck,
    title: 'Kept separate',
    body: 'Enforced by the database, not just the app.',
  },
  {
    icon: faCloudUpload,
    title: 'Backed up continuously',
    body: 'Somewhere other than the live system.',
  },
  {
    icon: faDownload,
    title: 'Yours to take with you',
    body: 'Export the lot, whenever you like.',
  },
  {
    icon: faEyeSlash,
    title: 'Never used to train AI',
    body: 'Not a model, not anonymised, not ever.',
  },
];

export function Assurances() {
  return (
    <section aria-label={`How ${PRODUCT.name} treats your data`} className="bg-base-100 mt-10">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        {/* `divide-x` from `sm` up only — stacked on a phone the rules would be
            horizontal lines between rows, which reads as four separate things
            again rather than one band. */}
        <ul className="sm:divide-base-300 grid gap-8 sm:grid-cols-2 sm:gap-0 sm:divide-x lg:grid-cols-4">
          {ASSURANCES.map(({ icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              {/* Brand pink, and the only color in the band. These four are one
                  category — trust — so a different hue each would be color
                  applied as decoration rather than as meaning (root RULE #4).
                  `shrink-0` because a two-line title must not squeeze the glyph. */}
              <Icon glyph={icon} className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
              <div>
                <h2 className="text-base font-bold">{title}</h2>
                <p className="mt-0.5 text-base">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-base">
          <a
            href={marketingUrl('trust')}
            className="text-primary font-semibold underline underline-offset-4"
          >
            The whole story, in plain words
          </a>
        </p>
      </div>
    </section>
  );
}
