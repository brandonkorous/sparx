// Builds the context attached to a feedback submission (docs/112 §4).
//
// The dashboard captures a ROUTE, because a dashboard page is a URL. The
// workbench has no routes — it has descriptors, and the operator is looking at
// several at once. So the honest answer to "where were you" here is the FOCUSED
// PANE: which surface, which record, which module, and which panes they passed
// through to get there.
//
// The point of all of it is that the operator never has to describe where they
// were, only what happened. Everything below is derived, never asked for.

import { getSurface, resolveTitle } from '../../lib/surfaces/registry';
import { descriptorKey, type PaneDescriptor } from '../../lib/surfaces/descriptor';
import type { FeedbackContextPayload } from '../../lib/api/feedback';

/** Prefix so a workbench submission is never mistaken for a dashboard path in
 *  the admin inbox — `workbench:invoicing.invoice?id=…`, not `/invoicing/…`. */
const PREFIX = 'workbench:';

/** The params key that names the record a surface is showing, if any. */
function entityFrom(descriptor: PaneDescriptor): { type: string; id: string } | null {
  const id = descriptor.params?.id;
  if (!id) return null;
  // The surface key's last segment is the record's kind — `invoicing.invoice`
  // is showing an invoice. Good enough to group by, which is all it's for.
  const type = descriptor.surface.split('.').pop() ?? 'record';
  return { type, id };
}

function deviceFromWidth(width: number): 'desktop' | 'tablet' | 'mobile' {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export interface BuildContextArgs {
  /** The focused pane. Null when the workbench is empty — a real state, not a bug. */
  descriptor: PaneDescriptor | null;
  theme: 'light' | 'dark';
  activeSite?: { id: string; name: string } | null;
  /** Recently focused panes, oldest → newest. */
  trail?: string[];
}

export function buildFeedbackContext({
  descriptor,
  theme,
  activeSite,
  trail,
}: BuildContextArgs): FeedbackContextPayload {
  const definition = descriptor ? getSurface(descriptor.surface) : undefined;
  const hasWindow = typeof window !== 'undefined';

  const route = descriptor ? `${PREFIX}${descriptorKey(descriptor)}` : `${PREFIX}empty`;
  // The pattern drops the params, so every submission about the invoice editor
  // groups together regardless of which invoice was open.
  const pattern = descriptor ? `${PREFIX}${descriptor.surface}` : null;

  return {
    route,
    routePattern: pattern === route ? null : pattern,
    module: definition?.module ?? null,
    section: definition?.section ?? null,
    entity: descriptor ? entityFrom(descriptor) : null,
    pageTitle: descriptor ? paneTitle(descriptor) : null,
    property: activeSite ?? null,
    trail: trail && trail.length > 0 ? trail.slice(-8) : undefined,
    viewport: hasWindow ? { width: window.innerWidth, height: window.innerHeight } : undefined,
    device: hasWindow ? deviceFromWidth(window.innerWidth) : undefined,
    theme,
    locale: hasWindow ? navigator.language : undefined,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'workbench',
    userAgent: hasWindow ? navigator.userAgent.slice(0, 500) : undefined,
  };
}

/** The focused pane's human title: the operator's own tab name if they renamed
 *  it, else the surface's registered title resolved against its params. */
export function paneTitle(descriptor: PaneDescriptor | null): string | null {
  if (!descriptor) return null;
  if (descriptor.title) return descriptor.title;
  const definition = getSurface(descriptor.surface);
  return definition ? resolveTitle(definition, descriptor.params ?? {}) : descriptor.surface;
}

/** One-line human summary for the "Sending from" panel. Reads as words the
 *  operator recognises — the pane's name — not as a surface key. */
export function summarizeContext(context: FeedbackContextPayload): string {
  const parts: string[] = [];
  if (context.pageTitle) parts.push(context.pageTitle);
  if (context.property?.name) parts.push(context.property.name);
  if (parts.length > 0) return parts.join(' · ');
  return context.route?.replace(PREFIX, '') ?? 'the workbench';
}
