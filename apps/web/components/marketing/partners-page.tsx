import { Section, SectionHeader, Spark } from './primitives';
import { Faq, type FaqItem } from './faq';
import { PartnerTiers } from './partners-tiers';
import { PartnersApplyForm } from './partners-apply-form';
import {
  PartnersDirectoryCta,
  PartnersFinalCta,
  PartnersHero,
  PartnersOpportunity,
  PartnersProof,
  PartnersSteps,
} from './partners-sections';

/**
 * The /partners marketing page — the Partner Program recruit surface, told as a
 * confident, left-aligned earnings ledger and carried by platform indigo. Held
 * to the bespoke /ai + /builder bar. Section devices vary down the page: tinted
 * hero → stat proof strip → argument ledger → numbered rail → tier comparison
 * matrix → directory-CTA split → self-serve apply split → FAQ → dark final CTA.
 * `partnerCount` (from the public directory total) drives the empty-safe proof
 * strip; omit it and the strip shows a "founding partner" invite instead.
 */
export function PartnersPage({ partnerCount }: { partnerCount?: number }) {
  return (
    <>
      <PartnersHero />
      <PartnersProof partnerCount={partnerCount} />
      <PartnersOpportunity />
      <PartnersSteps />
      <PartnersTiersSection />
      <PartnersDirectoryCta />
      <PartnersApply />
      <Faq
        id="faq"
        items={PARTNER_FAQ}
        accent="var(--color-primary)"
        heading={
          <>
            Partner questions
            <Spark />
          </>
        }
        lede="Commissions, referral tracking, tiers, and payouts — the specifics before you apply."
      />
      <PartnersFinalCta />
    </>
  );
}

const SANS = 'var(--font-sans)';
const INDIGO_TINT = 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))';
const INDIGO_TEXT = 'var(--color-primary)';

function PartnersTiersSection() {
  return (
    <Section padding="lg">
      <SectionHeader
        accent="var(--color-primary)"
        headline={<>Three tiers. You choose the pace</>}
        lede="Start informal in a click, or apply for more. Every tier lists in the directory and earns on referrals — the higher tiers just earn more and unlock more."
      />
      <PartnerTiers />
    </Section>
  );
}

// ── SELF-SERVE APPLY · split ────────────────────────────────────────────────
function PartnersApply() {
  const what = [
    {
      n: '01',
      t: 'Informal auto-approves',
      d: "Pick Informal and you're in immediately — start referring today.",
    },
    {
      n: '02',
      t: 'Registered & Certified are reviewed',
      d: "A quick look at your work. We'll be in touch within 3 business days.",
    },
    {
      n: '03',
      t: 'No account needed to apply',
      d: "Already run a sparx site? We link it. New? We'll set you up on approval.",
    },
  ];
  return (
    <Section
      id="apply"
      surface="page"
      padding="lg"
      style={{ borderTop: '1px solid var(--color-base-300)' }}
    >
      <div className="mkt-apply-grid">
        <div>
          <SectionHeader
            accent="var(--color-primary)"
            headline={<>Apply in two minutes</>}
            lede="This isn't a job application. Tell us who you are and how you'll use sparx with clients."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '32px' }}>
            {what.map((w) => (
              <div key={w.n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    borderRadius: '8px',
                    backgroundColor: INDIGO_TINT,
                    color: INDIGO_TEXT,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {w.n}
                </span>
                <div>
                  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: '15px' }}>{w.t}</div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: '14px',
                      lineHeight: '21px',
                      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                      marginTop: '3px',
                    }}
                  >
                    {w.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '18px',
            padding: 'clamp(24px, 3vw, 34px)',
            boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
          }}
        >
          <PartnersApplyForm />
        </div>
      </div>
    </Section>
  );
}

// Partner-specific FAQ (docs/114 §B.3/§B.4 + partners-spec §6/§7). Grounded in the
// shipped rules: Stripe Connect payouts, 30-day attribution, snapshot rates, the
// tier ladder. Emitted as FAQPage JSON-LD by <Faq> for answer-engine extraction.
const PARTNER_FAQ: FaqItem[] = [
  {
    id: 'p-commission',
    question: 'How does commission get paid?',
    answer:
      'Commissions are calculated on net revenue after fees and paid out monthly via Stripe Connect once you clear the $50 minimum. Informal earns 20% of a referred client’s first payment, Registered earns 30%, and Certified earns 30% plus 5% ongoing on managed accounts for as long as the client stays.',
  },
  {
    id: 'p-tracking',
    question: 'How are my referrals tracked?',
    answer:
      'Your referral link carries a code captured in a first-party cookie for 30 days. When someone signs up inside that window, they’re credited to you — and your commission rate is snapshotted at that moment, so a later rate change never rewrites your history. There’s no retroactive attribution: a signup with no referral code credits no partner.',
  },
  {
    id: 'p-account',
    question: 'Do I need my own sparx account to apply?',
    answer:
      'No. You can apply first. Informal partners are approved instantly and prompted to create an account to activate the referral link; if you already run a sparx site, we link the partner record to it. Registered and Certified applications are reviewed before activation.',
  },
  {
    id: 'p-tiers',
    question: 'What’s the difference between the three tiers?',
    answer:
      'Informal needs no application — sign up and refer at 20%. Registered is a brief review, earns 30%, adds a priority support channel, and can host unpublished bootcamps. Certified requires certification, earns 30% plus 5% ongoing, gets a dedicated partner manager, sits at the top of the directory, publishes bootcamps publicly, and gets co-marketing and early access to new modules.',
  },
  {
    id: 'p-bootcamps',
    question: 'Can I host bootcamps?',
    answer:
      'Registered partners can create bootcamp listings but keep them unpublished; Certified partners can publish bootcamps publicly on sparx.works/bootcamp, appear higher in the directory, and carry the Certified badge. Hosting a bootcamp is one of the strongest ways to bring new businesses onto the platform under your referral.',
  },
  {
    id: 'p-churn',
    question: 'What happens if a referred client cancels?',
    answer:
      'A first-payment commission is forfeited only if the client churns before that first payment clears. Once it clears, it’s yours. Ongoing commissions (Certified, on managed accounts) simply stop if the client churns or removes managed-account status — nothing is clawed back.',
  },
];
