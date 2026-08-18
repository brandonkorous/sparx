import { Heading, Text } from '@wizeworks/silicaui-react';
import { Band } from '../band';

/**
 * What you get to work with — the "resources teaser" docs/114 §B.6 lists for
 * this page and which the built version simply never included. It mattered:
 * every reference to resources was a subordinate clause ("grab the pitch deck
 * and proposal templates"), so the page never answered the practical question an
 * agency asks second, right after the money — do I have to build all the
 * collateral myself?
 */

const RESOURCES: { t: string; d: string }[] = [
  {
    t: 'Every client in one login',
    d: 'Your own dashboard lists every client account you have access to, and you move between them without signing out. The client invites you and can revoke it whenever they like — you never hold their password.',
  },
  {
    t: 'The pitch, already written',
    d: 'Decks, proposal templates and the cost comparison against the stack you are replacing. You are welcome to rewrite all of it; you should not have to write it first.',
  },
  {
    t: 'A referral link that tracks itself',
    d: 'Attribution runs for 30 days from the click, and your rate is snapshotted when the client is credited. Nothing to reconcile at the end of the month.',
  },
  {
    t: 'Bootcamps as a lead source',
    d: 'Run a session on getting a business online. Everyone who registers lands in your own CRM as a lead, and Certified partners get theirs listed publicly on sparx.works.',
  },
];

export function PartnersResources() {
  return (
    <Band tone="surface">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            You are not starting from a blank page
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="max-w-3xl">
            The program is not a link and a rate card. Here is what is waiting the day you are
            approved.
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {RESOURCES.map((r) => (
            <div
              key={r.t}
              className="border-base-300 bg-base-200 flex flex-col gap-2.5 rounded-4xl border p-8"
            >
              <Heading level={3} size={4} className="tracking-tight">
                {r.t}
              </Heading>
              <Text className="text-lg">{r.d}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}
