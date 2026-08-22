'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import type { PigglesGroup } from '@piggles/brand';
import type { BlueprintChoice } from '@/lib/furnish';
import { rankLooks } from '@/lib/looks';
import type { TradeOption } from '@/lib/trade-options';
import { completeOnboarding, type OnboardingState } from '@/app/onboarding/actions';
import { AuthShell } from './auth-shell';
import { RailPreview } from './rail-preview';
import { Choices } from './onboarding/choices';
import { LookPicker } from './onboarding/look-picker';

// Onboarding — two questions, a live preview of the answer, and the door in.
//
// This component is the STATE and the frame. The two question blocks are their
// own files (RULE #0.5): `onboarding/choices.tsx` holds "what do you do" and the
// reasoning about why unticking costs nothing, `onboarding/look-picker.tsx`
// holds the template shelf, and `lib/looks.ts` decides which templates that
// shelf shows.
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

/** The brand's own showcase — always offered, always first, preselected. */
const SHOWCASE_KEY = 'piggles-starter';

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
  trades,
}: {
  suggestedName: string;
  blueprints: BlueprintChoice[];
  /** Read from the packs on the server, so a trade the platform can furnish is
   *  never missing from the list somebody picks from (issue #001). */
  trades: TradeOption[];
}) {
  const [state, action] = useActionState<OnboardingState, FormData>(completeOnboarding, {
    error: null,
  });

  // Setup finished: leave for the console with a REAL navigation. The action
  // used to `redirect('/handoff')` itself, which made the client router fetch an
  // RSC payload for a route that 303s to another origin — a doomed request, a
  // fallback, and `/handoff` hit twice. It mints a single-use token, so the
  // second hit found it spent and bounced a brand-new customer back to sign-in
  // at the end of setting up their business. Full reasoning on `OnboardingState.done`.
  useEffect(() => {
    if (state.done) window.location.assign(state.done);
  }, [state.done]);
  const [picked, setPicked] = useState<PigglesGroup[]>([]);
  const [trade, setTrade] = useState('');
  const [look, setLook] = useState(SHOWCASE_KEY);

  const toggle = (g: PigglesGroup) =>
    setPicked((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  // The showcase first, then the templates that actually answer to this trade —
  // by what they are ABOUT, not just by which of four verticals they were filed
  // under. Recomputed as the trade changes, so answering "what kind of business"
  // visibly re-orders the looks rather than leaving a stale set that no longer
  // matches the answer above it. Why relevance and not the shelf: lib/looks.ts.
  const looks = useMemo(() => rankLooks(blueprints, trade, SHOWCASE_KEY), [blueprints, trade]);

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
            <FieldControl
              render={<Input size="lg" />}
              name="businessName"
              defaultValue={suggestedName}
              required
              maxLength={120}
            />
          </Field>

          <Field>
            <FieldLabel>What kind of business is it?</FieldLabel>
            {/* `NativeSelect` is a plain <select> and registers with the Field
                context no more than a bare <Input> does — checked on the screen,
                where its label came back an orphan. It goes through FieldControl
                too. Issue #006. */}
            <FieldControl
              render={<NativeSelect size="lg" />}
              name="industry"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              required
            >
              <option value="" disabled>
                Pick the closest one
              </option>
              {trades.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </FieldControl>
            <FieldDescription>
              We use this to fill your account with realistic examples — products, customers,
              bookings and pages — so nothing is empty when you walk in. Change or clear them
              whenever you like.
            </FieldDescription>
          </Field>
        </div>

        <Choices picked={picked} onToggle={toggle} />

        <LookPicker looks={looks} selected={look} onSelect={setLook} />

        <Submit />
      </form>
    </AuthShell>
  );
}
