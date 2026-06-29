// Builds the captured client context (docs/112 §4) attached to a feedback
// submission. Pure + client-only (reads window/navigator/document); guarded so a
// stray server render can't throw. The module/section come from the same
// manifest resolution the breadcrumb uses, so "where the user was" is exact.

import { getManifestForPath, findSectionByPath } from '../../_shell/registry';
import type { FeedbackContextPayload } from '../../_shell/feedback-types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_RE = /^\d{2,}$/;

function isIdSegment(seg: string): boolean {
  return UUID_RE.test(seg) || NUMERIC_ID_RE.test(seg);
}

/** Replace id-like path segments with `[id]` so submissions group by surface. */
function deriveRoutePattern(pathname: string): string {
  return (
    '/' +
    pathname
      .split('/')
      .filter(Boolean)
      .map((seg) => (isIdSegment(seg) ? '[id]' : seg))
      .join('/')
  );
}

/** Best-effort: the first id-like segment + the segment before it as a type. */
function detectEntity(pathname: string): { type: string; id: string } | null {
  const segs = pathname.split('/').filter(Boolean);
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i];
    if (seg && isIdSegment(seg)) {
      const type = segs[i - 1] ?? 'record';
      return { type, id: seg };
    }
  }
  return null;
}

function deviceFromWidth(width: number): 'desktop' | 'tablet' | 'mobile' {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export interface BuildContextArgs {
  pathname: string;
  theme: 'light' | 'dark';
  activeProperty?: { id: string; name: string } | null;
  /** Recent generic locations, oldest → newest (the provider tracks these). */
  trail?: string[];
}

export function buildFeedbackContext({
  pathname,
  theme,
  activeProperty,
  trail,
}: BuildContextArgs): FeedbackContextPayload {
  const manifest = getManifestForPath(pathname);
  const section = findSectionByPath(pathname);
  const hasWindow = typeof window !== 'undefined';
  const pattern = deriveRoutePattern(pathname);

  return {
    route: pathname,
    routePattern: pattern === pathname ? null : pattern,
    module: manifest?.id ?? null,
    section: section?.id ?? null,
    entity: detectEntity(pathname),
    pageTitle: hasWindow ? document.title : null,
    property: activeProperty ?? null,
    trail: trail && trail.length > 0 ? trail.slice(-8) : undefined,
    viewport: hasWindow ? { width: window.innerWidth, height: window.innerHeight } : undefined,
    device: hasWindow ? deviceFromWidth(window.innerWidth) : undefined,
    theme,
    locale: hasWindow ? navigator.language : undefined,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    userAgent: hasWindow ? navigator.userAgent.slice(0, 500) : undefined,
  };
}

/** One-line human summary of the context for the modal's read-only chip. */
export function summarizeContext(ctx: FeedbackContextPayload): string {
  const parts: string[] = [];
  const manifest = ctx.module ? getManifestForPath(ctx.route ?? '') : null;
  if (manifest) parts.push(manifest.label);
  else if (ctx.module) parts.push(ctx.module);
  const section = findSectionByPath(ctx.route ?? '');
  if (section) parts.push(section.label);
  if (ctx.entity)
    parts.push(ctx.entity.id.length > 12 ? `${ctx.entity.id.slice(0, 8)}…` : ctx.entity.id);
  if (parts.length === 0 && ctx.route) return ctx.route;
  return parts.join(' › ');
}
