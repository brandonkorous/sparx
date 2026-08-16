'use client';

// Building the address the preview pane shows.
//
// A short-lived preview token is what lets the storefront serve the DRAFT instead of
// what is published. In the old editor that address opened in a new tab, which put
// the token in an address bar, in browser history, and one keystroke from being
// pasted into a chat. Held inside a pane it stays where it was issued.
//
// The token is minted per preview, never cached: it expires in an hour, and a stale
// one renders the published site while claiming to be a preview — which is the worst
// possible failure for a screen whose whole job is showing unsaved work.

import { useMutation } from '@sparx/query';
import { recordAddressAt, recordPreviewPath } from '@sparx/silica-catalog';
import { api } from '../api/client';
import type { SitePreviewTarget } from '../../surfaces/builder/studio/data';

export type { SitePreviewTarget };

/**
 * The path a page previews at.
 *
 * A collection template has no address of its own — it renders once per record — so
 * it previews at ONE sample record's address. Previewing it at its own bare slug
 * would 404, which reads as a broken page rather than as a template.
 */
export function previewPath(
  slug: string | null | undefined,
  samples: Record<string, string> | undefined
): string {
  const address = recordAddressAt(slug);
  if (address) return recordPreviewPath(address, samples);
  const bare = (slug ?? '').trim().replace(/^\/+/, '');
  return bare === '' ? '/' : `/${bare}`;
}

/** The full draft-preview address, or null when the site has no web address yet. */
export function previewUrl(
  target: SitePreviewTarget | null,
  token: string,
  path: string
): string | null {
  if (!target) return null;
  return `${target.origin}${path}?sparxSitePreview=${encodeURIComponent(token)}${target.extraQuery}`;
}

/** Mint a fresh preview token. */
export function useMintPreviewToken() {
  return useMutation({
    mutationFn: () => api.get<{ token: string }>('/v1/builder/preview-token'),
  });
}

/** A pre-send check on an email, as the server graded it. */
export interface EmailCheck {
  id: string;
  level: 'pass' | 'warning' | 'error';
  title: string;
  detail: string;
}

/** The email as a recipient gets it — rendered server-side, in this site's brand. */
export interface EmailPreview {
  subject: string;
  html: string;
  text: string;
  checks: EmailCheck[];
  /** Dark-mode overrides, empty when the brand has no dark palette. */
  darkCss: string;
}

/** Render the SAVED draft of one email. On demand, not a live query: it reflects
 *  what is stored, so asking for it before a save would show the previous words. */
export function useRenderEmail() {
  return useMutation({
    mutationFn: (emailId: string) =>
      api.get<EmailPreview>(`/v1/builder/emails/${encodeURIComponent(emailId)}/preview`),
  });
}
