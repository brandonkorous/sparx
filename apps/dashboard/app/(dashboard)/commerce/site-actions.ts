'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type {
  UpdateCommerceSiteSettingsInput,
  UpdateCommerceSiteThemeInput,
} from '@sparx/commerce-schemas';
import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

export async function updateCommerceSiteSettingsAction(
  input: UpdateCommerceSiteSettingsInput
): Promise<ActionResult<void>> {
  return restAction(async () => {
    await api.patch<{ updated: boolean }>('/v1/commerce/site/settings', input);
    revalidatePath('/commerce/settings');
  });
}

export async function updateCommerceSiteThemeAction(
  input: UpdateCommerceSiteThemeInput
): Promise<ActionResult<void>> {
  return restAction(async () => {
    await api.patch<{ updated: boolean }>('/v1/commerce/site/theme', input);
    revalidatePath('/commerce/settings');
  });
}
