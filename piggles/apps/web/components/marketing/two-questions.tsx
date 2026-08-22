'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Checkbox, Field, FieldLabel, Input } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { PigglesGroup } from '@piggles/brand';
import { accountUrl } from '@piggles/config';
import { PRICE_MONTHLY } from '@piggles/config/pricing';
import { AnswerReceipt } from './answer-receipt';
import { useCountUp } from './use-count-up';

// The real onboarding form, and the price that will not move.
//
// A row of six shaded chips sat here before: a still frame of half of one of the
// two questions the heading promises, with nothing to press. Ticking boxes has
// meant one thing everywhere else for fifteen years — the number goes up — so
// this is worth building precisely for what it does NOT do.
//
// No per-app prices, ever. Line items summing to the total would be invented figures
// that shift as boxes are ticked, which is visibly rigged. Every line says
// "Included" and only the total carries a number.

/**
 * The second question, verbatim from `apps/account/components/onboarding.tsx`.
 *
 * A copy, not an import: the account app is a different application and this one
 * may not reach into it (piggles/CLAUDE.md RULE #0). If that screen's wording
 * changes, this has drifted and the fix is to bring it back into line.
 *
 * Five and not six — `home` has no row there either, because Your day is not
 * something a person opts into. Onboarding's third question ("How should it
 * look?") reads a live catalog behind an authenticated call, so it cannot be
 * shown honestly here.
 */
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

function DoesRow({
  option,
  on,
  onToggle,
}: {
  option: (typeof OPTIONS)[number];
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li data-group={option.group}>
      {/* A label bound to a real checkbox, as onboarding does it: the whole row
          is the hit target and the space bar works with no handler of ours. */}
      <label
        htmlFor={`does-${option.group}`}
        className={`rounded-box grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-4 border p-4 transition-colors ${
          on ? 'border-module bg-module bg-soft' : 'border-base-300'
        }`}
      >
        <Checkbox
          id={`does-${option.group}`}
          color="module"
          checked={on}
          onChange={onToggle}
          className="row-span-2 mt-0.5"
        />
        <span className="text-lg font-bold">{option.label}</span>
        <span className="text-base">{option.hint}</span>
      </label>
    </li>
  );
}

export function TwoQuestionsForm() {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<PigglesGroup[]>([]);
  /** How many times the total has been worked out. Drives the verdict line. */
  const [runs, setRuns] = useState(0);
  const total = useCountUp(PRICE_MONTHLY);

  const toggle = (g: PigglesGroup) =>
    setPicked((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const addItUp = () => {
    setRuns((r) => r + 1);
    total.run();
  };

  return (
    <div className="mt-10 grid gap-3.5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
      <div className="flex flex-col gap-7">
        <Field>
          <FieldLabel className="text-xl font-black">What is your business called?</FieldLabel>
          <Input
            size="lg"
            value={name}
            maxLength={120}
            autoComplete="off"
            placeholder="Whatever is on the door"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div>
          <p className="text-xl font-black">What do you do?</p>
          <p className="mt-1 text-base">Pick any that fit. Pick none, if you would rather.</p>

          <ul className="mt-4 grid gap-2.5">
            {OPTIONS.map((o) => (
              <DoesRow
                key={o.group}
                option={o}
                on={picked.includes(o.group)}
                onToggle={() => toggle(o.group)}
              />
            ))}
          </ul>
        </div>

        {/* `mt-auto` so it sits on the floor of its column, level with the CTA
            under the panel opposite. */}
        <Button
          type="button"
          color="primary"
          size="lg"
          className="mt-auto self-start"
          onClick={addItUp}
        >
          {runs === 0 ? 'Add it up' : 'Add it up again'}
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <AnswerReceipt name={name} picked={picked} runs={runs} total={total.value} />

        {/* The action sits under the panel, where the argument lands, rather
            than in a button row at the foot of the section. */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {/* A real anchor carrying the classes, not `<Button render>`: the
              render form hands jsx-a11y an empty <a> whose text lives in a
              sibling prop. Same pattern as the CTAs in home.tsx. */}
          <a
            className={buttonClasses({ color: 'primary', size: 'xl' })}
            href={accountUrl('signup', 'home-onboarding')}
          >
            What are you waiting for
          </a>
          <Link href="/how-it-works" className="text-lg font-bold underline underline-offset-4">
            See how it works
          </Link>
        </div>
      </div>
    </div>
  );
}
