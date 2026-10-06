'use client';

// The cookie banner's draft: seeded once from the read, compared against it for
// the leave-guard, and saved as one PATCH.

import { useEffect, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { apiErrorMessage } from '../../lib/api-error';
import { useActivePropertyId, useSites, useViewer } from '../../lib/api/shell-data';
import { useDirtySource } from '../../lib/workbench/dirty';
import {
  useCookieBanner,
  useSaveCookieBanner,
  type CookieBannerPatch,
  type CookieBannerSettings,
} from './cookie-banner-data';
import { orderedKinds, type CookieBannerDraft } from './cookie-banner-fields';
import type { ChecklistEntry } from './legal-data';

function toDraft(settings: CookieBannerSettings): CookieBannerDraft {
  return {
    mode: settings.mode,
    kinds: orderedKinds(settings.activeCategories),
    title: settings.bannerTitle ?? '',
    body: settings.bannerBody ?? '',
  };
}

/** Compared trimmed, because that is what is saved: spaces alone save as empty. */
function sameDraft(a: CookieBannerDraft, b: CookieBannerDraft): boolean {
  return (
    a.mode === b.mode &&
    a.kinds.join() === b.kinds.join() &&
    a.title.trim() === b.title.trim() &&
    a.body.trim() === b.body.trim()
  );
}

/** The banner links to `/<policyPageSlug>`; if the Cookie Policy page lives at
 *  another address, the link follows the page instead of leading nowhere. */
function buildPatch(
  draft: CookieBannerDraft,
  saved: CookieBannerSettings,
  policySlug: string | null
): CookieBannerPatch {
  return {
    mode: draft.mode,
    activeCategories: draft.kinds,
    bannerTitle: draft.title.trim() === '' ? null : draft.title.trim(),
    bannerBody: draft.body.trim() === '' ? null : draft.body.trim(),
    ...(policySlug && policySlug !== saved.policyPageSlug ? { policyPageSlug: policySlug } : {}),
  };
}

/** This site's name when the business has more than one, so the section can say
 *  which site it is for; undefined when there is only one. */
export function useSiteNameIfMany(): string | undefined {
  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();
  if (!sites || sites.length < 2) return undefined;
  return sites.find((site) => site.id === activeSiteId)?.name;
}

/** api-rest's PATCH requires admin or owner. `known` is false until the role is read. */
export function useCanEditCookieBanner(): { known: boolean; canEdit: boolean } {
  const { data: viewer } = useViewer();
  if (!viewer) return { known: false, canEdit: false };
  return { known: true, canEdit: viewer.role === 'owner' || viewer.role === 'admin' };
}

export function useCookieBannerEditor(policyEntry: ChecklistEntry | null) {
  const toast = useToast();
  const settings = useCookieBanner();
  const save = useSaveCookieBanner();
  const [draft, setDraft] = useState<CookieBannerDraft | null>(null);
  const data = settings.data;
  // Seed once: a background refetch must not throw away a half-made choice.
  useEffect(() => {
    if (data && draft === null) setDraft(toDraft(data));
  }, [data, draft]);

  const saved = data ? toDraft(data) : null;
  const dirty = draft !== null && saved !== null && !sameDraft(draft, saved);
  useDirtySource(dirty, 'Your cookie banner changes are not saved. Close anyway?');
  // Only the approach or the kinds change what visitors see; a reworded title does not.
  const viewChanged =
    draft !== null &&
    saved !== null &&
    (draft.mode !== saved.mode || draft.kinds.join() !== saved.kinds.join());

  const onSave = () => {
    if (!draft || !data) return;
    save.mutate(buildPatch(draft, data, policyEntry?.slug ?? null), {
      onSuccess: (result) => {
        setDraft(toDraft(result));
        toast.add({
          title: 'Cookie banner saved',
          description: 'Your site shows the change within about five minutes.',
          type: 'success',
        });
      },
    });
  };

  const failure = save.isError
    ? apiErrorMessage(save.error, 'Could not save the cookie banner. Nothing was changed.')
    : null;
  return { settings, draft, setDraft, dirty, viewChanged, onSave, saving: save.isPending, failure };
}
