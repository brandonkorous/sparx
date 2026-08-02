import { Heading, Text } from '@wizeworks/silicaui-react';
import { Band } from '../band';
import { PartnersApplyForm } from '../partners-apply-form';

/**
 * The apply split — copy left, form right.
 *
 * Two things changed besides the shell. The `01 / 02 / 03` mono chips beside
 * each point are gone: a numbered marker introducing a heading is the eyebrow
 * slot however it is dressed, and nothing about these three facts is ordered
 * anyway — they are three answers, not three steps. And the form panel dropped
 * its `shadow-lg`; it separates from the page band by edge and surface, which is
 * how every other panel on the site does it.
 */

const ANSWERS: { t: string; d: string }[] = [
  {
    t: 'You do not need a sparx account first',
    d: 'Apply now, sort the account out after. Already run a sparx site? We link the partner record to it.',
  },
  {
    t: 'Every application is read by a person',
    d: 'Including Informal. It is a quick look at who you are and how you work, not an interview — and you hear back within three business days.',
  },
  {
    t: 'You are not locked into the tier you pick',
    d: 'Start Informal and certify later; the higher rate applies to everything you refer from then on. Nothing you have already earned changes.',
  },
];

export function PartnersApply() {
  return (
    <Band id="apply" tone="surface">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
              Apply in two minutes
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="max-w-xl">
              This is not a job application. Tell us who you are and how you would put sparx in
              front of clients.
            </Text>
          </div>

          <div className="flex flex-col gap-6">
            {ANSWERS.map((a) => (
              <div key={a.t} className="flex flex-col gap-1.5">
                <Heading level={3} size={5} className="tracking-tight">
                  {a.t}
                </Heading>
                <Text className="text-lg">{a.d}</Text>
              </div>
            ))}
          </div>
        </div>

        <div className="border-base-300 bg-base-200 rounded-4xl border p-8">
          <PartnersApplyForm />
        </div>
      </div>
    </Band>
  );
}
