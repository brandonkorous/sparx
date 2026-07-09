'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, FieldStatus, Textarea } from '@wizeworks/silicaui-react';

import { updateTemplateAction } from '../../../configurator-actions';

interface InitialPayload {
  name: string;
  description?: string;
  layout: unknown;
  options: unknown[];
  rules: unknown[];
  addOns: unknown[];
}

export function TemplateJsonEditor({
  templateId,
  initial,
}: {
  templateId: string;
  initial: InitialPayload;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [json, setJson] = React.useState<string>(() => JSON.stringify(initial, null, 2));

  function onSave() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      return;
    }
    startTransition(async () => {
      const result = await updateTemplateAction(templateId, parsed);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={20}
        className="font-mono text-xs"
      />
      {error && (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {error}
        </FieldStatus>
      )}
      <div className="flex flex-row justify-end gap-2">
        <Button color="module" type="button" disabled={pending} onClick={onSave}>
          {pending ? 'Saving…' : 'Save definition'}
        </Button>
      </div>
    </div>
  );
}
