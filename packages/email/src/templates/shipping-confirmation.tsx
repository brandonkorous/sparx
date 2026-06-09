import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import {
  EmailButton,
  EmailCallout,
  EmailHeading,
  EmailMuted,
  EmailParagraph,
  EmailSpacer,
} from '../components';

export interface ShippingConfirmationEmailProps {
  /** Customer's display name. */
  customerName: string;
  /** Human-readable order number, e.g. "ORD-10042". */
  orderNumber: string;
  /** Carrier name shown to the customer, e.g. "UPS", "FedEx". */
  carrier: string;
  /** Carrier tracking number. */
  trackingNumber: string;
  /** Direct tracking URL — linked from the button if provided. */
  trackingUrl?: string;
  /** Human-readable estimated delivery range, e.g. "2–4 business days". */
  estimatedDelivery?: string;
  /** Shipping address snapshot. */
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
  };
}

export function ShippingConfirmationEmail({
  customerName,
  orderNumber,
  carrier,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
  shippingAddress,
}: ShippingConfirmationEmailProps) {
  const previewText = `Your order ${orderNumber} is on its way via ${carrier}`;

  return (
    <EmailLayout preview={previewText}>
      <Section>
        <EmailHeading>Your order is on its way</EmailHeading>
        <EmailParagraph>Hi {customerName},</EmailParagraph>
        <EmailParagraph>
          Great news — your order has been shipped and is heading your way.
        </EmailParagraph>
      </Section>

      <EmailCallout>
        <EmailMuted>Carrier</EmailMuted>
        <EmailParagraph flush>{carrier}</EmailParagraph>
        <EmailSpacer />
        <EmailMuted>Tracking number</EmailMuted>
        <EmailParagraph flush>{trackingNumber}</EmailParagraph>
        {estimatedDelivery ? (
          <>
            <EmailSpacer />
            <EmailMuted>Estimated delivery</EmailMuted>
            <EmailParagraph flush>{estimatedDelivery}</EmailParagraph>
          </>
        ) : null}
      </EmailCallout>

      {trackingUrl ? (
        <>
          <EmailSpacer />
          <EmailButton href={trackingUrl}>Track your shipment</EmailButton>
        </>
      ) : null}

      {shippingAddress ? (
        <>
          <EmailSpacer />
          <Section>
            <EmailHeading level={2}>Delivering to</EmailHeading>
            <EmailMuted>
              {shippingAddress.name}
              <br />
              {shippingAddress.line1}
              {shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''}
              <br />
              {shippingAddress.city}
              {shippingAddress.region ? `, ${shippingAddress.region}` : ''}{' '}
              {shippingAddress.postalCode}
              <br />
              {shippingAddress.country}
            </EmailMuted>
          </Section>
        </>
      ) : null}

      <EmailSpacer />
      <EmailMuted>Order reference: {orderNumber}</EmailMuted>
    </EmailLayout>
  );
}

export const shippingConfirmationSubject = (orderNumber: string) =>
  `Your order ${orderNumber} has shipped`;
