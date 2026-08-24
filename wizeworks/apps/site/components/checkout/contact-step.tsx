'use client';

// CONTACT — who is buying, and how to reach them.
//
// The name lives HERE, not inside a delivery address, and that is the whole of
// issue 064. Checkout used to ask for "Full name" as the first line of the
// shipping form, so the only way a shop could learn who was buying was to make
// the buyer type a street, a city and a postal code first. A bakery that hands
// everything over its own counter was therefore demanding a postal address for
// an order that would never be posted, and then writing that address onto the
// order as though somebody meant it.
//
// A name and a way to reach someone are what EVERY order needs, however it
// leaves. An address is what a DELIVERY needs. Asking for them in that order
// means a collection-only shop never asks for an address at all.

import { Button, Input } from '@wizeworks/silicaui-react';

export interface ContactDraft {
  name: string;
  email: string;
  phone: string;
  acceptsMarketing: boolean;
}

export const EMPTY_CONTACT: ContactDraft = {
  name: '',
  email: '',
  phone: '',
  acceptsMarketing: false,
};

const FIELD = 'flex flex-col gap-1.5';
const LABEL = 'text-base-content text-sm font-medium';

export function ContactStep({
  value,
  onChange,
  onSubmit,
  busy,
  /** True when this shop hands orders over in person, so the phone line can say
   *  what it is actually for rather than offering a vague "just in case". */
  collectionOnly,
}: {
  value: ContactDraft;
  onChange: (next: ContactDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  collectionOnly: boolean;
}) {
  function set<K extends keyof ContactDraft>(key: K, next: ContactDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">Your details</h2>

      <label className={FIELD}>
        <span className={LABEL}>Your name</span>
        <Input
          required
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          autoComplete="name"
          placeholder="Rowan Ellery"
        />
      </label>

      <label className={FIELD}>
        <span className={LABEL}>Email</span>
        <Input
          type="email"
          required
          value={value.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <label className={FIELD}>
        <span className={LABEL}>Phone (optional)</span>
        <Input
          type="tel"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          autoComplete="tel"
        />
        <span className="text-base-content text-sm">
          {collectionOnly
            ? 'So we can call you the moment your order is ready to pick up.'
            : 'So we can reach you if there is a question about your order.'}
        </span>
      </label>

      <label className="text-base-content flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={value.acceptsMarketing}
          onChange={(e) => set('acceptsMarketing', e.target.checked)}
        />
        Email me with news and offers
      </label>

      <Button type="submit" color="primary" size="lg" disabled={busy}>
        {busy ? 'Saving…' : collectionOnly ? 'Continue' : 'Continue to delivery'}
      </Button>
    </form>
  );
}
