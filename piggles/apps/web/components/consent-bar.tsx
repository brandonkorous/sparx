'use client';

// The one question this site asks, and the only thing on it that sets a cookie.
//
// Opt-in: it sits there until answered, and nothing non-essential runs before
// the answer. It disappears entirely once given — a bar that stays is a bar
// people learn to click past without reading, which makes the answer worthless.
//
// Two grants, not one. "Where did you come from" (a campaign) and "which ad did
// you click" (a click id that identifies one specific click) are different
// questions, and somebody may reasonably say yes to the first and no to the
// second. Bundling them into a single Accept is how consent becomes a formality.
//
// The decision is changeable forever from the footer, which fires the event this
// component listens for.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Checkbox } from '@wizeworks/silicaui-react';
import {
  ALL_GRANTED,
  ESSENTIAL_ONLY,
  getConsent,
  setConsent,
  type ConsentState,
} from '../lib/consent';

const OPEN_EVENT = 'piggles:open-consent';

/** Reopen the question from anywhere — the footer's "Cookie choices" link. */
export function openConsentChoices(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function ConsentBar() {
  // Never rendered on the server: the record is a cookie only the browser can
  // read, and guessing produces a bar that flashes for people who already
  // answered months ago.
  const [open, setOpen] = useState(false);
  const [ads, setAds] = useState(true);

  useEffect(() => {
    if (getConsent() === null) setOpen(true);
    const reopen = () => {
      setAds(getConsent()?.marketing ?? true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => {
      window.removeEventListener(OPEN_EVENT, reopen);
    };
  }, []);

  if (!open) return null;

  const decide = (state: ConsentState) => {
    setConsent(state);
    setOpen(false);
  };

  return (
    // A band across the bottom, lifted off the page. Piggles elevates with
    // shadow — a hairline on this warm palette barely separates anything.
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="bg-base-100 border-base-300 fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg sm:p-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Can we remember where you came from?</h2>
          {/* 16px, full ink. It is a question somebody has to actually read to
              answer, so it is written to be read rather than skimmed past. */}
          <p className="text-base">
            If you found us through a search, an ad or somebody else&rsquo;s website, we would like
            to remember which — so we know what is worth doing more of. It is one small file on your
            own device, it is never sold, and saying no changes nothing about how the site works.{' '}
            <Link href="/cookies" className="font-semibold underline">
              Everything we would store
            </Link>{' '}
            is listed in full.
          </p>
        </div>

        <label className="flex items-start gap-3">
          <Checkbox
            color="primary"
            checked={ads}
            onChange={(event) => {
              setAds(event.target.checked);
            }}
          />
          <span className="text-base">
            Also remember which advert I clicked, if I came from one. This is the more precise half
            — it identifies a single click rather than just the campaign — so it is a separate
            choice, and the rest works without it.
          </span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Both answers, same size, same row. The declining one is a full
              button rather than a link somebody has to hunt for — that hunt is
              the specific dishonesty this shape exists to avoid. */}
          <Button
            color="primary"
            size="lg"
            className="flex-1"
            onClick={() => {
              decide(ads ? ALL_GRANTED : { ...ALL_GRANTED, marketing: false });
            }}
          >
            Yes, that is fine
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => {
              decide(ESSENTIAL_ONLY);
            }}
          >
            No thanks
          </Button>
        </div>
      </div>
    </div>
  );
}
