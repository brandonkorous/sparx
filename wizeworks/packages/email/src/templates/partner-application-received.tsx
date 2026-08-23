import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailLineItems,
  EmailParagraph,
  EmailSectionLabel,
  usePlatformName,
  type LineItem,
} from '../components';

export interface PartnerApplicationReceivedEmailProps {
  /** The applicant's name. */
  applicantName: string;
  /** The applicant's email. */
  applicantEmail: string;
  /** The tier they applied for, e.g. "Certified". Optional. */
  requestedTier?: string;
  /** The applicant's website, if given. Optional. */
  websiteUrl?: string;
  /** The kind of partner (e.g. "Agency", "Consultant"). Optional. */
  kind?: string;
  /** Link to the partner-applications review queue in the admin console. */
  reviewUrl: string;
}

// PLATFORM email (sparx → WizeWorks STAFF) — a new partner application landed and
// needs review. Internal ops notice, not partner-facing.
export function PartnerApplicationReceivedEmail({
  applicantName,
  applicantEmail,
  requestedTier,
  websiteUrl,
  kind,
  reviewUrl,
}: PartnerApplicationReceivedEmailProps) {
  const platform = usePlatformName();
  const rows: LineItem[] = [
    { title: 'Applicant', subtitle: applicantEmail, amount: applicantName },
  ];
  if (kind) rows.push({ title: 'Type', amount: kind });
  if (requestedTier) rows.push({ title: 'Requested tier', amount: requestedTier });
  if (websiteUrl) rows.push({ title: 'Website', amount: websiteUrl });

  return (
    <PlatformEmailLayout
      preview={`New partner application — ${applicantName}`}
      mastheadRight="partners"
      footerReason={`You're receiving this because you handle partner applications for ${platform}.`}
    >
      <EmailDisplayHeading>New partner application</EmailDisplayHeading>
      <EmailParagraph>
        <strong>{applicantName}</strong> applied to the {platform} Partner Program. The details are
        below — review and approve or decline from the console.
      </EmailParagraph>

      <EmailSectionLabel>Application</EmailSectionLabel>
      <EmailLineItems items={rows} />

      <EmailActionButton href={reviewUrl}>Review application</EmailActionButton>
    </PlatformEmailLayout>
  );
}

export function partnerApplicationReceivedSubject(applicantName: string): string {
  return `New partner application — ${applicantName}`;
}
