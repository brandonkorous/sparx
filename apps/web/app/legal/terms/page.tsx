import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Terms of service — Sparx',
  description: 'The legal terms governing your use of the Sparx platform.',
  alternates: { canonical: '/legal/terms' },
};

const v = LEGAL_DOC_VERSIONS.terms;

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of service"
      version={v.version}
      effectiveDate={v.effectiveDate}
      intro={
        <>
          These terms govern your access to and use of Sparx, the modular content and commerce
          platform operated by WizeWorks. By creating an account you agree to them.
        </>
      }
    >
      <LegalSection heading="1. Agreement">
        <LegalP>
          These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you (the
          &ldquo;Customer,&rdquo; &ldquo;you&rdquo;) and WizeWorks (&ldquo;Sparx,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;) governing your use of the Sparx platform, dashboards,
          APIs, and related services (the &ldquo;Service&rdquo;). By signing up for, accessing, or
          using the Service you accept these Terms. If you are agreeing on behalf of an
          organization, you represent that you have authority to bind that organization.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <LegalP>
          You are responsible for the activity that occurs under your account and for keeping your
          credentials secure. Each Sparx tenant maps to a single organization; you may invite
          additional staff users and assign them roles. You must provide accurate registration
          information and keep it current.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. The Service & modules">
        <LegalP>
          Sparx is modular. You activate only the modules you use — builder, commerce, CRM, CMS,
          email, B2B/wholesale, dropship, and AI/MCP integration — and your subscription reflects
          that selection. We may add, change, or deprecate features over time; we will give
          reasonable notice of material changes that reduce core functionality you rely on.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. Fees & billing">
        <LegalP>
          Paid plans are billed in advance on a recurring basis through our payment processor. Fees
          are non-refundable except where required by law or expressly stated in these Terms. You
          authorize us to charge your payment method for all fees incurred. If a charge fails, we
          may suspend paid functionality until payment is resolved. Taxes are your responsibility
          unless we are required to collect them.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. Your content & data">
        <LegalP>
          You retain all rights to the content, products, customer records, and other data you or
          your end users submit to the Service (&ldquo;Customer Data&rdquo;). You grant us a limited
          license to host, process, and transmit Customer Data solely to provide and support the
          Service. With respect to personal data within Customer Data, you are the data controller
          and we are the data processor — see the <a href="/legal/dpa">Data Processing Addendum</a>{' '}
          and our <a href="/legal/privacy">Privacy Policy</a>.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Acceptable use">
        <LegalP>
          Your use of the Service must comply with our{' '}
          <a href="/legal/aup">Acceptable Use Policy</a>. We may suspend or remove content or access
          that violates it, that creates security or legal risk, or that is required by law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. Third-party services">
        <LegalP>
          The Service integrates with third parties you choose to connect — including payment
          processors, shipping and tax providers, and email delivery. Your use of those services is
          governed by their own terms, and we are not responsible for their acts or omissions.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Intellectual property">
        <LegalP>
          The Service, including its software, design, and documentation, is owned by WizeWorks and
          its licensors and is protected by intellectual-property laws. These Terms grant you no
          rights in the Service except the limited right to use it as permitted here.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Suspension & termination">
        <LegalP>
          You may cancel at any time from your dashboard. We may suspend or terminate access for
          material breach of these Terms, non-payment, or to comply with law. On termination, your
          right to use the Service ends; we will make Customer Data available for export for a
          reasonable period before deletion, as described in the DPA.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. Warranties & disclaimers">
        <LegalP>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the fullest
          extent permitted by law, we disclaim all implied warranties, including merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant that the Service
          will be uninterrupted or error-free.
        </LegalP>
      </LegalSection>

      <LegalSection heading="11. Limitation of liability">
        <LegalP>
          To the fullest extent permitted by law, neither party will be liable for indirect,
          incidental, special, consequential, or punitive damages, and our aggregate liability
          arising out of or relating to the Service will not exceed the fees you paid us in the
          twelve months preceding the event giving rise to the claim.
        </LegalP>
      </LegalSection>

      <LegalSection heading="12. Changes to these Terms">
        <LegalP>
          We may update these Terms from time to time. When we make a material change we will notify
          you and, where appropriate, ask you to re-accept. The version and effective date at the
          top of this page always reflect the current Terms. Material updates require:
        </LegalP>
        <LegalList
          items={[
            'Notice to the account owner before the change takes effect, and',
            'Re-acceptance on next sign-in for changes we designate as material.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="13. Contact">
        <LegalP>
          Questions about these Terms? Email{' '}
          <a href="mailto:legal@sparx.works">legal@sparx.works</a>.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
