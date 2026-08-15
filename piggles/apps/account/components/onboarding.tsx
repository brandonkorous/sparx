'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import type { PigglesGroup } from '@piggles/brand';
import { appsInGroup } from '@piggles/config';
import type { BlueprintChoice } from '@/lib/furnish';
import { completeOnboarding, type OnboardingState } from '@/app/onboarding/actions';
import { AuthShell } from './auth-shell';
import { RailPreview } from './rail-preview';

// "What do you do" — the second and last question.
//
// The options are the six colour groups, described by what a person does rather
// than by what the software is. Picking some is optional and picking none is
// fine: the answer only decides what starts on the rail.
//
// The list of apps under each option is shown ON PURPOSE, and the copy says
// plainly that everything stays available. Somebody who does not tick "Selling"
// must not be able to leave this screen believing they have just given up
// invoices — the fear that a choice here costs you something is exactly what
// module pricing trained everybody to expect, and this is the screen where
// Piggles either contradicts that or quietly confirms it.
//
// ── WHY THIS COMPONENT OWNS THE SHELL ───────────────────────────────────────
//
// The panel beside this form is a LIVE preview of the rail these checkboxes
// build, so the answer and the picture of the answer have to share one piece of
// state. The page cannot hold it (it is a server component reading the tenant),
// and lifting it into a context for two siblings would be ceremony for one
// boolean array. So the client component that owns `picked` renders the frame
// too, and the page stays what it should be: a session read and a name lookup.
//
// The shell is presentational — layout, a logo, a card — so pulling it into this
// route's client bundle costs nothing anybody can measure.

// The lines of work the platform has a sample dataset for. The VALUES are the
// real pack slugs (`settings.industry`) and must stay that way — the action
// validates them against the packs, and anything it does not recognise falls
// back to the generic set rather than failing, so a typo here would ship as a
// bakery quietly getting generic data.
//
// The labels are ours. The packs call themselves things like "Apparel & fashion"
// and "Generic starter", which is a catalogue talking about itself; a person
// picking their own trade off a list should read words they would use about
// their own business (RULE #3). Ordered by how likely somebody is to find
// themselves in it, with the catch-all last where a catch-all belongs.
const TRADES: { value: string; label: string }[] = [
  { value: 'food', label: 'Food & drink' },
  { value: 'salon', label: 'Beauty & salon' },
  { value: 'apparel', label: 'Clothing & accessories' },
  { value: 'professional', label: 'Professional services' },
  { value: 'fitness', label: 'Fitness & wellbeing' },
  { value: 'auto-parts', label: 'Car parts & repair' },
  { value: 'electronics', label: 'Electronics & tech' },
  { value: 'wholesale', label: 'Wholesale & trade supply' },
  { value: 'generic', label: 'Something else' },
];

/** The brand's own showcase — always offered, always first, preselected. */
const SHOWCASE_KEY = 'piggles-starter';

/** How many looks to show. A wall of 190 is not a choice, it is a search task,
 *  and this screen is meant to take a glance. The trade narrows it; this caps it. */
const LOOK_LIMIT = 6;

/**
 * The trade a person picks → the broad shelf its templates sit on.
 *
 * Coarse ON PURPOSE. The catalog classifies templates four ways (retail ·
 * services · content · b2b) and separately names ~138 specific trades that are
 * NOT stored anywhere queryable — so this is the honest join, not a lossy one.
 * It orders the shelf; it never hides the rest, which is why the list falls back
 * to everything when a trade has no obvious shelf.
 */
const TRADE_SHELF: Record<string, string> = {
  food: 'retail',
  salon: 'services',
  apparel: 'retail',
  professional: 'services',
  fitness: 'services',
  'auto-parts': 'services',
  electronics: 'retail',
  wholesale: 'b2b',
};

const OPTIONS: { group: PigglesGroup; label: string; hint: string }[] = [
  { group: 'web', label: 'I need a website', hint: 'Pages, writing, and turning up in search' },
  { group: 'sell', label: 'I sell things', hint: 'Products or services, and what you have left' },
  {
    group: 'people',
    label: 'I deal with customers',
    hint: 'Their history, messages, appointments',
  },
  { group: 'money', label: 'I invoice people', hint: 'Bills, payments, and where you stand' },
  { group: 'run', label: 'I work with a team', hint: 'Who can see what, and the routine jobs' },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="primary" size="lg" block loading={pending}>
      {pending ? 'Setting things up' : 'Take me in'}
    </Button>
  );
}

export function Onboarding({
  suggestedName,
  blueprints,
}: {
  suggestedName: string;
  blueprints: BlueprintChoice[];
}) {
  const [state, action] = useActionState<OnboardingState, FormData>(completeOnboarding, {
    error: null,
  });
  const [picked, setPicked] = useState<PigglesGroup[]>([]);
  const [trade, setTrade] = useState('');
  const [look, setLook] = useState(SHOWCASE_KEY);

  const toggle = (g: PigglesGroup) =>
    setPicked((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  // The showcase first, then this trade's shelf, capped. Recomputed as the trade
  // changes, so answering "what kind of business" visibly re-orders the looks
  // rather than leaving a stale set that no longer matches the answer above it.
  const looks = useMemo(() => {
    const showcase = blueprints.filter((b) => b.key === SHOWCASE_KEY);
    const shelf = TRADE_SHELF[trade];
    const rest = blueprints.filter((b) => b.key !== SHOWCASE_KEY);
    const onShelf = shelf ? rest.filter((b) => b.vertical === shelf) : rest;
    // Falling back to the whole list matters: a trade whose shelf happens to be
    // empty must still offer looks, or the section renders as one lonely card
    // and reads like the catalog is broken.
    const pool = onShelf.length > 0 ? onShelf : rest;
    return [...showcase, ...pool].slice(0, LOOK_LIMIT);
  }, [blueprints, trade]);

  return (
    <AuthShell
      shape="setup"
      heading="A few quick things."
      lede="Then you are in. Nothing here is a commitment — we set it all up for you and you can change your mind once you are inside."
      panel={<RailPreview picked={picked} />}
    >
      <form action={action} className="flex flex-col gap-8">
        {state.error ? (
          <Alert color="danger" variant="soft">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {/* The business itself — what it is called and what it does for a
            living. Two fields, one question: both describe the same thing, and
            splitting them into separate beats would make a two-question screen
            claim to be three. */}
        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel>What is your business called?</FieldLabel>
            <Input
              name="businessName"
              size="lg"
              defaultValue={suggestedName}
              required
              maxLength={120}
            />
          </Field>

          <Field>
            <FieldLabel>What kind of business is it?</FieldLabel>
            <NativeSelect
              name="industry"
              size="lg"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              required
            >
              <option value="" disabled>
                Pick the closest one
              </option>
              {TRADES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>
              We use this to fill your account with realistic examples — products, customers,
              bookings and pages — so nothing is empty when you walk in. Change or clear them
              whenever you like.
            </FieldDescription>
          </Field>
        </div>

        <div>
          <h2 className="text-xl font-bold">What do you do?</h2>
          <p className="mt-1 text-base">
            Pick any that fit. This only decides what you see first — everything is included either
            way, and nothing is switched off by leaving it unticked.
          </p>

          {/* Two columns from `sm` up. Five rows in one column is a scroll for
              something that should be taken in at a glance — the whole question is
              "which of these are you", which needs them side by side to compare. */}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {OPTIONS.map((o) => {
              const on = picked.includes(o.group);
              return (
                <li key={o.group} data-group={o.group}>
                  {/* A label bound to a real checkbox: the whole row is the hit
                      target, keyboard focus and the space bar work with no
                      handlers of ours, and it is announced as a checkbox because
                      it IS one.

                      Bound with htmlFor/id rather than by nesting alone, and the
                      three lines of text are DIRECT children of the label — a
                      grid places them in the second column beside the row-spanning
                      checkbox, rather than a wrapper <span> holding them. Nesting
                      them one level deeper puts the accessible name further from
                      the label than a tool will look for it, which is what
                      jsx-a11y objects to. The grid gets the same layout with the
                      text where it belongs. */}
                  <label
                    htmlFor={`does-${o.group}`}
                    className={`rounded-box grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-4 border p-5 transition-colors ${
                      on ? 'border-module bg-module bg-soft' : 'border-base-300 bg-base-100'
                    }`}
                  >
                    <Checkbox
                      id={`does-${o.group}`}
                      name="does"
                      value={o.group}
                      color="module"
                      checked={on}
                      onChange={() => toggle(o.group)}
                      className="row-span-3 mt-0.5"
                    />
                    <span className="text-lg font-bold">{o.label}</span>
                    <span className="text-base">{o.hint}</span>
                    <span className="mt-2 text-base font-semibold">
                      {appsInGroup(o.group)
                        .map((a) => a.label)
                        .join(' · ')}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {/* The look. Shown only when the catalog answered — an empty list means
            the picker could not load, and the action falls back to the brand's
            own showcase, so a broken fetch costs a choice rather than a site. */}
        {looks.length > 0 ? (
          <div>
            <h2 className="text-xl font-bold">How should it look?</h2>
            <p className="mt-1 text-base">
              Every one is a complete working site — shop, journal, bookings and all. You can
              rewrite any of it once you are in.
            </p>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {looks.map((b) => {
                const on = look === b.key;
                return (
                  <li key={b.key}>
                    <label
                      htmlFor={`look-${b.key}`}
                      className={`rounded-box grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-4 border p-5 transition-colors ${
                        on ? 'border-module bg-module bg-soft' : 'border-base-300 bg-base-100'
                      }`}
                    >
                      <input
                        type="radio"
                        id={`look-${b.key}`}
                        name="blueprintKey"
                        value={b.key}
                        checked={on}
                        onChange={() => setLook(b.key)}
                        className="radio radio-module row-span-3 mt-0.5"
                      />
                      <span className="text-lg font-bold">{b.name}</span>
                      <span className="text-base">{b.summary}</span>
                      {b.preview ? (
                        // A plain <img>, not next/image: the card art is served by
                        // api-rest's media proxy on a host this app has no remote
                        // pattern for, and adding one is a wider change than this
                        // screen. Lazy, and decorative — the name beside it is the
                        // accessible label, so the alt is deliberately empty.
                        <img
                          src={b.preview}
                          alt=""
                          loading="lazy"
                          className="rounded-box border-base-300 mt-3 w-full border"
                        />
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <Submit />
      </form>
    </AuthShell>
  );
}
