import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailHeading, EmailParagraph, EmailMuted, EmailCallout, EmailSpacer } from '../components';

export interface AppointmentConfirmationEmailProps {
  customerName: string;
  serviceTypeName: string;
  scheduledAt: string; // ISO datetime string
  durationMinutes: number;
  locationName?: string;
  vehicleDescription?: string;
  notes?: string;
  /** Link to view/manage the appointment on the portal. */
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

export function AppointmentConfirmationEmail({
  customerName,
  serviceTypeName,
  scheduledAt,
  durationMinutes,
  locationName,
  vehicleDescription,
  notes,
  appointmentUrl,
}: AppointmentConfirmationEmailProps) {
  const previewText = `Your ${serviceTypeName} appointment is confirmed for ${formatDateTime(scheduledAt)}`;

  return (
    <EmailLayout preview={previewText}>
      <Section>
        <EmailHeading>Appointment confirmed</EmailHeading>
        <EmailParagraph>Hi {customerName},</EmailParagraph>
        <EmailParagraph>Your appointment has been confirmed. Here are the details:</EmailParagraph>
      </Section>

      <EmailCallout>
        <EmailMuted>Service</EmailMuted>
        <EmailParagraph flush>{serviceTypeName}</EmailParagraph>

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

      {notes ? (
        <>
          <EmailSpacer />
          <Section>
            <EmailHeading level={2}>Notes</EmailHeading>
            <EmailParagraph>{notes}</EmailParagraph>
          </Section>
        </>
      ) : null}

      {appointmentUrl ? (
        <>
          <EmailSpacer />
          <EmailParagraph>
            View or manage your appointment: <a href={appointmentUrl}>{appointmentUrl}</a>
          </EmailParagraph>
        </>
      ) : null}
    </EmailLayout>
  );
}

export const appointmentConfirmationSubject = (serviceTypeName: string) =>
  `Appointment confirmed: ${serviceTypeName}`;
