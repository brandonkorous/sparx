import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { APP_BY_ID, type PigglesAppId } from '@piggles/config';

function AppName({ app }: { app: PigglesAppId }) {
  const def = APP_BY_ID[app]!;
  return (
    <Link href={`/apps/${app}`} data-group={def.group} className="ink-module font-bold">
      {def.label}
    </Link>
  );
}

const ONCE: { act: string; then: React.ReactNode }[] = [
  {
    act: 'You type a customer’s name once.',
    then: (
      <>
        It is already in <AppName app="bookings" />, <AppName app="customers" />,{' '}
        <AppName app="invoices" /> and <AppName app="messages" />.
      </>
    ),
  },
  {
    act: 'You change a price once.',
    then: (
      <>
        <AppName app="sell" />, <AppName app="stock" /> and <AppName app="site" /> are all showing
        the new one.
      </>
    ),
  },
  {
    act: 'You write something once.',
    then: (
      <>
        <AppName app="content" /> keeps it, <AppName app="site" /> shows it,{' '}
        <AppName app="get_found" /> gets it noticed.
      </>
    ),
  },
  {
    act: 'You check one screen in the morning.',
    then: (
      <>
        <AppName app="home" /> has what <AppName app="bookings" />, <AppName app="money" /> and{' '}
        <AppName app="messages" /> did overnight.
      </>
    ),
  },
];

/** Per-row `border-t`, NOT `divide-y`: silicaui registers `border-base-300` but
 *  not `divide-base-300`, and an arbitrary `divide-[color:…]` does not compile —
 *  the dividers would silently fall back to `currentColor`.
 *
 *  The dividers separate and nothing else. The version before this drew a rule
 *  INSIDE each row as a piece of meaning, which is what made the column a
 *  diagram; the only lines left are chassis. */
function OnceList() {
  return (
    <ul className="stagger">
      {ONCE.map((o) => (
        <li
          key={o.act}
          className="border-base-300 border-t py-6 first:border-t-0 first:pt-0 last:pb-0"
        >
          {/* The gap between these two is the row's whole legibility. At one
                  step apart the claim and the consequence read as two sentences
                  of equal weight and the eye has to work out which is which;
                  `text-2xl`/`text-lg` puts the action first at a glance and the
                  places second, which is the order the row is meant to be read
                  in. */}
          <p className="font-heading text-2xl font-extrabold sm:text-[1.75rem]">{o.act}</p>
          <p className="mt-2 text-lg">{o.then}</p>
        </li>
      ))}
    </ul>
  );
}

export function TheTurn() {
  return (
    // A theme ISLAND, as close-band.tsx is. `bg-secondary` was a navy panel
    // only because `--color-secondary` happens to be dark in the LIGHT
    // theme; it is #d7dbe3 in the dark one, so with a theme toggle on the
    // site this section turned pale and took `text-primary` pink with it.
    // An island is dark in both, and the pink lands on the ground it was
    // measured against.
    <Section variant="panel" theme="dark" className="bg-base-200 shadow">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="rise">
          {/* "Stop wiring your business together" was the draft, and wiring is
              one abstraction above where the reader lives. Nobody lies awake
              thinking about integrations; they think about having just typed the
              same person's name into the fourth thing. The heading has to name
              the chore, not our word for the category of chore. */}
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Stop typing the same thing three times.
          </h2>
          {/* `text-primary`, NOT `text-accent`. This is the same dark island
              close-band.tsx measured — `accent` resolves to a dark rose here and
              lands at 2.44:1, under the 3:1 floor even at this size, so the
              loudest line in the section was the least readable one. `primary`
              measures 6.56:1 on the same ground. */}
          <p className="text-primary font-heading mt-7 text-2xl font-black sm:text-3xl lg:text-4xl">
            There is nothing here to connect.
            <br />
            It was never apart.
          </p>
          {/* Not "See how the fifteen fit together" — six words, and the two
              lines directly above already say they were never apart. A button
              that restates its own section is the section arguing twice, and at
              32 characters it was the widest label on the page. */}
          <Link className={`${buttonClasses({ color: 'primary', size: 'lg' })} mt-8`} href="/apps">
            See the fifteen
          </Link>
        </div>

        <OnceList />
      </div>
    </Section>
  );
}
