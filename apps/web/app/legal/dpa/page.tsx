import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Data processing addendum — Sparx',
  description:
    'The GDPR/CCPA data processing addendum governing how Sparx processes personal data on your behalf.',
  alternates: { canonical: '/legal/dpa' },
};

const v = LEGAL_DOC_VERSIONS.dpa;

export default function DpaPage() {
  return (
    <LegalDoc
      title="Data processing addendum"
      version={v.version}
      effectiveDate={v.effectiveDate}
      intro={
        <>
          This addendum forms part of the Terms of Service and governs our processing of personal
          data on your behalf. It applies whenever you use Sparx to handle the personal data of your
          own customers or contacts.
        </>
      }
    >
      <LegalSection heading="1. Roles">
        <LegalP>
          For personal data contained in Customer Data, you are the <strong>controller</strong> and
          WizeWorks is the <strong>processor</strong> (or, where applicable, a service provider
          under U.S. state privacy laws). We process such personal data only on your documented
          instructions, which include the configuration choices you make in the Service and these
          Terms.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Scope of processing">
        <LegalP>
          We process personal data to provide the Service — for example storing customer records in
          the CRM, processing orders and payments in commerce, delivering email you send, and
          rendering the content and stores you publish. The subject matter is the operation of your
          tenant; the duration is the term of your subscription plus any wind-down period.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. Categories of data & data subjects">
        <LegalList
          items={[
            'Data subjects — your end customers, contacts, leads, and the recipients of your communications.',
            'Categories — identifiers (name, email, phone), order and transaction history, addresses, communication preferences and consent state, and any other fields you choose to store.',
            'We do not require special-category data; if you choose to process it, you are responsible for the lawful basis.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Our obligations">
        <LegalList
          items={[
            'Process personal data only on your instructions and for no other purpose.',
            'Ensure personnel authorized to process data are bound by confidentiality.',
            'Implement appropriate technical and organizational security measures (see our security overview).',
            'Assist you, taking into account the nature of processing, in responding to data-subject requests and in meeting your security, breach-notification, and impact-assessment obligations.',
            'Delete or return personal data at the end of the relationship, subject to legal retention requirements.',
            'Make available information needed to demonstrate compliance and allow for audits within reasonable, agreed parameters.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. Subprocessors">
        <LegalP>
          You authorize us to engage subprocessors to deliver the Service — including our cloud
          host, payment processor, and email provider. We impose data-protection terms on each
          subprocessor no less protective than those in this addendum and remain responsible for
          their performance. We maintain a current subprocessor list and will give notice of
          material changes so you can object on reasonable grounds.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Security & breach notification">
        <LegalP>
          We maintain encryption in transit and at rest, database-level tenant isolation, and access
          controls. If we become aware of a personal-data breach affecting your data, we will notify
          you without undue delay — and within 72 hours of confirming a reportable breach — with the
          information you reasonably need to meet your own notification duties.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. International transfers">
        <LegalP>
          Where personal data is transferred across borders, we rely on appropriate safeguards (such
          as the EU standard contractual clauses) to the extent required by applicable law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Return & deletion">
        <LegalP>
          On termination you may export Customer Data for a reasonable period. After that period we
          delete or anonymize personal data, except where we are required to retain it (for example,
          order records needed for tax and accounting), in which case it remains subject to these
          protections.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Acceptance">
        <LegalP>
          This addendum is incorporated into the <a href="/legal/terms">Terms of Service</a>. A
          countersigned copy is available for organizations that require one — email{' '}
          <a href="mailto:legal@sparx.works">legal@sparx.works</a>. A signed DPA is required for
          tenants processing the personal data of individuals in the EU/EEA and UK.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
