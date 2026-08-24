'use client';

import { useEffect, useState } from 'react';
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
} from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { lookUpAddress } from '@/app/onboarding/address-action';
import type { AddressVerdict } from '@/lib/address-rules';

// The web address, offered while it is still free to choose.
//
// It is an identifier, so it is never editable afterwards (issue #010). That
// makes this the only screen where the answer can be influenced, and a field
// nobody sees is the reason a bakery ended up living at `quiet-haven-3783`.

const SUFFIX = `.${PRODUCT.tenantSites.suffix}`;

/** How long to sit still before asking whether the address is free. Long enough
 *  that typing a name does not fire a request per keystroke, short enough that
 *  the answer is there before the eye reaches the next field. */
const SETTLE_MS = 400;

type Told = { slug: string; verdict: AddressVerdict } | null;

function say(told: Told): { status?: 'error' | 'success'; message?: string } {
  if (!told) return {};
  switch (told.verdict) {
    case 'free':
    case 'yours':
      return { status: 'success', message: `${told.slug}${SUFFIX} is yours.` };
    case 'taken':
      return { status: 'error', message: 'Another business already has that one.' };
    case 'reserved':
      return { status: 'error', message: 'That one is spoken for. Try another.' };
    case 'unusable':
      return { status: 'error', message: 'Use letters, numbers and hyphens.' };
  }
}

export function AddressField({
  value,
  onChange,
  submitError,
}: {
  value: string;
  onChange: (next: string) => void;
  /** What the server said when the form was sent. Outranks anything checked
   *  while typing, because it is the answer that actually decided. */
  submitError: string | null;
}) {
  const [told, setTold] = useState<Told>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!value) {
      setTold(null);
      return;
    }
    setAsking(true);
    let live = true;
    const timer = setTimeout(() => {
      void lookUpAddress(value).then((answer) => {
        if (!live) return;
        setTold(answer);
        setAsking(false);
      });
    }, SETTLE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value]);

  const checked = say(told);
  const status = submitError ? 'error' : asking ? undefined : checked.status;
  const message = submitError ?? (asking ? undefined : checked.message);

  return (
    <Field status={status} statusMessage={message} loading={asking}>
      <FieldLabel>Your web address</FieldLabel>
      <InputGroup>
        <FieldControl
          render={<Input size="lg" className="input-affix-end" />}
          name="webAddress"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          maxLength={63}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <InputGroupAddon placement="end">{SUFFIX}</InputGroupAddon>
      </InputGroup>
      {message ? null : (
        <FieldDescription>
          Where your website lives, and what you read out over the counter. We fill it in from your
          business name. Point your own domain at it whenever you like, and this one keeps working
          underneath — so it is worth a moment now, because it does not change afterwards.
        </FieldDescription>
      )}
    </Field>
  );
}
