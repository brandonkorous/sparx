'use client';

import { useMemo, useState } from 'react';
import { useAutomations } from '../automations-data';
import { recipeMetaFor } from '../recipes-catalog';
import { fallbackMeta, filterRecipes, groupByGoal, isOn, type Joined } from './recipe-meta';

/** The gallery's search, state filter, and the system automations joined to their recipes. */
export function useRecipeGallery() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAutomations({
    status: 'all',
    origin: 'system',
  });

  const needle = search.trim().toLowerCase();

  const joined = useMemo<Joined[]>(() => {
    return (data ?? []).map((automation) => ({
      automation,
      meta: recipeMetaFor(automation.name) ?? fallbackMeta(automation),
    }));
  }, [data]);

  const filtered = useMemo(() => filterRecipes(joined, needle, state), [joined, needle, state]);

  const grouped = useMemo(() => groupByGoal(filtered), [filtered]);

  const filtering = needle !== '' || state !== 'all';
  const onCount = joined.filter(({ automation }) => isOn(automation.status)).length;

  return {
    ...{ search, setSearch, state, setState },
    ...{ data, isPending, isError, isFetching, dataUpdatedAt, refetch },
    ...{ joined, grouped, filtering, onCount },
  };
}

export type RecipeGallery = ReturnType<typeof useRecipeGallery>;
