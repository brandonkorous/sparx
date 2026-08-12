import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  EmailSectionLabel,
} from '../components';

export interface FeedbackReceivedEmailProps {
  /** The submitter's name (or null → a neutral greeting). */
  recipientName?: string | null;
  /** What they sent (subject or first line), echoed back so they know we have it. */
  feedbackTitle: string;
}

// PLATFORM email (sparx → the person who submitted feedback) — a "we got it" ack
// sent the moment feedback is submitted, before any staff reply. Reassures them a
// real human will read it.
export function FeedbackReceivedEmail({
  recipientName,
  feedbackTitle,
}: FeedbackReceivedEmailProps) {
  return (
    <PlatformEmailLayout
      preview="Thanks — we got your feedback"
      footerReason="You're receiving this because you submitted feedback in your sparx dashboard."
    >
      <EmailDisplayHeading>Thanks — we got it</EmailDisplayHeading>
      <EmailParagraph>
        {recipientName ? `Hi ${recipientName}, ` : ''}thanks for taking the time to share this with
        us. A real person on the sparx team reads every piece of feedback, and we&apos;ll follow up
        here if there&apos;s more to say.
      </EmailParagraph>

      <EmailSectionLabel>What you sent</EmailSectionLabel>
      <EmailParagraph flush>{feedbackTitle}</EmailParagraph>

      <EmailFinePrint>
        No need to reply — we&apos;ll reach out if we have a question or an update.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function feedbackReceivedSubject(feedbackTitle: string): string {
  return `We got your feedback — ${feedbackTitle}`;
}
