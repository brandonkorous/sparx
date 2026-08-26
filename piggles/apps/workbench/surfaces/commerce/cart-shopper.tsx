'use client';

// WHO TO CHASE about a basket nobody paid for.
//
// This section used to answer "is there an account?" — a true sentence about the
// database and a useless one to the owner, who wants to know who to email
// (issue 216). Checkout has the name and the address; only a signed-in shopper
// was ever read.

import { Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import type { CartContact, CartCustomer } from './carts-data';

/** How far somebody got before they stopped, in the owner's terms. Absent for a
 *  step that says nothing useful about a basket left behind. */
const REACHED: Record<string, string> = {
  contact: 'They had typed their details and stopped there.',
  shipping: 'They had chosen how they wanted it sent.',
  payment: 'They reached the last step, where they would have paid.',
  review: 'They reached the last step, where they would have paid.',
};

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <Text className="text-sm">{label}</Text>
      {children}
    </div>
  );
}

export function CartShopper({
  customer,
  contact,
}: {
  customer: CartCustomer | null;
  contact: CartContact | null;
}) {
  const name = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    : (contact?.name ?? '');
  const email = customer?.email ?? contact?.email ?? null;
  const phone = contact?.phone ?? null;
  const reached = contact?.reached ? REACHED[contact.reached] : undefined;

  if (!name && !email && !phone) {
    return (
      <FormSection title="Whose basket it is">
        <Text className="text-base">
          Nobody left a name or an address. This basket was filled by a visitor who never started
          checkout, so there is no way to get in touch about it.
        </Text>
      </FormSection>
    );
  }

  return (
    <ModuleScope module="crm">
      <FormSection title="Whose basket it is">
        <div className="flex flex-col gap-1">
          {name ? <Text className="text-base font-medium">{name}</Text> : null}
          {email ? (
            <Line label="Email">
              <a href={`mailto:${email}`} className="link text-base break-all">
                {email}
              </a>
            </Line>
          ) : null}
          {phone ? (
            <Line label="Phone">
              <a href={`tel:${phone}`} className="link text-base">
                {phone}
              </a>
            </Line>
          ) : null}
          {!customer ? (
            <Text className="text-sm">
              They were not signed in, so there is no account behind this — but they gave you this
              much at checkout.
            </Text>
          ) : null}
          {reached ? <Text className="text-sm">{reached}</Text> : null}
        </div>
      </FormSection>
    </ModuleScope>
  );
}
