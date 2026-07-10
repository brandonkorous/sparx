'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { Button, FieldStatus, Textarea } from '@wizeworks/silicaui-react';
import { AdaptiveLabel } from '@sparx/ui';

import { updateTemplateAction } from '../../../configurator-actions';
import { DetailFooterSlot } from '../../../../_components/detail-header-slot';

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
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const initialJson = React.useMemo(() => JSON.stringify(initial, null, 2), [initial]);
  const [json, setJson] = React.useState<string>(initialJson);
  const dirty = json !== initialJson;

  function onSave() {
    setError(null);
    setSavedAt(null);
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
      setSavedAt(Date.now());
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

      {/* The primary action teleports up into the shared detail chrome's
          footer, not floored at the bottom of the page. */}
      <DetailFooterSlot>
        <div className="flex items-center gap-2">
          {savedAt !== null && !dirty && (
            <span className="text-success flex items-center gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            color="module"
            size="sm"
            type="button"
            disabled={pending || !dirty}
            loading={pending}
            onClick={onSave}
          >
            <AdaptiveLabel label={{ full: 'Save definition', short: 'Save' }} />
          </Button>
        </div>
      </DetailFooterSlot>
    </div>
  );
}
