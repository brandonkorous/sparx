'use client';

// The choices in the cookie banner section. Holds no state: the section owns the
// draft, the read and the save (cookie-banner-editor.ts).

import {
  CheckboxGroup,
  CheckboxOption,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  RadioGroup,
  RadioOption,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import {
  COOKIE_KIND_COPY,
  COOKIE_KINDS,
  DEFAULT_BANNER_BODY,
  DEFAULT_BANNER_TITLE,
  type CookieBannerMode,
  type CookieKind,
} from './cookie-banner-data';

export interface CookieBannerDraft {
  mode: CookieBannerMode;
  kinds: CookieKind[];
  title: string;
  body: string;
}

interface FieldsProps {
  draft: CookieBannerDraft;
  onChange: (next: CookieBannerDraft) => void;
  disabled: boolean;
}

/** The approaches in an owner's words; the laws are named in the hint only. */
const MODES: { value: CookieBannerMode; label: string; hint: string }[] = [
  {
    value: 'off',
    label: 'Off',
    hint: 'Your site says nothing about cookies and offers visitors no choices.',
  },
  {
    value: 'gdpr',
    label: 'Ask visitors before using cookies',
    hint: 'Each new visitor is asked to accept or reject optional cookies. This is the rule for visitors from the EU and the UK, under laws like the GDPR.',
  },
  {
    value: 'ccpa',
    label: 'Use cookies and let visitors opt out',
    hint: 'Visitors are told you use cookies and can say no at any time. This is the usual approach in the US, under laws like California’s CCPA.',
  },
];

/** In the fixed order, so "ticked in a different order" is never a change. */
export function orderedKinds(values: readonly string[]): CookieKind[] {
  return COOKIE_KINDS.filter((kind) => values.includes(kind));
}

export function CookieBannerFields(props: FieldsProps) {
  return (
    <>
      <ModeChoice {...props} />
      <KindChoice {...props} />
      <BannerWords {...props} />
    </>
  );
}

function ModeChoice({ draft, onChange, disabled }: FieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <Text id="cookie-banner-mode" className="font-medium">
        How your site handles cookies
      </Text>
      <RadioGroup
        color="module"
        value={draft.mode}
        aria-labelledby="cookie-banner-mode"
        disabled={disabled}
        onValueChange={(value) => {
          onChange({ ...draft, mode: value as CookieBannerMode });
        }}
      >
        {MODES.map((option) => (
          <RadioOption key={option.value} value={option.value} className="items-start py-1">
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-medium">{option.label}</span>
              <span className="text-sm">{option.hint}</span>
            </span>
          </RadioOption>
        ))}
      </RadioGroup>
    </div>
  );
}

function KindChoice({ draft, onChange, disabled }: FieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <Text id="cookie-banner-kinds" className="font-medium">
        Optional cookies your site uses
      </Text>
      <Text className="text-sm">
        Tick each kind your site uses. Visitors read the same description beside each one when they
        make their choices. With none ticked there is nothing to ask first, so visitors get a small
        button instead of a banner.
      </Text>
      <CheckboxGroup
        color="module"
        value={draft.kinds}
        aria-labelledby="cookie-banner-kinds"
        disabled={disabled}
        onValueChange={(next) => {
          onChange({ ...draft, kinds: orderedKinds(next) });
        }}
      >
        {COOKIE_KINDS.map((kind) => (
          <CheckboxOption key={kind} value={kind} className="items-start py-1">
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-medium">{COOKIE_KIND_COPY[kind].label}</span>
              <span className="text-sm">{COOKIE_KIND_COPY[kind].visitorReads}</span>
            </span>
          </CheckboxOption>
        ))}
      </CheckboxGroup>
      <Text className="text-sm">
        Cookies your site needs to work, like keeping someone signed in, are always on. Visitors
        cannot turn them off, so there is nothing to tick for them.
      </Text>
    </div>
  );
}

function BannerWords({ draft, onChange, disabled }: FieldsProps) {
  return (
    <>
      <Field>
        <FieldLabel>Banner title</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.title}
              maxLength={255}
              placeholder={DEFAULT_BANNER_TITLE}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...draft, title: event.target.value });
              }}
            />
          }
        />
        <FieldDescription>Leave it empty to use the wording shown in the box.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Banner message</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              value={draft.body}
              rows={3}
              maxLength={2000}
              placeholder={DEFAULT_BANNER_BODY}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...draft, body: event.target.value });
              }}
            />
          }
        />
        <FieldDescription>
          Leave it empty to use the wording shown in the box. A link to your Cookie Policy is always
          added after it.
        </FieldDescription>
      </Field>
    </>
  );
}
