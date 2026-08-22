'use client';

import { Checkbox } from '@wizeworks/silicaui-react';
import type { PigglesGroup } from '@piggles/brand';
import { appsInGroup } from '@piggles/config';

// "What do you do" — the second and last question.
//
// The options are the colour groups, described by what a person DOES rather than
// by what the software is. Picking some is optional and picking none is fine:
// the answer only decides what starts on the rail.
//
// The list of apps under each option is shown ON PURPOSE, and the copy beside it
// says plainly that everything stays available. Somebody who does not tick
// "I sell things" must not be able to leave this screen believing they have just
// given up invoices — the fear that a choice here costs you something is exactly
// what module pricing trained everybody to expect, and this is the screen where
// Piggles either contradicts that or quietly confirms it.

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

export function Choices({
  picked,
  onToggle,
}: {
  picked: PigglesGroup[];
  onToggle: (group: PigglesGroup) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">What do you do?</h2>
      <p className="mt-1 text-base">
        Pick any that fit. This only decides what you see first — everything is included either way,
        and nothing is switched off by leaving it unticked.
      </p>

      {/* Two columns from `sm` up. Five rows in one column is a scroll for
          something that should be taken in at a glance — the whole question is
          which of these are you, which needs them side by side to compare.

          Five into two leaves a hole, and a hole beside the last option reads as
          a sixth choice that failed to load. So the last one spans the row.
          There is no sixth option to add instead: `does` is validated as a
          PigglesGroup and stored as `railGroups`, and the only group not already
          here is `home` — which is on the rail whatever anybody ticks (see
          RailPreview), so a row for it would be a checkbox that cannot change
          anything. If the option list ever becomes even, drop the span. */}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o, i) => {
          const on = picked.includes(o.group);
          const last = i === OPTIONS.length - 1;
          return (
            <li key={o.group} data-group={o.group} className={last ? 'sm:col-span-2' : ''}>
              {/* A label bound to a real checkbox: the whole row is the hit
                  target, keyboard focus and the space bar work with no handlers
                  of ours, and it is announced as a checkbox because it IS one.

                  Bound with htmlFor/id rather than by nesting alone, and the
                  three lines of text are DIRECT children of the label — a grid
                  places them in the second column beside the row-spanning
                  checkbox, rather than a wrapper span holding them. Nesting them
                  one level deeper puts the accessible name further from the label
                  than a tool will look for it, which is what jsx-a11y objects to.
                  The grid gets the same layout with the text where it belongs. */}
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
                  onChange={() => onToggle(o.group)}
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
  );
}
