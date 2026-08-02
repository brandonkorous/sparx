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
import { type PartnerTier } from '@/lib/partners';
import { applyToPartnerProgram, type ApplyState } from '@/app/partners/actions';
import { Display, Spark, Text } from './primitives';

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

      <div className="flex flex-col gap-[7px]">
        <Text as="span" size={13} weight={500}>
          Tier you&rsquo;re applying for
        </Text>
        <input type="hidden" name="requestedTier" value={tier} />
        {/* A real silica toggle group: the selected tier is a `soft` primary
            Button, the rest are `outline`. No hand-rolled fill/ink pair. */}
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const on = tier === t.value;
            return (
              <Button
                key={t.value}
                type="button"
                aria-pressed={on}
                color={on ? 'primary' : 'neutral'}
                variant={on ? 'soft' : 'outline'}
                onClick={() => setTier(t.value)}
              >
                {t.label}
              </Button>
            );
          })}
        </div>
        <Text as="span" size={12}>
          {tier === 'informal'
            ? 'Approved instantly — activate right after you apply.'
            : 'Reviewed within 3 business days.'}
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
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Submitting…' : 'Submit application →'}
    </Button>
  );
}

function Confirmation() {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      <span
        aria-hidden
        className="bg-primary text-primary bg-soft inline-flex size-11 items-center justify-center rounded-full text-2xl"
      >
        ✓
      </span>
      <Display as="h3" size={24} lineHeight={30}>
        Application received
        <Spark />
      </Display>
      <Text size={15} className="max-w-[380px]">
        Every application is reviewed by the Sparx team — we’ll be in touch within 3 business days.
      </Text>
    </div>
  );
}
