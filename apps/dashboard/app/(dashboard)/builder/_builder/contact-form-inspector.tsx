'use client';

// The bespoke ContactForm config panel (docs/115 Part B). The builder inspector
// is otherwise a GENERIC, data-driven prop editor (PropsFields, keyed off each
// component's `props` array) — there is no per-node-type inspector registry. But
// ContactForm needs three things that generic control types can't express: a
// recipients EDITOR (email chips, prefilled with the owner's email), a "turn on
// CRM" prompt inline with the addToCrm toggle, and reveal-on-toggle for the
// autoresponder copy. So the Inspector special-cases CONTACT_FORM_TYPE and renders
// this card set — following the same seam the inspector already uses for `NavMenu`.
//
// It writes straight to `node.props` via `onProp` (explicit-save: the editor's
// Save flow persists the tree; nothing here calls the server except the CRM
// activation, which is the real `setModuleEnabledAction` path). The card chrome
// reuses the inspector's own `bx-*` classes for a seamless look.

import * as React from 'react';
import {
  ChevronDown,
  MessageSquareText,
  Send,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Input, Switch, Textarea } from '@sparx/ui';

import {
  getContactFormInspectorContext,
  type ContactFormInspectorContext,
} from './contact-form-actions';
import { CrmActivatePrompt, RecipientsEditor } from './contact-form-controls';
import type { BuilderNode } from './model';

export function ContactFormCard({
  node,
  onProp,
}: {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
}) {
  const [ctx, setCtx] = React.useState<ContactFormInspectorContext | null>(null);
  React.useEffect(() => {
    let live = true;
    getContactFormInspectorContext()
      .then((c) => live && setCtx(c))
      .catch(() => live && setCtx({ ownerEmail: '', crmEnabled: false, canActivateCrm: false }));
    return () => {
      live = false;
    };
  }, []);

  const p = node.props;
  const str = (key: string) => {
    const value = p[key];
    return typeof value === 'string' ? value : '';
  };
  const flag = (key: string) => Boolean(p[key]);
  const recipients = Array.isArray(p.recipients)
    ? (p.recipients as unknown[]).filter((r): r is string => typeof r === 'string')
    : [];

  return (
    <>
      <InsCard icon={MessageSquareText} title="What the form says">
        <Field label="Heading">
          <Input value={str('title')} onChange={(e) => onProp('title', e.target.value)} />
        </Field>
        <Field label="Intro text">
          <Textarea
            rows={2}
            value={str('description')}
            onChange={(e) => onProp('description', e.target.value)}
          />
        </Field>
        <Field label="Submit button">
          <Input
            value={str('submitLabel')}
            onChange={(e) => onProp('submitLabel', e.target.value)}
          />
        </Field>
        <Field label="Thank-you message" hint="Shown after someone sends the form.">
          <Textarea
            rows={2}
            value={str('successMessage')}
            onChange={(e) => onProp('successMessage', e.target.value)}
          />
        </Field>
      </InsCard>

      <InsCard icon={SlidersHorizontal} title="Fields">
        <SwitchRow
          label="Show a phone number field"
          checked={flag('showPhone')}
          onChange={(v) => onProp('showPhone', v)}
        />
        <SwitchRow
          label="Require a message"
          hint="Name and email are always required."
          checked={flag('messageRequired')}
          onChange={(v) => onProp('messageRequired', v)}
        />
      </InsCard>

      <InsCard icon={Send} title="When someone submits this form">
        <SwitchRow
          label="Email me"
          checked={flag('notify')}
          onChange={(v) => onProp('notify', v)}
        />
        {flag('notify') ? (
          <RecipientsEditor
            recipients={recipients}
            ownerEmail={ctx?.ownerEmail ?? ''}
            onChange={(next) => onProp('recipients', next)}
          />
        ) : null}

        <SwitchRow
          label="Add them to my contacts"
          hint="Save the person to your CRM as a new contact."
          checked={flag('addToCrm')}
          onChange={(v) => onProp('addToCrm', v)}
        />
        {flag('addToCrm') && ctx && !ctx.crmEnabled ? (
          <CrmActivatePrompt canActivate={ctx.canActivateCrm} />
        ) : null}

        <SwitchRow
          label="Send them a confirmation"
          hint="Auto-reply so they know you got their message."
          checked={flag('autoresponder')}
          onChange={(v) => onProp('autoresponder', v)}
        />
        {flag('autoresponder') ? (
          <>
            <Field label="Confirmation subject">
              <Input
                value={str('autoresponderSubject')}
                onChange={(e) => onProp('autoresponderSubject', e.target.value)}
              />
            </Field>
            <Field label="Confirmation message">
              <Textarea
                rows={3}
                value={str('autoresponderMessage')}
                onChange={(e) => onProp('autoresponderMessage', e.target.value)}
              />
            </Field>
          </>
        ) : null}
      </InsCard>
    </>
  );
}

// ── Local card / field chrome (mirrors the inspector's own bx-* markup) ────────

function InsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="bx-card" open>
      <summary className="bx-card__head">
        <span className="bx-card__icon">
          <Icon aria-hidden />
        </span>
        <span className="bx-card__titles">
          <span className="bx-card__title">{title}</span>
        </span>
        <ChevronDown className="bx-card__chev" aria-hidden />
      </summary>
      <div className="bx-card__body">{children}</div>
    </details>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="bx-field">
      <span className="bx-field__label">{label}</span>
      {children}
      {hint ? <span className="bx-field__hint">{hint}</span> : null}
    </label>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bx-field">
      <div className="bx-row">
        <span className="bx-field__label">{label}</span>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {hint ? <span className="bx-field__hint">{hint}</span> : null}
    </div>
  );
}
