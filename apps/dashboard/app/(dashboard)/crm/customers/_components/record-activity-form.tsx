'use client';

// Manual activity recorder.
//
// Used in the customer detail right rail (and later in the deal detail page).
// Submits via the recordActivityAction Server Action, which routes through
// activityService.record — the single write path that fires the
// crm.activity.recorded event consumers also use.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Label, Textarea } from 'silicaui-react';

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

  function onSubmit(formData: FormData) {
    setError(null);
    const desc = (formData.get('description') as string | null)?.trim() ?? '';
    if (!desc) {
      setError('Description is required.');
      return;
    }
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

        <div className="flex flex-col gap-1">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder={
              kind === 'call'
                ? 'Summary of the call…'
                : kind === 'meeting'
                  ? 'Meeting notes…'
                  : 'Add a note…'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
          />
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}

        <Button type="submit" color="module" disabled={pending}>
          {pending ? 'Saving…' : 'Add activity'}
        </Button>
      </div>
    </form>
  );
}
