import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Privacy policy — sparx',
  description: 'How sparx collects, uses, and protects personal information.',
  alternates: { canonical: '/legal/privacy' },
};

const v = LEGAL_DOC_VERSIONS.privacy;

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy policy"
      version={v.version}
      effectiveDate={v.effectiveDate}
      intro={
        <>
          How WizeWorks handles personal information across the sparx platform — both the data we
          collect about our own customers and the data we process on their behalf.
        </>
      }
    >
      <LegalSection heading="1. Two roles, two relationships">
        <LegalP>
          sparx serves two kinds of people, and our role differs for each. When you sign up for
          sparx as a merchant or publisher, we are the <strong>data controller</strong> for your
          account information. When your customers interact with a store or site you run on sparx,
          you are the controller of their personal data and we act as your{' '}
          <strong>data processor</strong> — see the{' '}
          <a href="/legal/dpa">Data Processing Addendum</a>. This policy covers the first
          relationship — plus everyone else who deals with WizeWorks directly, such as job and
          partner applicants, for whom we are also the controller.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <LegalP>From the businesses that use sparx:</LegalP>
        <LegalList
          items={[
            'Account data — name, email, organization, and role of the staff users on your tenant.',
            'Billing data — subscription plan and payment metadata (card details are held by our payment processor, not by us).',
            'Usage data — how you interact with the dashboard and APIs, used to operate, secure, and improve the Service.',
            'Support data — the contents of messages you send us.',
            'Agreement records — when you accept these terms or any of our other legal documents, we record which version you accepted, when, and the IP address and browser the acceptance came from. That record is the evidence the agreement was made, and we keep it for as long as the agreement matters.',
            'Security records — sign-in events, and the details of any passkey or second factor you register. We store only the public half of a passkey; the private half never leaves your device and we never see it.',
          ]}
        />
        <LegalP>From other people who deal with WizeWorks directly:</LegalP>
        <LegalList
          items={[
            'Job applicants — if you apply for a role, we collect your name, email, phone, any links you share, what you write in the application, and your résumé. Résumés are stored privately and are never publicly readable.',
            'Partner applicants — if you apply to the partner program, we collect your application details and, once you are accepted, the referral and commission records needed to pay you.',
            'Event registrations — if you sign up for a bootcamp or a similar session, we collect what you give us to register you.',
            'Anyone who contacts us — what you send, and what we need to reply to it.',
          ]}
        />
        <LegalP>
          The personal data of <em>your</em> customers is a different matter entirely. We handle
          that for you rather than for ourselves, and the{' '}
          <a href="/legal/dpa">Data Processing Addendum</a> governs it.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. How we use it">
        <LegalP>
          We use this information to provide and secure the Service, process payments, communicate
          with you about your account, provide support, assess applications, comply with legal
          obligations, and improve the platform. We do not sell your personal information, and we do
          not use it to train AI models.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. Subprocessors & infrastructure">
        <LegalP>
          We host the Service on Google Cloud and rely on a small number of other companies to
          operate it — for email delivery, text messages, payments, domain registration, and product
          analytics. Each is bound by contractual data-protection obligations. Every one of them is
          named, along with what it does and what data it handles, on our{' '}
          <a href="/legal/subprocessors">subprocessor list</a>.
        </LegalP>
        <LegalP>
          sparx runs no AI on an account of its own. Every AI feature works on a key you supply or
          an AI tool you connect yourself, so your data is never sent to an AI provider on our
          credential.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. How we protect it">
        <LegalP>
          Data is encrypted in transit (TLS) and at rest. The platform enforces tenant isolation at
          the database level, personal information is excluded from application logs and masked in
          error reporting, and access is restricted to personnel who need it. See our{' '}
          <a href="/security">security overview</a> for more.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Retention">
        <LegalP>
          We keep account information for as long as your account is active and for a reasonable
          period afterward to meet legal, accounting, and dispute-resolution needs. You can request
          deletion as described below.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. Your rights">
        <LegalP>
          Depending on where you live, you may have the right to access, correct, export, or delete
          your personal information, and to object to or restrict certain processing. To exercise
          these rights, contact us at <a href="mailto:privacy@sparx.works">privacy@sparx.works</a>.
          We respond to verified requests within the timeframes required by applicable law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Cookies & consent">
        <LegalP>
          On our own marketing site and dashboard, cookies fall into four groups, and{' '}
          <strong>nothing beyond the first group runs until you say yes</strong>. There is no
          pre-ticked box and no &ldquo;by continuing to browse you agree&rdquo; — if you have not
          made a choice, only the strictly-necessary cookies are set.
        </LegalP>
        <LegalList
          items={[
            'Strictly necessary — keeping you signed in, security, and remembering the cookie choice itself. These cannot be turned off, because without them the site does not work.',
            'Preferences — remembering settings such as light or dark theme.',
            'Analytics — our product analytics, so we can see which features get used. Off until you accept.',
            'Marketing — the identifiers advertising platforms attach to a click, so we can tell which campaigns actually work. Off until you accept.',
          ]}
        />
        <LegalP>
          We also set first-party cookies that record how you first arrived at sparx and how you
          arrived most recently — which search, link, or campaign sent you — and, if you followed a
          partner&rsquo;s referral link, a code identifying that partner for thirty days so they get
          credit for the introduction. These are ours alone; they are not shared with advertising
          networks, and they are readable only across sparx&rsquo;s own domains.
        </LegalP>
        <LegalP>
          You can change your mind at any time from the cookie preferences link in the footer of
          every page.
        </LegalP>
        <LegalP>
          Sites and stores run by our customers are separate. Each of those businesses is
          responsible for its own cookie notice and its own consent, and sparx gives them the same
          four-category consent tool to do it with. On those sites we count visits for the business
          that owns them using a rotating, salted identifier rather than storing IP addresses —
          enough to tell one visit from another, not enough to build a profile of a person.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Where your data is held, and international transfers">
        <LegalP>
          sparx runs in Google Cloud&rsquo;s central United States region, and that is where your
          data is stored. If you or your customers are outside the United States, using sparx
          involves a transfer of personal data to the United States. Where the law requires it, we
          rely on appropriate safeguards — including the European Commission&rsquo;s standard
          contractual clauses — to make that transfer lawful.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. Requests from government and law enforcement">
        <LegalP>
          We do not hand over personal data because an authority asked. Every demand is checked
          against a written policy first: we confirm it is a genuine legal instrument that reaches
          us, we disclose only the narrowest set of records it actually compels, we object to
          requests that are unlawful or overbroad, and we record every request — including the ones
          we refuse. Where the data belongs to one of our customers, we tell them a request has
          arrived so they can object themselves, unless a court order or statute forbids us from
          saying so.
        </LegalP>
      </LegalSection>

      <LegalSection heading="11. Changes & contact">
        <LegalP>
          We will post updates to this policy here with a new version and effective date and notify
          you of material changes. Questions? Email{' '}
          <a href="mailto:privacy@sparx.works">privacy@sparx.works</a>.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
