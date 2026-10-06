'use client';

// Core charges set up as choices (sparx persona issue 057): the products whose
// old store faked a core deposit with a choice, and the one-time job that turns
// each into one part with a real deposit.
//
// A conversion rewrites prices, retires versions and moves their photos, so it
// re-reads the products as well as this list. Cores owed is re-read too: its
// empty state points here while any of these are left.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import type { CoreChoiceCandidate, CoreChoiceConversion } from '@wizeworks/commerce-schemas';
import { api } from '../../lib/api/client';
import { CORES_KEY } from './cores-data';
import { PRODUCTS_KEY } from './products-data';
import type { CoreChoiceChange } from './core-choice-words';

export type { CoreChoiceCandidate, CoreChoiceConversion };

export const CORE_CHOICES_KEY = ['commerce', 'core-choices'];

export function useCoreChoices() {
  return useQuery({
    queryKey: CORE_CHOICES_KEY,
    queryFn: () => api.get<CoreChoiceCandidate[]>('/v1/commerce/core-choices'),
  });
}

export function useConvertCoreChoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversions: CoreChoiceChange[]) =>
      api.post<CoreChoiceConversion[]>('/v1/commerce/core-choices/convert', { conversions }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CORE_CHOICES_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CORES_KEY });
    },
  });
}
