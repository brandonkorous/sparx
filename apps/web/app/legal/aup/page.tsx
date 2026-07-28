import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Acceptable use policy — sparx',
  description: 'The conduct and content rules that apply to everyone who uses sparx.',
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
          The conduct and content rules that apply to everyone who uses sparx. This policy is part
          of the Terms of Service; violating it can lead to suspension or termination.
        </>
      }
    >
      <LegalSection heading="1. Purpose">
        <LegalP>
          sparx is a platform for content and commerce of every kind. This policy keeps it safe,
          lawful, and reliable for everyone. It applies to your tenant, your staff users, and the
          stores, sites, and communications you operate on sparx.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Prohibited content & conduct">
        <LegalP>You may not use sparx to create, store, sell, or distribute:</LegalP>
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

      <LegalSection heading="4. Email">
        <LegalP>
          Outbound email you send through sparx must comply with anti-spam laws (such as CAN-SPAM
          and GDPR). You must have a lawful basis to contact recipients, honor unsubscribe requests
          promptly, and not send unsolicited bulk messages. We include one-click unsubscribe in
          marketing email and may suspend sending that generates abuse complaints.
        </LegalP>
        <LegalP>
          Purchased, scraped, rented, and appended lists are not a lawful basis and are not
          permitted here, whatever the seller told you. Nor may you disguise who a message is from:
          the sender name, the from address, and the subject line must honestly identify your
          business and the message.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. Text messages">
        <LegalP>
          <strong>
            Text messaging is held to a stricter standard than email, because the law holds it to
            one.
          </strong>{' '}
          In the United States the Telephone Consumer Protection Act carries statutory damages per
          message, claimed per recipient, and an email opt-in is not consent to be texted. Getting
          this wrong is one of the few ways a small business can face a disproportionate legal bill,
          which is why we are direct about it.
        </LegalP>
        <LegalList
          items={[
            'Text only people who gave you express consent to be texted, at the number they gave you, for the kind of message you are sending. Consent to marketing texts must be its own, separate opt-in — never bundled into another agreement or a condition of purchase.',
            'Keep proof of that consent. If a complaint arrives, the burden of showing consent is yours, not ours.',
            'Honor STOP, UNSUBSCRIBE, and every ordinary way a person says stop, immediately and permanently.',
            'Identify your business in the message, and respect quiet hours and the other timing rules that apply where the recipient is.',
            'Do not send marketing texts to a number solely because it appeared on an order or a booking. A transactional relationship is a basis for transactional messages — a confirmation, a reminder — not for promotions.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Publishing to social platforms">
        <LegalP>
          When you connect a social account, sparx publishes through the platform&rsquo;s own API
          under sparx&rsquo;s developer registration. That has a consequence worth stating plainly:
          serious abuse by one business can get the integration suspended for every business using
          it. So the platforms&rsquo; rules are our rules.
        </LegalP>
        <LegalList
          items={[
            'Connect only accounts you own or are authorized to manage, and comply with each platform’s terms and community standards for everything you publish through sparx.',
            'No artificial engagement, follower or like buying, mass unsolicited messaging, or automated behavior a platform prohibits.',
            'Do not misrepresent who is posting, and disclose paid or sponsored content where the platform or the law requires it.',
            'Comments, reviews, and messages that arrive in your inbox are other people’s personal data. Use them to run your business — reply, resolve, moderate — not to build a marketing list, and delete them on request or when a platform requires it.',
          ]}
        />
        <LegalP>
          We may disconnect an account or suspend social publishing without notice where a platform
          requires it or where continuing would jeopardize the integration for other customers.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. AI features">
        <LegalP>
          AI features run on a provider key you supply, so you are the account holder and that
          provider&rsquo;s usage policies apply to you directly. Do not use them to generate content
          that would violate section 2 of this policy, to impersonate a real person, or to produce
          reviews, testimonials, or endorsements presented as genuine when they are not. Where AI
          drafts a reply to one of your customers, you remain responsible for what is actually sent.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Enforcement">
        <LegalP>
          We may investigate suspected violations and may remove content, throttle or suspend
          functionality, or terminate accounts that violate this policy — with notice where
          practical, and immediately where there is risk of harm, legal exposure, or abuse. We
          cooperate with lawful requests from authorities.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Reporting & contact">
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
