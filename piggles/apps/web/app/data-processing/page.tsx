import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { brandLegal } from '@wizeworks/legal';
import { PageHero } from '@/components/marketing/page-hero';
import { DocumentFigure } from '@/components/marketing/hero/document-figure';

// /data-processing — the addendum a business customer's own compliance asks for.
//
// ── WHY THIS PAGE HAD TO EXIST ──────────────────────────────────────────────
//
// Every Piggles customer stores OTHER PEOPLE's personal data in it — their
// customers, their bookings, their mailing list. Under UK/EU data protection law
// that makes the customer the controller and WizeWorks the processor, and a
// processor relationship is only lawful if it is governed by a contract carrying
// a specific set of terms (UK GDPR Article 28(3)). Not "a privacy policy" —
// those bind us to the individual, not to our customer.
//
// The terms already carry a clause called "Your own customers' information",
// which says the right things in plain language and is not that contract: it
// does not commit to breach notification timing, to assistance with data-subject
// requests, to deletion on termination, to audit rights, or to a transfer
// mechanism. A customer's compliance team asks for those by name, and until this
// page existed the honest answer was that Piggles had none of them written down.
//
// sparx has had one at /legal/dpa since 2026-07-28. The same platform, the same
// database, the same processing — with the document available under one brand
// and not the other.
//
// ── EVERY CLAUSE IS ONE THE SOFTWARE ALREADY KEEPS ──────────────────────────
//
// The 72 hours in §6, the isolation in §5, the export in §8, the per-person
// access in §4 — each is a thing Piggles does today, not a thing it intends to.
// A clause that outruns the software is the one that turns a contract into a
// liability, so if a commitment here stops being true, this page changes with it.
//
// ── KEEPING IT TRUE ─────────────────────────────────────────────────────────
//
// The sub-processor list lives on /privacy and is deliberately NOT repeated
// here. Two copies of that list drift, and the one on /privacy is already
// grouped the way it needs to be (always vs only-if-you-connect). §7 points at
// it instead. If a sub-processor is added there, §7's notice promise applies —
// bump `subprocessors` in @wizeworks/legal so the change is dated.

const LEGAL = brandLegal('piggles');
const v = LEGAL.versions.dpa;

export const metadata: Metadata = {
  title: 'Data processing addendum',
  description:
    'How WizeWorks handles the personal data you put into Piggles on your own customers’ behalf — roles, security, sub-processors, deletion, and what happens if something goes wrong.',
};

const ENTITY = 'WizeWorks LLC';

interface Clause {
  heading: string;
  paras: string[];
}

const CLAUSES: Clause[] = [
  {
    heading: '1. Who is who',
    paras: [
      `For the information you put into Piggles about your own customers, you are the CONTROLLER and ${ENTITY} is the PROCESSOR. In plain terms: you decide what is collected and why, and we only handle it to run the software for you.`,
      'We act on your instructions. Your instructions are this addendum, the terms, and the choices you make in the software — switching on an app, connecting an outside service, sending a mailout, deleting a record.',
      'For your OWN account details — your name, your email, what you pay us — we are the controller, because that relationship is between you and us. Those are covered by the privacy page rather than by this addendum.',
    ],
  },
  {
    heading: '2. What we process, and for how long',
    paras: [
      'The subject matter is running your business in Piggles: storing your customers and orders, taking bookings, sending the messages you send, publishing the site you build, and showing all of it back to you.',
      'It lasts as long as your subscription, plus the short wind-down window described in §8.',
      'Whose data: your customers, your leads, the people who book with you, the people who fill in your forms, and anyone who contacts you through something you have connected.',
      'What data: names, contact details, addresses, order and booking history, messages and notes you record, and whatever else you choose to put in a field. Piggles does not require you to collect anything in particular — which means you control how much of this there is.',
    ],
  },
  {
    heading: '3. What we will not do with it',
    paras: [
      'We do not sell it. We do not share it with data brokers or advertisers. There is no arrangement under which it leaves us for money.',
      'We do not train AI on it — not a model of ours, not a shared assistant, not anonymised, not aggregated. Any AI feature runs on a key you connect yourself, so it goes where you agreed and nowhere else.',
      'We do not use it to build anything, and we do not look at it except where you ask us to help with a support request, or where we have to in order to keep the service running or to comply with the law.',
    ],
  },
  {
    heading: '4. The people who can see it',
    paras: [
      'Access is limited to the people at WizeWorks who need it to run the service, and it is logged. Everyone with access is under a duty of confidentiality that continues after they stop working with us.',
      'Your own team’s access is yours to control, in My Team. Somebody who only handles bookings does not have to be able to see your takings, and setting that is a few clicks rather than a support request.',
    ],
  },
  {
    heading: '5. How it is kept safe',
    paras: [
      'Every business’ information is isolated at the database level, not merely filtered by the application — the separation is enforced underneath the software, so a bug in a screen cannot reach across it.',
      'It is encrypted in transit and at rest. Passwords are stored so that they cannot be read back, including by us. Card numbers never reach us at all — they go straight to the payment provider and come back as a token.',
      'Signing in is per person, with a second factor available. Backups run continuously.',
      'These measures can change as the technology does. They will not get weaker: anything that materially reduces protection is a change we would tell you about under §7.',
    ],
  },
  {
    heading: '6. If something goes wrong',
    paras: [
      'If personal data you are responsible for is exposed, lost or accessed by somebody who should not have it, we will tell you WITHOUT UNDUE DELAY once we know — and in any case within 72 hours of becoming aware.',
      'We will tell you what happened, what information was involved, what we have done about it, and what we suggest you do. We will keep telling you as we learn more rather than waiting until we have the whole picture.',
      'The law usually puts the duty to notify a regulator or your own customers on YOU, as the controller. We will give you what you need to do that, promptly, and we will not make you chase it.',
    ],
  },
  {
    heading: '7. The other companies involved',
    paras: [
      'Running Piggles means some information reaches other companies — the people who host the servers, send the email, take the payments, and whatever you choose to connect yourself. Every one of them is named on the privacy page, in two groups: the ones always involved, and the ones that exist only because you switched them on.',
      'You authorise the ones in the first group by agreeing to this addendum. The second group you authorise by connecting them, and you can disconnect any of them at any time.',
      'If we add or change a company in the first group, we will tell you before it starts and you have the right to object. Each one is bound by terms at least as protective as this addendum, and we stay responsible to you for what they do with your information.',
    ],
  },
  {
    heading: '8. Getting it back, and getting rid of it',
    paras: [
      'You can export everything, in formats other software can actually read, whenever you want. You do not have to ask, and you do not have to be leaving.',
      'When your subscription ends we keep your information for a short window so an accidental cancellation or a late change of mind is recoverable, and then we delete it. If you want it gone sooner, say so and we will do it.',
      'Backups age out on their own cycle rather than being edited, so a deleted record can persist in a backup for a short time after it disappears from the software. It is not restored to the live service, and it goes when that backup does.',
    ],
  },
  {
    heading: '9. Helping you meet your own obligations',
    paras: [
      'When one of your customers asks to see their information, to correct it, or to be deleted, the software has the tools and you can do it yourself immediately. Where you genuinely cannot, we will help.',
      'If you need to complete a data protection impact assessment or answer a regulator, we will give you the information we hold about how Piggles processes data. We will not charge you for a reasonable request of this kind.',
    ],
  },
  {
    heading: '10. Checking that we do what we say',
    paras: [
      'You can ask us for the information you need to satisfy yourself that this addendum is being kept, and we will provide it.',
      'If that is genuinely not enough for your regulator, we will agree an audit — at a reasonable frequency, with reasonable notice, without disrupting other customers, and covering only what relates to your own information.',
    ],
  },
  {
    heading: '11. Where in the world it is',
    paras: [
      `${ENTITY} is based in the United States, and Piggles runs on infrastructure that may be located outside the UK and the European Economic Area.`,
      'Where information is transferred out of the UK or the EEA, that transfer relies on the appropriate safeguards recognised by law — currently the UK International Data Transfer Addendum and the European Commission’s Standard Contractual Clauses, which are incorporated into this addendum by reference and take precedence over anything here that conflicts with them.',
    ],
  },
  {
    heading: '12. How this fits with everything else',
    paras: [
      'This addendum forms part of the terms. Where it and the terms disagree about personal data, this addendum wins.',
      'It applies automatically from the moment you use Piggles to handle anybody else’s personal data. There is nothing to sign and nothing to request — if you need a countersigned copy for your own records, ask and we will provide one.',
      'If any part of it is found to be unenforceable, the rest still stands.',
    ],
  },
];

const slug = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export default function DataProcessingPage() {
  return (
    <>
      <PageHero
        heading="Looking after other people’s information."
        lede="Your customers’ details are yours, and we are handling them for you. This is the agreement that says exactly what that means — who decides what, how it is protected, who else is involved, and what happens if something goes wrong."
        figure={
          <DocumentFigure
            sections={`${CLAUSES.length} clauses`}
            covers="Your customers’ information"
            effective={v?.effectiveDate}
          />
        }
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-base font-bold">On this page</h2>
            <ul className="border-base-300 mt-4 space-y-2 border-l pl-4">
              {CLAUSES.map((c) => (
                <li key={c.heading}>
                  <Link href={`#${slug(c.heading)}`} className="text-base">
                    {c.heading}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Dated, because §7 promises notice of a change and a promise of
                notice needs something to measure a change against. */}
            <p className="mt-6 text-base">In effect from {v?.effectiveDate ?? '—'}</p>
          </nav>

          <div className="max-w-[75ch]">
            {CLAUSES.map((c) => (
              <section key={c.heading} id={slug(c.heading)} className="scroll-mt-28 pb-12">
                <h2 className="text-2xl font-extrabold sm:text-3xl">{c.heading}</h2>
                {c.paras.map((p) => (
                  <p key={p.slice(0, 40)} className="mt-4 text-lg">
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <div className="border-base-300 border-t pt-8">
              <p className="text-lg">
                The companies involved are named on{' '}
                <Link href="/privacy" className="font-semibold underline">
                  privacy
                </Link>
                , how it is all kept safe is on{' '}
                <Link href="/trust" className="font-semibold underline">
                  trust
                </Link>
                , and the rest of the agreement is on{' '}
                <Link href="/terms" className="font-semibold underline">
                  terms
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
