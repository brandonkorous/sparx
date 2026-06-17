/**
 * Privacy policy + terms of service templates. Plain-language, section-based,
 * assembled from the user's answers. A solid starting point — explicitly not a
 * substitute for legal advice. Data-as-code (the document copy), exempt from the
 * file-size lint.
 */
export interface LegalData {
  businessName: string;
  website: string;
  email: string;
  effectiveDate: string;
  jurisdiction: string;
  collectsAccount: boolean;
  collectsPayment: boolean;
  usesCookies: boolean;
  usesAnalytics: boolean;
  sharesThirdParties: boolean;
  gdpr: boolean;
  ccpa: boolean;
}

const biz = (d: LegalData) => d.businessName.trim() || 'the Company';
const site = (d: LegalData) => d.website.trim() || 'our website';
const mail = (d: LegalData) => d.email.trim() || 'our contact email';

export function buildPrivacyPolicy(d: LegalData): string {
  const collected: string[] = [];
  if (d.collectsAccount) collected.push('- **Account information** you provide, such as your name and email address.');
  if (d.collectsPayment) collected.push('- **Payment information** processed securely by our payment provider; we do not store full card numbers.');
  if (d.usesAnalytics) collected.push('- **Usage data**, such as pages visited and device or browser information, collected automatically.');
  if (d.usesCookies) collected.push('- **Cookies and similar technologies** used to operate the site and remember your preferences.');
  if (collected.length === 0) collected.push('- Information you choose to provide when you contact us.');

  const rights: string[] = [];
  if (d.gdpr)
    rights.push(
      '### Your rights (GDPR)\n\nIf you are in the European Economic Area or the UK, you have the right to access, correct, delete, or restrict the processing of your personal data, and to data portability. You may also object to processing and lodge a complaint with a supervisory authority. To exercise these rights, contact us at ' + mail(d) + '.'
    );
  if (d.ccpa)
    rights.push(
      '### Your rights (CCPA)\n\nIf you are a California resident, you have the right to know what personal information we collect, to request its deletion, and to opt out of any sale of personal information. We do not sell your personal information. To exercise these rights, contact us at ' + mail(d) + '.'
    );

  return [
    `# Privacy Policy`,
    ``,
    `_Last updated: ${d.effectiveDate || 'the date below'}_`,
    ``,
    `${biz(d)} ("we", "us") operates ${site(d)}. This Privacy Policy explains what information we collect, how we use it, and the choices you have.`,
    ``,
    `## Information we collect`,
    ``,
    ...collected,
    ``,
    `## How we use your information`,
    ``,
    `We use the information we collect to provide and improve our products and services, respond to your requests, process transactions, keep our services secure, and comply with our legal obligations.`,
    ``,
    ...(d.usesCookies
      ? [`## Cookies`, ``, `We use cookies and similar technologies to keep the site working, remember your preferences, and understand how the site is used. You can control cookies through your browser settings.`, ``]
      : []),
    ...(d.sharesThirdParties
      ? [`## Sharing with third parties`, ``, `We share information with service providers who help us operate our business — for example, hosting, analytics, and payment processing. These providers may only use your information to perform services on our behalf. We do not sell your personal information.`, ``]
      : [`## Sharing`, ``, `We do not sell your personal information. We only share it where necessary to operate our services or comply with the law.`, ``]),
    `## Data security`,
    ``,
    `We take reasonable measures to protect your information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.`,
    ``,
    ...(rights.length ? [rights.join('\n\n'), ``] : []),
    `## Children's privacy`,
    ``,
    `Our services are not directed to children under 13, and we do not knowingly collect personal information from them.`,
    ``,
    `## Changes to this policy`,
    ``,
    `We may update this Privacy Policy from time to time. We will post the updated version on this page with a new "last updated" date.`,
    ``,
    `## Contact us`,
    ``,
    `If you have questions about this Privacy Policy, contact us at ${mail(d)}.`,
    ``,
  ].join('\n');
}

export function buildTerms(d: LegalData): string {
  return [
    `# Terms of Service`,
    ``,
    `_Last updated: ${d.effectiveDate || 'the date below'}_`,
    ``,
    `These Terms of Service ("Terms") govern your use of ${site(d)}, operated by ${biz(d)}. By using our services, you agree to these Terms.`,
    ``,
    `## Using our services`,
    ``,
    `You agree to use our services only for lawful purposes and in accordance with these Terms. You are responsible for any activity that occurs under your account.`,
    ``,
    ...(d.collectsAccount
      ? [`## Accounts`, ``, `When you create an account, you must provide accurate information and keep your credentials secure. You are responsible for all activity under your account.`, ``]
      : []),
    `## Intellectual property`,
    ``,
    `All content and materials on our services are owned by ${biz(d)} or its licensors and are protected by applicable laws. You may not reuse them without permission.`,
    ``,
    `## Prohibited use`,
    ``,
    `You agree not to misuse our services, including by attempting to disrupt them, access them without authorization, or use them to violate the rights of others.`,
    ``,
    `## Disclaimer`,
    ``,
    `Our services are provided "as is" without warranties of any kind. We do not guarantee that they will be uninterrupted, error-free, or fit for a particular purpose.`,
    ``,
    `## Limitation of liability`,
    ``,
    `To the fullest extent permitted by law, ${biz(d)} will not be liable for any indirect, incidental, or consequential damages arising from your use of our services.`,
    ``,
    `## Governing law`,
    ``,
    `These Terms are governed by the laws of ${d.jurisdiction.trim() || 'the jurisdiction in which we operate'}, without regard to its conflict-of-law rules.`,
    ``,
    `## Changes to these Terms`,
    ``,
    `We may update these Terms from time to time. Continued use of our services after changes take effect means you accept the updated Terms.`,
    ``,
    `## Contact us`,
    ``,
    `Questions about these Terms? Contact us at ${mail(d)}.`,
    ``,
  ].join('\n');
}
