import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailCallout,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  EmailSectionLabel,
  EmailStatusPill,
} from '../components';

// In-product feedback — "WizeWorks replied to your feedback" notification
// (docs/112 §8). Published as an `email.send` event when staff respond to a
// submission from the admin portal (docs/apps/admin/feedback.md §6). Closes the
// loop back to the original submitter alongside the in-app unread dot.

export interface FeedbackResponseEmailProps {
  /** The submitter's name (or null → a neutral greeting). */
  recipientName?: string | null;
  /** What they sent us, so the reply has context (subject or first line). */
  feedbackTitle: string;
  /** Our reply body. */
  responseBody: string;
  /** Who replied, e.g. "Brandon from sparx". */
  responderName: string;
  /** Optional human status label when the response carried a status change
   *  (e.g. "Shipped", "Planned", "Won't do"). */
  statusLabel?: string;
  /** Deep link to the thread in the dashboard (the Your-feedback history view). */
  threadUrl: string;
}

export function FeedbackResponseEmail({
  recipientName,
  feedbackTitle,
  responseBody,
  responderName,
  statusLabel,
  threadUrl,
}: FeedbackResponseEmailProps) {
  return (
    <PlatformEmailLayout
      preview={`${responderName} replied to your feedback`}
      footerLinks={[{ label: 'View the conversation', href: threadUrl }]}
      footerReason="You're receiving this because you submitted feedback in your sparx dashboard."
    >
      <EmailDisplayHeading>We replied to your feedback</EmailDisplayHeading>
      <EmailParagraph>{recipientName ? `Hi ${recipientName},` : 'Hi there,'}</EmailParagraph>
      <EmailParagraph>
        Thanks for taking the time to share this. {responderName} got back to you
        {statusLabel ? ' — with an update' : ''}:
      </EmailParagraph>

      <EmailSectionLabel>Your feedback</EmailSectionLabel>
      <EmailParagraph style={{ marginBottom: 8 }}>{feedbackTitle}</EmailParagraph>
      {statusLabel ? <EmailStatusPill label={statusLabel} tone="info" /> : null}

      <EmailCallout tone="info">{responseBody}</EmailCallout>

      <EmailActionButton href={threadUrl}>View the conversation</EmailActionButton>

      <EmailFinePrint>You can reply right from the thread.</EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function feedbackResponseSubject(feedbackTitle: string): string {
  return `Re: your feedback — ${feedbackTitle}`;
}
