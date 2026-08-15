import type { Metadata } from 'next';
import { requireSession } from '@sparx/auth';
import { safeInternalPath, PRODUCT } from '@piggles/config';
import { AuthShell } from '@/components/auth-shell';
import { ConsentChoice } from '@/components/consent-choice';
import { readConsent } from '@/lib/consent';

export const metadata: Metadata = { title: 'Cookie choices' };
export const dynamic = 'force-dynamic';

// getpiggles.com/cookie-choices — where the analytics question is asked, and the
// one place it can be changed.
//
// ── WHY IT LIVES ON THIS DOMAIN ─────────────────────────────────────────────
//
// A Piggles customer manages their account on getpiggles.com: what they pay,
// their details, their subscription. This is the same kind of thing, so it sits
// with them rather than in the console — which is where the tracker runs but not
// where anybody goes to deal with WizeWorks.
//
// It also cannot sit on meetpiggles.com, where the cookie POLICY is written.
// That is a third registrable domain with no session on it: it can explain the
// decision but has no way to know whose account to record it against.
//
// ── TWO JOBS, ONE SCREEN ────────────────────────────────────────────────────
//
// The first ask (sent here by /handoff, which will not open the door to the
// console without an answer) and the change-your-mind visit (from the account
// home, or the console's account menu) are the same question with the same two
// answers. Splitting them into two screens would be two things to keep true
// about one decision; the heading changes and nothing else does.
//
// ── NO SKIP, AND NO PRE-SELECTED ANSWER ─────────────────────────────────────
//
// There is no way past this without pressing one of the two buttons, and the
// page carries no default. The alternative — a dismiss, an X, an escape — is a
// third answer that has to mean something, and every available meaning is a
// decision the person did not make.

export default async function CookieChoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const next = safeInternalPath(params.next, '/account');

  const consent = await readConsent(session.user.id, session.user.tenantId);
  const first = consent === null;

  // An older record can carry an empty `at`, and `new Date('')` renders the
  // literal string "Invalid Date" — a phrase that would appear on screen inside
  // a sentence about when somebody agreed to something. No date is better than a
  // wrong one, so the sentence loses the clause rather than gaining a defect.
  const answeredOn = (() => {
    if (!consent?.at) return null;
    const d = new Date(consent.at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <AuthShell
      // `setup`, not `auth`: this is a step in getting somebody set up rather
      // than a credential screen, and `auth` would append the marketing
      // assurances band — re-arguing the case for the product underneath a
      // question about being measured, which reads as a trade.
      shape="setup"
      heading={first ? 'One thing before you go in.' : 'Cookie choices'}
      lede={
        first
          ? `May we see which screens you use inside ${PRODUCT.name}? It is the only optional thing we run, and it is how we find out what is confusing.`
          : `You told us ${consent.analytics ? 'yes' : 'no'}${answeredOn ? ` on ${answeredOn}` : ''}. Change it here whenever you like.`
      }
    >
      <div className="mt-6 flex flex-col gap-4 text-base">
        {/* What it IS and what it is NOT, in the order a suspicious person asks
            them. Not a wall of policy — the policy is one link away and this is
            the honest short version, which is the version that gets read. */}
        <p>
          It counts screens and records what broke: this pane was opened, that save failed. It runs
          inside your workspace at {PRODUCT.hosts.console} and nowhere else.
        </p>
        <p>
          It is <span className="font-bold">never</span> advertising, it is{' '}
          <span className="font-bold">never</span> sold or passed to anybody, and it{' '}
          <span className="font-bold">never</span> reads what you have stored — not your customers,
          your orders, your money or your files.
        </p>
      </div>

      <ConsentChoice next={next} current={consent === null ? null : consent.analytics} />
    </AuthShell>
  );
}
