'use client';

// "Change your answer", on the page that explains what the answer means.
//
// The footer already sends people to /cookies, so the control belongs at the top
// of that page rather than as a second footer link: somebody who wants to change
// their mind should read what they are changing first, and a link that opens a
// bar without the explanation is how consent UI ends up being clicked blind.
//
// It also states the CURRENT answer, because "change your cookie settings" with
// no indication of what they currently are is a control nobody can use
// confidently.

import { useEffect, useState } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { getConsent, type ConsentState } from '../lib/consent';
import { openConsentChoices } from './consent-bar';

export function ConsentChange() {
  // `undefined` until mounted — the record is a cookie, so the server cannot
  // know it, and rendering a guess would tell some people the wrong thing about
  // their own privacy for one frame.
  const [state, setState] = useState<ConsentState | null | undefined>(undefined);

  useEffect(() => {
    setState(getConsent());
    const onChange = () => {
      setState(getConsent());
    };
    window.addEventListener('piggles:consent', onChange);
    return () => {
      window.removeEventListener('piggles:consent', onChange);
    };
  }, []);

  return (
    <div className="border-base-300 bg-base-100 flex flex-wrap items-center gap-3 rounded-xl border p-4">
      {/* Three answers, three colors. A single grey pill for all of them would
          make "you have not been asked" look like "you said no". */}
      {state === undefined ? null : state === null ? (
        <Badge color="warning" variant="soft" size="lg">
          Not answered yet
        </Badge>
      ) : (
        <Badge color={state.analytics ? 'success' : 'info'} variant="soft" size="lg">
          {state.analytics
            ? state.marketing
              ? 'Remembering where you came from, adverts included'
              : 'Remembering where you came from'
            : 'Remembering nothing'}
        </Badge>
      )}
      <span className="flex-1" />
      <Button color="primary" variant="soft" onClick={openConsentChoices}>
        {state === null ? 'Answer it' : 'Change this'}
      </Button>
    </div>
  );
}
