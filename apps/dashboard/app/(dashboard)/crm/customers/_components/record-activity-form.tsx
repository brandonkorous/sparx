'use client';

// Manual activity recorder.
//
// Used in the customer detail right rail (and later in the deal detail page).
// Submits via the recordActivityAction Server Action, which routes through
// activityService.record — the single write path that fires the
// crm.activity.recorded event consumers also use.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { recordActivityAction } from '../../actions';

type ActivityKind = 'note' | 'call' | 'meeting';

const KIND_LABELS: Record<ActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  meeting: 'Meeting',
};

interface Props {
  customerId?: string;
  dealId?: string;
}

export function RecordActivityForm({ customerId, dealId }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<ActivityKind>('note');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const v = useFieldValidation(
    { description },
    { description: rule.required('Description is required.') }
  );

  function onSubmit(formData: FormData) {
    setError(null);
    if (!v.validate()) return;
    const desc = (formData.get('description') as string | null)?.trim() ?? '';
    startTransition(async () => {
      const result = await recordActivityAction({
        type: kind,
        description: desc,
        actorType: 'staff',
        ...(customerId ? { customerId } : {}),
        ...(dealId ? { dealId } : {}),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDescription('');
      router.refresh();
    });
  }

  return (
    <form action={onSubmit}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row gap-1">
          {(Object.keys(KIND_LABELS) as ActivityKind[]).map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              color={k === kind ? 'module' : 'neutral'}
              variant={k === kind ? 'solid' : 'outline'}
              onClick={() => setKind(k)}
            >
              {KIND_LABELS[k]}
            </Button>
          ))}
        </div>

        <Field {...v.field('description')}>
          <FieldLabel required>Description</FieldLabel>
          <FieldControl
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            {...v.control('description')}
            render={
              <Textarea
                rows={3}
                placeholder={
                  kind === 'call'
                    ? 'Summary of the call…'
                    : kind === 'meeting'
                      ? 'Meeting notes…'
                      : 'Add a note…'
                }
              />
            }
          />
        </Field>

        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}

        <Button type="submit" color="module" disabled={pending}>
          {pending ? 'Saving…' : 'Add activity'}
        </Button>
      </div>
    </form>
  );
}
