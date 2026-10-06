'use client';

// This site's cookie banner: GET/PATCH /v1/tenant/consent, scoped to the active
// site by the `x-sparx-property-id` header the api client already sends.
// `visitorView` mirrors `computeBannerEnabled` in api-rest's lib/consent.ts.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { LEGAL_QUERY_ROOT } from './data';

export type CookieBannerMode = 'off' | 'gdpr' | 'ccpa';

/** The optional kinds. "Strictly necessary" is always on, so it is not one. */
export type CookieKind = 'preferences' | 'analytics' | 'marketing';

export const COOKIE_KINDS: readonly CookieKind[] = ['preferences', 'analytics', 'marketing'];

/** Exactly as `serializeConsent` in api-rest's tenant routes returns it. */
export interface CookieBannerSettings {
  mode: CookieBannerMode;
  activeCategories: string[];
  bannerTitle: string | null;
  bannerBody: string | null;
  policyPageSlug: string;
  policyVersion: string;
  bannerEnabled: boolean;
}

// No `policyVersion`: a visitor's saved answer carries no version, so bumping it
// re-asks nobody (wizeworks/apps/site/lib/consent.ts).
export interface CookieBannerPatch {
  mode: CookieBannerMode;
  activeCategories: CookieKind[];
  bannerTitle: string | null;
  bannerBody: string | null;
  policyPageSlug?: string;
}

export const cookieBannerKeys = {
  settings: () => [...LEGAL_QUERY_ROOT, 'cookie-banner'] as const,
};

export function useCookieBanner() {
  return useQuery({
    queryKey: cookieBannerKeys.settings(),
    queryFn: () => api.get<CookieBannerSettings>('/v1/tenant/consent'),
  });
}

export function useSaveCookieBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: CookieBannerPatch) =>
      api.patch<CookieBannerSettings>('/v1/tenant/consent', patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(cookieBannerKeys.settings(), saved);
      void queryClient.invalidateQueries({ queryKey: cookieBannerKeys.settings() });
    },
  });
}

/** What the site shows when a box is left empty (consent-manager.tsx). */
export const DEFAULT_BANNER_TITLE = 'We value your privacy';
export const DEFAULT_BANNER_BODY =
  'We use cookies to run this site and, with your consent, to improve it.';

/** Word for word what visitors read beside each kind (CATEGORY_COPY in
 *  consent-manager.tsx), so the owner ticks what her visitors are shown. */
export const COOKIE_KIND_COPY: Record<CookieKind, { label: string; visitorReads: string }> = {
  preferences: {
    label: 'Preferences',
    visitorReads: 'Remember choices like language and light/dark mode.',
  },
  analytics: {
    label: 'Analytics',
    visitorReads: 'Help us understand how the site is used so we can improve it.',
  },
  marketing: {
    label: 'Marketing',
    visitorReads: 'Used to deliver and measure relevant offers.',
  },
};

export type VisitorView = 'nothing' | 'button' | 'banner';

/** Off renders nothing; on with no optional kind is a corner button; on with
 *  one or more is a banner. */
export function visitorView(mode: CookieBannerMode, kinds: readonly string[]): VisitorView {
  if (mode === 'off') return 'nothing';
  return kinds.some((kind) => (COOKIE_KINDS as readonly string[]).includes(kind))
    ? 'banner'
    : 'button';
}

/** The words on the small corner button, which differ by approach. */
export function cornerButtonLabel(mode: CookieBannerMode): string {
  return mode === 'ccpa' ? 'Do Not Sell or Share My Info' : 'Manage cookies';
}

/** The starter Cookie Policy promises a banner or a cookie button, so a
 *  published one with the banner off is untrue. Silent until the read lands. */
export function cookiePolicyNote(
  legalKind: string,
  entryStatus: string | null,
  settings: CookieBannerSettings | undefined
): string | null {
  if (legalKind !== 'cookie-policy' || entryStatus !== 'published') return null;
  if (settings?.mode !== 'off') return null;
  return 'This page tells visitors about a cookie banner your site does not show yet: turn one on under Cookie banner below.';
}
