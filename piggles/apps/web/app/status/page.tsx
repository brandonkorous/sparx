import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { PageHero } from '@/components/marketing/page-hero';

// /status — the page /trust promises in writing.
//
// ── IT DOES A REAL CHECK ────────────────────────────────────────────────────
//
// Every row is the result of an actual request made when the page was rendered,
// not a value somebody types into a CMS after an incident. `force-dynamic` and
// `no-store` because a cached status page is a page that says everything is fine
// during an outage — which is worse than having none, since the whole point is
// that it can be trusted when the rest cannot.
//
// ── WHAT IT DOES NOT CLAIM ──────────────────────────────────────────────────
//
// No uptime percentage, and there will not be one until it is genuinely being
// measured — the platform rule about never presenting absence as measurement,
// and the commitment /trust already makes by refusing to publish a figure.
//
// The checks hit LIVENESS endpoints, which prove the process is answering and
// nothing more. That distinction is stated on the page rather than buried here:
// a green row means "this answered just now", not "every feature works". Saying
// otherwise would make this page the most confidently wrong thing on the site
// during a partial outage.
//
// A history section says "nothing recorded" rather than showing an empty list
// under a heading, because an empty incident list reads as a claim of a clean
// record. There has not been a clean record; there has not been a record.
//
// ── WHEN THE REAL THING ARRIVES ─────────────────────────────────────────────
//
// This is a live check, not a monitoring system: it knows what is true at the
// moment somebody loads it, and nothing about five minutes ago. When external
// monitoring exists, this page reads from it and gains history and response
// times. Until then it is honest about being a spot check, which is the only
// thing it can honestly be.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Status',
  description:
    'Whether each part of Piggles is answering right now, checked when you loaded this page. No uptime percentage, because we are not yet measuring one.',
};

interface Surface {
  name: string;
  what: string;
  host: string;
  base: string;
}

/** Where to actually send the check.
 *
 *  An explicit env var always wins, so a preview environment can point at
 *  itself. Otherwise: the real hosts in production, and the local ports in
 *  development.
 *
 *  The dev fallback is not a convenience — it is what makes this page TESTABLE.
 *  Pointed at meetpiggles.com from a laptop it reports all three surfaces down,
 *  every time, which looks exactly like a working page reporting a real outage.
 *  A status page whose only local behaviour is a false alarm is one nobody can
 *  tell apart from a broken one. */
const devPort = (port: number) => `http://localhost:${port}`;
const live = process.env.NODE_ENV === 'production';

const SURFACES: Surface[] = [
  {
    name: 'This site',
    what: `Reading about Piggles, and everything on ${PRODUCT.hosts.marketing}.`,
    host: PRODUCT.hosts.marketing,
    base:
      process.env.STATUS_WEB_URL ?? (live ? `https://${PRODUCT.hosts.marketing}` : devPort(3020)),
  },
  {
    name: 'Signing up and signing in',
    what: 'Creating an account, signing in, and everything to do with what you pay us.',
    host: PRODUCT.hosts.account,
    base:
      process.env.STATUS_ACCOUNT_URL ?? (live ? `https://${PRODUCT.hosts.account}` : devPort(3021)),
  },
  {
    name: 'The workspace',
    what: 'The place you do the work — customers, bookings, invoices, stock and your site.',
    host: PRODUCT.hosts.console,
    base:
      process.env.STATUS_CONSOLE_URL ?? (live ? `https://${PRODUCT.hosts.console}` : devPort(3022)),
  },
];

type State = 'answering' | 'not-answering' | 'unknown';

interface Result {
  surface: Surface;
  state: State;
}

/** One check. Short timeout on purpose: a status page that hangs waiting for a
 *  sick service is a status page nobody can load during the outage it exists
 *  for. Any failure — refused, timed out, non-2xx — is reported as not
 *  answering, because from a customer's side those are the same thing. */
async function check(surface: Surface): Promise<Result> {
  try {
    const response = await fetch(`${surface.base}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
      headers: { accept: 'application/json' },
    });
    return { surface, state: response.ok ? 'answering' : 'not-answering' };
  } catch {
    return { surface, state: 'not-answering' };
  }
}

const LABEL: Record<State, string> = {
  answering: 'Answering',
  'not-answering': 'Not answering',
  unknown: 'Not checked',
};

const TONE: Record<State, 'success' | 'danger' | 'neutral'> = {
  answering: 'success',
  'not-answering': 'danger',
  unknown: 'neutral',
};

export default async function StatusPage() {
  const results = await Promise.all(SURFACES.map(check));
  const checkedAt = new Date();
  const allWell = results.every((r) => r.state === 'answering');
  const anyDown = results.some((r) => r.state === 'not-answering');

  return (
    <>
      <PageHero
        heading={
          allWell
            ? 'Everything is answering.'
            : anyDown
              ? 'Something is not answering.'
              : 'Here is what is running.'
        }
        lede={`Checked when you loaded this page, at ${checkedAt.toUTCString()}. Reload it for a fresh answer — nothing on this page is cached.`}
      />

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <ul className="grid gap-4">
            {results.map(({ surface, state }) => (
              <li
                key={surface.name}
                className="bg-base-100 border-base-300 rounded-box flex flex-wrap items-center justify-between gap-4 border p-6 sm:p-8"
              >
                <div>
                  <h2 className="text-xl font-extrabold sm:text-2xl">{surface.name}</h2>
                  <p className="mt-1.5 max-w-[60ch] text-base">{surface.what}</p>
                  <p className="mt-1 text-base font-semibold">{surface.host}</p>
                </div>
                <Badge color={TONE[state]} variant="soft" size="lg">
                  {LABEL[state]}
                </Badge>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">What a green row means</h2>
              <p className="mt-4 max-w-[60ch] text-lg">
                That this part of Piggles answered a moment ago. It does not promise that every
                feature inside it is working — a service can answer while one thing in it is broken.
                If something is wrong for you and this page looks fine, that is worth telling us
                rather than doubting.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">Why there is no percentage</h2>
              <p className="mt-4 max-w-[60ch] text-lg">
                Because nobody is measuring one yet. A number nobody measures is a decoration rather
                than a commitment, and we would rather show you a live check we can stand behind
                than a figure we cannot. When it is genuinely measured, it appears here.
              </p>
            </div>
          </div>

          <div className="border-base-300 mt-14 border-t pt-8">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Past incidents</h2>
            {/* "Nothing recorded" and not an empty list under a heading. An
                empty list reads as a clean record; there has not been a clean
                record, there has not been a record. */}
            <p className="mt-4 max-w-[70ch] text-lg">
              Nothing recorded yet — and that means exactly what it says, which is that we have not
              been keeping an incident history rather than that nothing has ever gone wrong. From
              the day {PRODUCT.name} opens to the public, anything that affects your business or
              your customers is written up here, in plain language, with what happened and what we
              did about it.
            </p>
            <p className="mt-6 text-lg">
              What we promise about keeping it running is in the{' '}
              <Link href="/terms" className="font-semibold underline">
                terms
              </Link>
              , and how your information is kept safe is on{' '}
              <Link href="/trust" className="font-semibold underline">
                trust
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
