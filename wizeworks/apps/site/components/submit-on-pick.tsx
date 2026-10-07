'use client';

// The "Fits your vehicle" block submits as soon as a choice is made.
//
// Picking a make has to show the models, and picking a year has to narrow the
// list. Each tier is resolved on the server from the address, so a pick must
// submit the filter form; before this, the shopper had to find the Apply button
// at the foot of a long filter column after every pick, and nothing on screen
// changed until they did (sparx persona issue 125). Without JavaScript the
// selects still work with Apply, as before. Number boxes (a size, a weight) are
// left to Apply, so typing is never interrupted.
//
// A pick clears the tiers below it: a model chosen under Ford means nothing under
// RAM, and the server would only drop it quietly.

import type { ReactNode } from 'react';

export function SubmitOnPick({ children }: { children: ReactNode }) {
  return (
    <div
      onChange={(event) => {
        const picked = event.target;
        if (!(picked instanceof HTMLSelectElement)) return;
        const form = picked.form;
        if (!form) return;
        const tier = /^fl(\d+)$/.exec(picked.name);
        if (tier) {
          for (const field of Array.from(form.elements)) {
            if (!(field instanceof HTMLSelectElement)) continue;
            const below = /^fl(\d+)$/.exec(field.name);
            if (below && Number(below[1]) > Number(tier[1])) field.value = '';
          }
        }
        form.requestSubmit();
      }}
    >
      {children}
    </div>
  );
}
