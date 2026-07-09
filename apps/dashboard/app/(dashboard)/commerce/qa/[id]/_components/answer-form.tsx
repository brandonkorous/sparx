'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Field, FieldControl, Textarea } from '@wizeworks/silicaui-react';

import { rule, useFieldValidation } from '@sparx/forms';

import { submitOfficialAnswerAction } from '../../../review-actions';

export function AnswerForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation({ body }, { body: rule.required('Answer cannot be empty.') });

  function onSubmit() {
    if (!v.validate()) return;
    startTransition(async () => {
      const result = await submitOfficialAnswerAction({
        questionId,
        body: body.trim(),
        isOfficial: true,
      });
      if (!result.ok) {
        v.setServerErrors({ body: result.error.message });
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Field {...v.field('body')}>
        <FieldControl
          render={<Textarea rows={4} />}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Post an official answer as staff. The storefront pins official answers to the top."
          {...v.control('body')}
        />
      </Field>
      <div className="flex flex-row items-center justify-end gap-2">
        <Button color="module" disabled={pending} onClick={onSubmit}>
          Post staff answer
        </Button>
      </div>
    </div>
  );
}
