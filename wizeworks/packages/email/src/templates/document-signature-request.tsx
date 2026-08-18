import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
} from '../components';

export interface DocumentSignatureRequestEmailProps {
  /** The signer's name (falls back to "there"). */
  signerName?: string;
  /** Human label for the document, e.g. "Estimate", "Quote", "Work Order". */
  documentLabel: string;
  /** The document's number/reference, e.g. "EST-1042". */
  documentNumber: string;
  /** The document total, in major units (already divided), e.g. 1499.0. */
  documentTotal: number;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  /** ISO-8601 expiry — the signing link stops working after this. */
  expiresAt: string;
  /** The signing URL (may be an absolute URL OR a bare path). */
  signingUrl: string;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatExpiry(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(t));
}

// A tenant → their-customer signing request (a quote/estimate/work-order awaiting a
// signature). Published today from `signature-mail.ts` but had NO template — so the
// send silently dropped in the worker. This restores it. (It renders in sparx chrome
// for now; the per-tenant brand pass will re-skin the tenant-facing templates.)
export function DocumentSignatureRequestEmail({
  signerName,
  documentLabel,
  documentNumber,
  documentTotal,
  currency,
  expiresAt,
  signingUrl,
}: DocumentSignatureRequestEmailProps) {
  const label = documentLabel || 'document';
  const expiryLabel = formatExpiry(expiresAt);
  return (
    <PlatformEmailLayout
      preview={`${label} ${documentNumber} is ready for your signature`}
      footerReason={`You're receiving this because a ${label.toLowerCase()} was sent to you for signature.`}
    >
      <EmailDisplayHeading>Please review and sign</EmailDisplayHeading>
      <EmailParagraph>
        Hi {signerName ?? 'there'}, your {label.toLowerCase()}{' '}
        <strong>
          {label} {documentNumber}
        </strong>{' '}
        is ready. Take a moment to review it and add your signature — it only takes a minute.
      </EmailParagraph>

      <EmailAmountHero
        amount={formatMoney(documentTotal, currency)}
        caption={`${label} ${documentNumber}`}
        status={{ label: 'Awaiting signature', tone: 'info' }}
      />

      <EmailActionButton href={signingUrl}>Review &amp; sign</EmailActionButton>

      <EmailFinePrint>
        {expiryLabel
          ? `This signing link is valid until ${expiryLabel}.`
          : 'This signing link will expire, so please sign soon.'}
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function documentSignatureRequestSubject(
  documentLabel: string,
  documentNumber: string
): string {
  const label = documentLabel || 'Document';
  return `${label} ${documentNumber} — ready for your signature`;
}
