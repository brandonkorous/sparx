import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Acceptable use policy — Sparx',
  description: 'The conduct and content rules that apply to everyone who uses Sparx.',
  alternates: { canonical: '/legal/aup' },
};

const v = LEGAL_DOC_VERSIONS.aup;

export default function AupPage() {
  return (
    <LegalDoc
      title="Acceptable use policy"
      version={v.version}
      effectiveDate={v.effectiveDate}
      intro={
        <>
          The conduct and content rules that apply to everyone who uses Sparx. This policy is part
          of the Terms of Service; violating it can lead to suspension or termination.
        </>
      }
    >
      <LegalSection heading="1. Purpose">
        <LegalP>
          Sparx is a platform for content and commerce of every kind. This policy keeps it safe,
          lawful, and reliable for everyone. It applies to your tenant, your staff users, and the
          stores, sites, and communications you operate on Sparx.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Prohibited content & conduct">
        <LegalP>You may not use Sparx to create, store, sell, or distribute:</LegalP>
        <LegalList
          items={[
            'Anything illegal under applicable law, or content that infringes others’ intellectual-property or privacy rights.',
            'Fraudulent, deceptive, or misleading offers, including payment fraud and counterfeit goods.',
            'Malware, phishing, or anything designed to compromise systems or data.',
            'Content that exploits minors, incites violence, or promotes hatred or harassment.',
            'Regulated or restricted goods you are not licensed to sell, and items prohibited by our payment or shipping partners (e.g. weapons, certain controlled substances).',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Platform integrity">
        <LegalP>You also may not:</LegalP>
        <LegalList
          items={[
            'Probe, scan, or test the vulnerability of the Service without authorization, or circumvent its security or tenant isolation.',
            'Interfere with or disrupt the Service, including via excessive automated requests outside published API limits.',
            'Resell or provide the Service to third parties except as expressly permitted.',
            'Misrepresent your identity or your affiliation with any person or organization.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Email & messaging">
        <LegalP>
          Outbound email and messaging you send through Sparx must comply with anti-spam laws (such
          as CAN-SPAM and GDPR). You must have a lawful basis to contact recipients, honor
          unsubscribe requests promptly, and not send unsolicited bulk messages. We include
          one-click unsubscribe in marketing email and may suspend sending that generates abuse
          complaints.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. Enforcement">
        <LegalP>
          We may investigate suspected violations and may remove content, throttle or suspend
          functionality, or terminate accounts that violate this policy — with notice where
          practical, and immediately where there is risk of harm, legal exposure, or abuse. We
          cooperate with lawful requests from authorities.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Reporting & contact">
        <LegalP>
          To report a violation or ask whether a use case is permitted, email{' '}
          <a href="mailto:abuse@sparx.works">abuse@sparx.works</a>. We update this policy as the
          platform and the legal landscape evolve; the version and effective date above always
          reflect the current policy.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
