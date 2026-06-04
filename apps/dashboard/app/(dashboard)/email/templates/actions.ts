'use server';

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from '../_lib/rest-action';
import { restAction } from '../_lib/rest-action';
import type { BuiltinTemplateView } from '../_lib/types';

export async function saveBuiltinOverrideAction(
  key: string,
  input: unknown
): Promise<ActionResult<BuiltinTemplateView>> {
  return restAction(async () => {
    const view = await api.patch<BuiltinTemplateView>(`/v1/email/templates/builtin/${key}`, input);
    revalidatePath('/email/templates');
    revalidatePath(`/email/templates/builtin/${key}`);
    return view;
  });
}

interface TestSendResult {
  id: string;
  provider: string;
}

export async function testSendBuiltinAction(
  key: string,
  to: string
): Promise<ActionResult<TestSendResult>> {
  return restAction(() =>
    api.post<TestSendResult>(`/v1/email/templates/builtin/${key}/test-send`, { to })
  );
}
