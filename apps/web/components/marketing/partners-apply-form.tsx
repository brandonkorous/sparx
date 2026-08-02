'use client';

// The /partners application form — name + email + website/LinkedIn + "what
// describes you" + how you'll use sparx + the tier you're applying for. Posts to
// the applyToPartnerProgram server action (React 19 form action). On success the
// form swaps for an inline confirmation: EVERY application is reviewed by the Sparx
// team within 3 business days — no tier activates automatically.

import { useActionState, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { Heading, Text } from '@wizeworks/silicaui-react';
import { type PartnerTier } from '@/lib/partners';
import { applyToPartnerProgram, type ApplyState } from '@/app/partners/actions';

const INITIAL: ApplyState = { status: 'idle' };

const TIERS: { value: PartnerTier; label: string }[] = [
  { value: 'informal', label: 'Informal' },
  { value: 'registered', label: 'Registered' },
  { value: 'certified', label: 'Certified' },
];

export function PartnersApplyForm() {
  const [state, action, pending] = useActionState(applyToPartnerProgram, INITIAL);
  const [tier, setTier] = useState<PartnerTier>('informal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const v = useFieldValidation(
    { name, email },
    {
      name: rule.required('Enter your name.'),
      email: rules(rule.required('Enter your email.'), rule.email()),
    }
  );

  if (state.status === 'pending') {
    return <Confirmation />;
  }

  // Gate the server action on client validation; only dispatch when valid.
  function clientAction(formData: FormData) {
    if (!v.validate()) return;
    action(formData);
  }

  return (
    <form action={clientAction} className="flex flex-col gap-4" noValidate>
      <Field {...v.field('name')}>
        <FieldLabel required>Name</FieldLabel>
        <FieldControl
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...v.control('name')}
        />
      </Field>

      <Field {...v.field('email')}>
        <FieldLabel required>Email</FieldLabel>
        <FieldControl
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@studio.com"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...v.control('email')}
        />
      </Field>

      <Field>
        <FieldLabel>
          Website or LinkedIn <span className="font-normal">(optional)</span>
        </FieldLabel>
        <FieldControl
          name="websiteUrl"
          autoComplete="url"
          placeholder="studio.com"
          maxLength={500}
        />
      </Field>

      <Field>
        <FieldLabel>What best describes you?</FieldLabel>
        <FieldControl
          render={
            <NativeSelect name="kind" defaultValue="freelance">
              <option value="freelance">Freelance consultant</option>
              <option value="agency">Agency</option>
              <option value="developer">Developer</option>
              <option value="other">Other</option>
            </NativeSelect>
          }
        />
      </Field>

      <Field>
        <FieldLabel>How will you use sparx with clients?</FieldLabel>
        <FieldControl
          render={
            <Textarea name="note" rows={3} placeholder="Two or three sentences…" maxLength={2000} />
          }
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Text as="span" className="text-md font-medium">
          Tier you&rsquo;re applying for
        </Text>
        <input type="hidden" name="requestedTier" value={tier} />
        {/* Selection is the FILLED shape. This had it backwards — the chosen tier
            rendered `soft` (a pale tint) while the two you had NOT chosen were
            `outline`, so the strongest-looking buttons were the inactive ones. */}
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const on = tier === t.value;
            return (
              <Button
                key={t.value}
                type="button"
                aria-pressed={on}
                {...(on
                  ? { color: 'primary' as const, variant: 'solid' as const }
                  : { variant: 'outline' as const })}
                onClick={() => setTier(t.value)}
              >
                {t.label}
              </Button>
            );
          })}
        </div>
        {/* Was: "Approved instantly — activate right after you apply" for
            Informal, which contradicted this very form's own confirmation screen
            ("EVERY application is reviewed … no tier activates automatically").
            The confirmation is the one that matches the server action. */}
        <Text as="span" className="text-md">
          Reviewed by a person within 3 business days &mdash; every tier.
        </Text>
      </div>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden className="absolute -left-[9999px] size-px">
        <label htmlFor="pa-company-url">Company URL</label>
        <input
          id="pa-company-url"
          name="company_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === 'error' ? (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {state.message}
        </FieldStatus>
      ) : null}

      <SubmitButton pending={pending} />
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="lg" color="primary" disabled={pending} className="w-full">
      {pending ? 'Submitting…' : 'Submit application →'}
    </Button>
  );
}

function Confirmation() {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      {/* Fill + its PAIRED ink. This was `bg-primary text-primary bg-soft` —
          Ember ink on a 15% Ember tint of itself, which is the `soft` foreground
          problem filed as §2 in docs/silicaui/02-core-asks.md. A solid fill uses
          the designed `-content` ink and is legible by construction. */}
      <span
        aria-hidden
        className="bg-primary text-primary-content inline-flex size-11 items-center justify-center rounded-full text-2xl"
      >
        ✓
      </span>
      <Heading level={3} size={3} className="tracking-tight">
        Application received
        <span className="text-primary">.</span>
      </Heading>
      <Text className="max-w-sm text-lg">
        Every application is read by a person — we’ll be in touch within 3 business days.
      </Text>
    </div>
  );
}
