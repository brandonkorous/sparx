'use client';

import * as React from 'react';
import { Code } from '@sparx/ui';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Select,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { sendTestEmail, type DevLastSend, type TestSendResult } from './actions';

export interface TestSendFormProps {
  devLastSend: DevLastSend;
}

export function TestSendForm({ devLastSend }: TestSendFormProps) {
  const [to, setTo] = React.useState('dev@example.test');
  const [template, setTemplate] = React.useState<'welcome-merchant' | 'password-reset'>(
    'welcome-merchant'
  );
  const [result, setResult] = React.useState<TestSendResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation(
    { to },
    { to: rules(rule.required('Enter a recipient address.'), rule.email()) }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    if (!v.validate()) return;
    const formData = new FormData(e.currentTarget);
    formData.set('template', template);

    startTransition(async () => {
      const r = await sendTestEmail(formData);
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <Field {...v.field('to')}>
            <FieldLabel required>Recipient</FieldLabel>
            <FieldControl
              name="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              {...v.control('to')}
            />
          </Field>
          <Field>
            <FieldLabel>Template</FieldLabel>
            <Select
              id="template"
              value={template}
              onValueChange={(val) => setTemplate(val as 'welcome-merchant' | 'password-reset')}
              items={{
                'welcome-merchant': 'Welcome (tenant)',
                'password-reset': 'Password reset',
              }}
            />
          </Field>
          <div className="flex flex-row gap-2">
            <Button type="submit" color="module" disabled={pending} loading={pending}>
              Send test
            </Button>
          </div>
        </div>
      </form>

      {result?.ok && result.send && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <Badge color="success">Accepted</Badge>
            <p className="text-sm">
              <Code>{result.send.templateId}</Code> → {result.send.to}
            </p>
          </div>
          <p className="text-base-content text-xs">
            id <Code>{result.send.id}</Code> · via <Code>{result.send.provider}</Code> ·{' '}
            {new Date(result.send.acceptedAt).toLocaleString()}
          </p>
        </div>
      )}

      {result && !result.ok && (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {result.error ?? 'Send failed.'}
        </FieldStatus>
      )}

      {devLastSend.enabled && devLastSend.send && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">Last dev send</p>
          <p className="text-base-content text-xs">
            <Code>{devLastSend.send.templateId ?? 'unknown'}</Code> → {devLastSend.send.to} ·{' '}
            {new Date(devLastSend.send.acceptedAt).toLocaleString()}
          </p>
          <p className="text-base-content text-xs">Subject: {devLastSend.send.subject}</p>
          {devLastSend.send.text && (
            <p className="text-base-content text-xs">
              Plain-text body:{' '}
              <Code>
                {devLastSend.send.text.slice(0, 120)}
                {devLastSend.send.text.length > 120 ? '…' : ''}
              </Code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
