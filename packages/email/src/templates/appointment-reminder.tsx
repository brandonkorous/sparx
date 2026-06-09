import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailHeading, EmailParagraph, EmailMuted, EmailCallout, EmailSpacer } from '../components';

export interface AppointmentReminderEmailProps {
  customerName: string;
  serviceTypeName: string;
  scheduledAt: string; // ISO datetime string
  durationMinutes: number;
  locationName?: string;
  vehicleDescription?: string;
  /** Hours until appointment (used to personalize "tomorrow" vs "in N hours"). */
  hoursUntil: number;
  appointmentUrl?: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function AppointmentReminderEmail({
  customerName,
  serviceTypeName,
  scheduledAt,
  durationMinutes,
  locationName,
  vehicleDescription,
  hoursUntil,
  appointmentUrl,
}: AppointmentReminderEmailProps) {
  const timeLabel = hoursUntil <= 2 ? 'soon' : hoursUntil <= 24 ? 'tomorrow' : 'coming up';
  const previewText = `Reminder: your ${serviceTypeName} appointment is ${timeLabel}`;

  return (
    <EmailLayout preview={previewText}>
      <Section>
        <EmailHeading>Appointment reminder</EmailHeading>
        <EmailParagraph>Hi {customerName},</EmailParagraph>
        <EmailParagraph>
          Just a reminder that your <strong>{serviceTypeName}</strong> appointment is {timeLabel}.
        </EmailParagraph>
      </Section>

      <EmailCallout>
        <EmailMuted>Date & time</EmailMuted>
        <EmailParagraph flush>{formatDateTime(scheduledAt)}</EmailParagraph>

        <EmailMuted>Duration</EmailMuted>
        <EmailParagraph flush>{durationMinutes} minutes</EmailParagraph>

        {locationName ? (
          <>
            <EmailMuted>Location</EmailMuted>
            <EmailParagraph flush>{locationName}</EmailParagraph>
          </>
        ) : null}

        {vehicleDescription ? (
          <>
            <EmailMuted>Vehicle</EmailMuted>
            <EmailParagraph flush>{vehicleDescription}</EmailParagraph>
          </>
        ) : null}
      </EmailCallout>

      {appointmentUrl ? (
        <>
          <EmailSpacer />
          <EmailParagraph>
            Need to reschedule? <a href={appointmentUrl}>Manage your appointment</a>
          </EmailParagraph>
        </>
      ) : null}
    </EmailLayout>
  );
}

export const appointmentReminderSubject = (serviceTypeName: string) =>
  `Reminder: your ${serviceTypeName} appointment`;
