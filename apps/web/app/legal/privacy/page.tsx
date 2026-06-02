import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Privacy policy — Sparx',
  description: 'How Sparx collects, uses, and protects personal information.',
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
          How WizeWorks handles personal information across the Sparx platform — both the data we
          collect about our own customers and the data we process on their behalf.
        </>
      }
    >
      <LegalSection heading="1. Two roles, two relationships">
        <LegalP>
          Sparx serves two kinds of people, and our role differs for each. When you sign up for
          Sparx as a merchant or publisher, we are the <strong>data controller</strong> for your
          account information. When your customers interact with a store or site you run on Sparx,
          you are the controller of their personal data and we act as your{' '}
          <strong>data processor</strong> — see the{' '}
          <a href="/legal/dpa">Data Processing Addendum</a>. This policy describes the first
          relationship.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <LegalList
          items={[
            'Account data — name, email, organization, and role of the staff users on your tenant.',
            'Billing data — subscription plan and payment metadata (card details are held by our payment processor, not by us).',
            'Usage data — how you interact with the dashboard and APIs, used to operate, secure, and improve the Service.',
            'Support data — the contents of messages you send us.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. How we use it">
        <LegalP>
          We use this information to provide and secure the Service, process payments, communicate
          with you about your account, provide support, comply with legal obligations, and improve
          the platform. We do not sell your personal information.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. Subprocessors & infrastructure">
        <LegalP>
          We host the Service on Google Cloud and rely on a small set of subprocessors to operate it
          — including a payment processor for billing and an email provider for transactional and
          account email. Each is bound by contractual data-protection obligations. A current list of
          subprocessors is available on request.
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

      <LegalSection heading="8. Cookies">
        <LegalP>
          Our marketing site and dashboard use strictly-necessary cookies for authentication and
          functional cookies for preferences such as theme. Where we use analytics, we do so in a
          privacy-respecting way. Stores and sites run by our customers manage their own cookie
          disclosures and consent on their storefronts.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. International transfers">
        <LegalP>
          We may process information in countries other than your own. Where required, we rely on
          appropriate safeguards (such as standard contractual clauses) for cross-border transfers.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. Changes & contact">
        <LegalP>
          We will post updates to this policy here with a new version and effective date and notify
          you of material changes. Questions? Email{' '}
          <a href="mailto:privacy@sparx.works">privacy@sparx.works</a>.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
