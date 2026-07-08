'use client';

import * as React from 'react';
import { Code } from '@sparx/ui';
import { Badge, Button, Input, Label, Select } from 'silicaui-react';
import { sendTestEmail, type DevLastSend, type TestSendResult } from './actions';

export interface TestSendFormProps {
  devLastSend: DevLastSend;
}

export function TestSendForm({ devLastSend }: TestSendFormProps) {
  const [template, setTemplate] = React.useState<'welcome-merchant' | 'password-reset'>(
    'welcome-merchant'
  );
  const [result, setResult] = React.useState<TestSendResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="to">Recipient</Label>
            <Input id="to" name="to" type="email" defaultValue="dev@example.test" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template">Template</Label>
            <Select
              id="template"
              value={template}
              onValueChange={(v) => setTemplate(v as 'welcome-merchant' | 'password-reset')}
              items={{
                'welcome-merchant': 'Welcome (tenant)',
                'password-reset': 'Password reset',
              }}
            />
          </div>
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
          <p className="text-base-content/70 text-xs">
            id <Code>{result.send.id}</Code> · via <Code>{result.send.provider}</Code> ·{' '}
            {new Date(result.send.acceptedAt).toLocaleString()}
          </p>
        </div>
      )}

      {result && !result.ok && (
        <p className="text-danger text-sm" role="alert" aria-live="polite">
          {result.error ?? 'Send failed.'}
        </p>
      )}

      {devLastSend.enabled && devLastSend.send && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">Last dev send</p>
          <p className="text-base-content/70 text-xs">
            <Code>{devLastSend.send.template ?? 'unknown'}</Code> → {devLastSend.send.to} ·{' '}
            {new Date(devLastSend.send.acceptedAt).toLocaleString()}
          </p>
          <p className="text-base-content/70 text-xs">Subject: {devLastSend.send.subject}</p>
        </div>
      )}
    </div>
  );
}
