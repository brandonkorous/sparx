import * as React from 'react';
import { Column, Row, Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import {
  EmailHeading,
  EmailParagraph,
  EmailMuted,
  EmailCallout,
  EmailDivider,
  EmailSpacer,
} from '../components';

export interface OrderConfirmationEmailProps {
  /** Customer's display name (first + last or username). */
  customerName: string;
  /** Human-readable order number, e.g. "ORD-10042". */
  orderNumber: string;
  /** Total amount charged, in cents. */
  totalCents: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** Internal order UUID — used to build the order-status URL. */
  orderId: string;
  /** Link to the order status / confirmation page on the storefront. */
  orderStatusUrl?: string;
  /** Line items summary (optional; shown when provided). */
  lineItems?: {
    name: string;
    quantity: number;
    unitTotalCents: number;
  }[];
  /** Shipping address snapshot, shown below line items if provided. */
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

function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  });
}

export function OrderConfirmationEmail({
  customerName,
  orderNumber,
  totalCents,
  currency,
  orderStatusUrl,
  lineItems,
  shippingAddress,
}: OrderConfirmationEmailProps) {
  const previewText = `Order ${orderNumber} confirmed — ${formatMoney(totalCents, currency)}`;

  return (
    <EmailLayout preview={previewText}>
      <Section>
        <EmailHeading>Order confirmed</EmailHeading>
        <EmailParagraph>Hi {customerName},</EmailParagraph>
        <EmailParagraph>
          Thanks for your order. We&apos;ve received it and it&apos;s being prepared.
        </EmailParagraph>
      </Section>

      <EmailCallout>
        <EmailMuted>Order number</EmailMuted>
        <EmailParagraph flush>{orderNumber}</EmailParagraph>
      </EmailCallout>

      {lineItems && lineItems.length > 0 ? (
        <>
          <EmailSpacer />
          <Section>
            <EmailHeading level={2}>Items</EmailHeading>
            {lineItems.map((item, i) => (
              <Row key={i}>
                <Column>
                  <EmailParagraph flush>
                    {item.name} × {item.quantity}
                  </EmailParagraph>
                </Column>
                <Column align="right">
                  <EmailMuted>{formatMoney(item.unitTotalCents, currency)}</EmailMuted>
                </Column>
              </Row>
            ))}
          </Section>
          <EmailDivider />
          <Row>
            <Column>
              <EmailParagraph flush>Total</EmailParagraph>
            </Column>
            <Column align="right">
              <EmailParagraph flush>{formatMoney(totalCents, currency)}</EmailParagraph>
            </Column>
          </Row>
        </>
      ) : (
        <>
          <EmailSpacer />
          <Row>
            <Column>
              <EmailParagraph flush>Total</EmailParagraph>
            </Column>
            <Column align="right">
              <EmailParagraph flush>{formatMoney(totalCents, currency)}</EmailParagraph>
            </Column>
          </Row>
        </>
      )}

      {shippingAddress ? (
        <>
          <EmailSpacer />
          <Section>
            <EmailHeading level={2}>Shipping to</EmailHeading>
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

      {orderStatusUrl ? (
        <>
          <EmailSpacer />
          <EmailParagraph>
            Track your order status at any time: <a href={orderStatusUrl}>{orderStatusUrl}</a>
          </EmailParagraph>
        </>
      ) : null}
    </EmailLayout>
  );
}

export const orderConfirmationSubject = (orderNumber: string) => `Order ${orderNumber} confirmed`;
