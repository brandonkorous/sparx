'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Field, FieldControl, Textarea } from '@wizeworks/silicaui-react';

import { rule, useFieldValidation } from '@sparx/forms';

import { respondToReviewAction } from '../../../review-actions';

export function RespondForm({
  reviewId,
  initial,
  respondedAt,
}: {
  reviewId: string;
  initial: string | null;
  respondedAt: string | null;
}) {
  const router = useRouter();
  const [response, setResponse] = React.useState(initial ?? '');
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);

  const v = useFieldValidation(
    { response },
    { response: rule.required('Response cannot be empty.') }
  );

  function onSave() {
    if (!v.validate()) return;
    setSaved(false);
    startTransition(async () => {
      const result = await respondToReviewAction({ reviewId, response: response.trim() });
      if (!result.ok) {
        v.setServerErrors({ response: result.error.message });
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field {...v.field('response')}>
        <FieldControl
          render={<Textarea rows={5} />}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Thanks for the feedback — we'll send out a replacement set right away."
          {...v.control('response')}
        />
      </Field>
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-0">
          {respondedAt && (
            <p className="text-base-content text-xs">
              Last response: {new Date(respondedAt).toLocaleString()}
            </p>
          )}
          {saved && (
            <p className="text-success text-xs" role="status" aria-live="polite">
              Saved
            </p>
          )}
        </div>
        <Button color="module" disabled={pending} onClick={onSave}>
          {initial ? 'Update response' : 'Post response'}
        </Button>
      </div>
    </div>
  );
}
