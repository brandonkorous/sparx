import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { Logo } from '@piggles/brand/react';
import { marketingUrl, PRODUCT } from '@piggles/config';
import { AppearanceControl } from './appearance-control';
import { Assurances } from './assurances';

// The frame every signed-out / setup screen sits in.
//
// Deliberately not the marketing chrome: a person here is finishing one task,
// and a nav bar is a set of exits. The only link out is the logo.
//
// ── WHY IT IS TWO COLUMNS AND NOT A CENTRED CARD ────────────────────────────
//
// It was a centred card, which is the reflex "auth screen" shape and reads as a
// utility: a form, alone, on a page with nothing to say. That is fine for
// software somebody already trusts. It is wrong for the screen where a business
// owner decides whether to put their livelihood on this, which is what a signup
// page actually is — and it is wrong for a sign-in too, because the sign-in page
// is the surface a customer sees more often than any other.
//
// So the task keeps a card of its own, at a form's measure, and the space beside
// it carries the reason to be there. Two columns at `lg`, stacked below it.
//
// STACKING ORDER IS DELIBERATE: on a narrow screen the CARD comes first and the
// panel follows it. The panel is context and the card is the job — somebody on a
// phone signing in should not have to scroll past a pitch to reach the password
// field. On desktop the panel takes the left, where the eye starts.
//
// ── THE TWO SHAPES ──────────────────────────────────────────────────────────
//
// `auth` — a narrow form beside a wide panel. Sign in, create an account, the
// password screens. The form is three fields; anything wider than ~30rem makes
// the eye travel further than the content justifies.
//
// `setup` — a narrow panel beside a wide form. Onboarding, whose form holds a
// two-column grid of choices and needs the room. Its panel is a rail preview,
// which is a tall narrow thing by nature, so the proportions invert cleanly.
//
// Two values, not a free-form class, because the point is that there are exactly
// two shapes here and a third would be somebody guessing again.

type Shape = 'auth' | 'setup';

const GRID: Record<Shape, string> = {
  auth: 'lg:grid-cols-[1fr_minmax(0,30rem)]',
  setup: 'lg:grid-cols-[minmax(0,20rem)_1fr]',
};

// `setup`'s panel STAYS PUT while the form scrolls, and that is the difference
// between a preview and a picture. Onboarding's form is taller than a viewport —
// name, trade, five choices, six looks — so a panel that scrolls with it leaves
// the screen at exactly the moment the boxes it answers to are being ticked.
// Somebody ticks "I sell things" and the thing that was supposed to show them
// four apps arriving is a screen and a half above their thumb.
//
// Vertical alignment has to move with it: `items-center` sizes the column to its
// content and centres it, which leaves `sticky` no track to travel along. So
// `setup` starts its columns at the top and the panel sticks; `auth` keeps
// centring, because its panel is a fixed promise beside a three-field form and
// there is nothing to follow.
const ALIGN: Record<Shape, string> = {
  auth: 'items-center',
  setup: 'items-start',
};

const PANEL: Record<Shape, string> = {
  auth: '',
  setup: 'lg:sticky lg:top-10 lg:self-start',
};

export function AuthShell({
  heading,
  lede,
  children,
  panel,
  aside,
  footer,
  shape = 'auth',
}: {
  /** The task, named. Always the page's `h1` — the panel's big line beside it is
   *  a promise rather than a document heading, so it stays a `<p>`. */
  heading: string;
  lede?: string;
  children: ReactNode;
  /** The column beside the form. Omit it and the card centres itself. */
  panel?: ReactNode;
  /** A line under the card — the way to the other credential screen. */
  aside?: ReactNode;
  /** Small print under that. */
  footer?: ReactNode;
  shape?: Shape;
}) {
  return (
    // The one sanctioned decorative use of brand color (DESIGN.md §7): a pale
    // pink wash, resolved by silica's universal `soft` treatment from
    // `--color-accent` rather than baked as a hex, so it follows the theme into
    // dark. NOT a gradient — root's ban stands, and a flat wash is what the
    // brand board asks for anyway.
    // `flex flex-col` with the band OUTSIDE the centred container, so the band
    // runs the full width of the viewport while everything above it stays on the
    // 72rem measure. Boxed and inset like the form, it read as a fifth thing to
    // deal with; full-bleed on its own surface it reads as the floor of the page.
    <div className="bg-accent bg-soft flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 lg:px-10">
        {/* The logo and the appearance control are the only two things on this
            row, at opposite ends: the one way out, and the one preference a
            person can set before they have an account to keep it on. It sits
            here rather than beside the form because it is not part of the task —
            somebody reading in dark should be able to fix a white sign-in page
            without hunting, and then never look at this corner again. */}
        <div className="flex items-center justify-between gap-4">
          <Link href={marketingUrl()} aria-label={`${PRODUCT.name} home`}>
            <Logo className="h-11 w-auto" />
          </Link>
          <AppearanceControl />
        </div>

        <div
          className={`grid flex-1 gap-10 py-10 lg:gap-16 lg:py-16 ${panel ? `${ALIGN[shape]} ${GRID[shape]}` : 'items-center justify-items-center'}`}
        >
          {panel ? <div className={`order-2 lg:order-1 ${PANEL[shape]}`}>{panel}</div> : null}

          <div className={`order-1 w-full lg:order-2 ${panel ? '' : 'max-w-lg'}`}>
            <Card>
              <CardBody>
                <div>
                  {/* Matches the promise beside it. Fredoka's axis stops at
                      700, so `font-black` renders there. */}
                  <h1 className="text-3xl font-black sm:text-4xl">{heading}</h1>
                  {lede ? <p className="mt-2 text-lg">{lede}</p> : null}
                </div>

                {children}
              </CardBody>
            </Card>

            {aside ? <div className="mt-6 text-base">{aside}</div> : null}
            {footer ? <div className="mt-6 max-w-prose text-base">{footer}</div> : null}
          </div>
        </div>
      </div>

      {/* Only on the credential screens. Somebody in onboarding has already
          decided; re-arguing the case to a customer who just signed up reads as
          a product that has not noticed they said yes. */}
      {shape === 'auth' ? <Assurances /> : null}
    </div>
  );
}
