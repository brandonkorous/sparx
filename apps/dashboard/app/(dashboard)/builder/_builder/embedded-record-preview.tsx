'use client';

// The embedded record preview (docs/51 §6) — a content entry rendered LIVE through
// its collection template, on the SAME Canvas the builder uses, so the CMS entry
// editor's preview is literally what ships (preview == production). The CMS module
// embeds this; the builder owns it, because it owns the Canvas, its CSS, and the
// binding internals.
//
// It speaks to the editor in FIELD KEYS, not node ids: clicking a bound node calls
// `onPickField(fieldKey)` and the editor focuses that form field; the editor passes
// back the focused field as `selectedFieldKey` and this highlights its node. That
// keeps the form (CMS-owned) and the canvas (builder-owned) cleanly decoupled.
//
// Read-only: no `onMove`, so the canvas never reorders the template here. The
// template is edited in the builder; this is a window onto it bound to one record.

import * as React from 'react';
import type { BindingCatalog, ComponentDto } from '@sparx/builder-schemas';

// The base canvas sheet (.bx-* chrome + the `.bx-canvas` theme host) and the
// Surface RECIPE (@sparx/site-ui's `st-*` classes pre-scoped to `.bx-canvas`), so
// the embedded canvas paints exactly like /builder/studio (docs/47 §5).
import '../builder.css';
import '@sparx/site-ui/styles.canvas.css';

import { Canvas, type CanvasFrame } from './canvas';
import { useSurfacePreview } from './use-surface-preview';
import { useComponentVersions } from './use-component-versions';
import type { BuilderNode, Device } from './model';
import type { SitePreviewData } from './binding-catalog';
import { buildNodeFieldMaps, buildRecordPreviewData, fieldKeySet } from './record-preview-data';

export interface EmbeddedRecordPreviewProps {
  /** The collection template the entry renders through (the chosen/default page). */
  tree: BuilderNode;
  /** The active site layout (header / outlet / footer). When set, the template is
   *  framed inside it — the FULL page the storefront ships — rendered as a locked
   *  backdrop so only the content (at the Outlet) drives the click-to-edit bridge. */
  chrome?: BuilderNode | null;
  catalog: BindingCatalog;
  /** The tenant's saved components — so a `custom:*` placement in the template (or
   *  chrome) renders live exactly like the studio, not a "missing" marker. */
  components: ComponentDto[];
  /** The content type key — the record source the template binds (`<typeKey>.*`). */
  typeKey: string;
  /** The entry's LIVE in-editor body (re-renders the preview on each keystroke). */
  body: Record<string, unknown>;
  tenantSlug: string;
  /** Real site chrome (brand identity + social) so the header/footer match live. */
  sitePreview: SitePreviewData | null;
  /** The active site origin + the entry's path, for the browser frame's address bar. */
  siteOrigin: string;
  path: string;
  device: Device;
  /** The field currently focused in the form → its node is highlighted. */
  selectedFieldKey: string | null;
  /** A bound node was clicked (its field key), or the canvas was cleared (null). */
  onPickField: (key: string | null) => void;
}

export function EmbeddedRecordPreview({
  tree,
  chrome,
  catalog,
  components,
  typeKey,
  body,
  tenantSlug,
  sitePreview,
  siteOrigin,
  path,
  device,
  selectedFieldKey,
  onPickField,
}: EmbeddedRecordPreviewProps) {
  const fieldKeys = React.useMemo(() => fieldKeySet(catalog, typeKey), [catalog, typeKey]);
  const maps = React.useMemo(
    () => buildNodeFieldMaps(tree, typeKey, fieldKeys),
    [tree, typeKey, fieldKeys]
  );

  // Live-compile the authored Tailwind-native utilities for the WHOLE visible stack
  // (site chrome + the entry's template), @scope-d to `.bx-canvas` — the exact step
  // the studio runs (useSurfacePreview over its combined tree). Without it the canvas
  // gets only the static recipe sheet, so authored layout utilities (grid/gap/padding
  // /max-w/alignment) never paint and sections collapse to default block flow — i.e.
  // the preview wouldn't render as it does in the builder. A synthetic root over both
  // trees covers header/footer + content in one compile.
  const compileTree = React.useMemo<BuilderNode>(
    () => ({
      id: '__cms_preview_combined',
      type: 'Section',
      props: {},
      children: [...(chrome ? [chrome] : []), tree],
    }),
    [chrome, tree]
  );
  const previewCss = useSurfacePreview(compileTree);
  // The resolver root, rebuilt as the body changes — this is the "live" in live preview.
  const data = React.useMemo(
    () => buildRecordPreviewData(catalog, typeKey, body, tenantSlug, sitePreview),
    [catalog, typeKey, body, tenantSlug, sitePreview]
  );

  // Tenant components keyed for the canvas (docs/53 P-B) + the version resolver that
  // expands each `custom:*` placement at its pinned version — the same pair the studio
  // passes, so a component-bearing template previews faithfully here too.
  const componentsByKey = React.useMemo(
    () => new Map(components.map((c) => [c.key, c])),
    [components]
  );
  const resolveVersion = useComponentVersions(componentsByKey, compileTree);

  const selectedId = selectedFieldKey ? (maps.fieldToNode.get(selectedFieldKey) ?? null) : null;
  const frame: CanvasFrame = { kind: 'browser', origin: siteOrigin, path };

  const handleSelect = React.useCallback(
    (id: string | null) => {
      onPickField(id ? (maps.nodeToField.get(id) ?? null) : null);
    },
    [maps, onPickField]
  );

  return (
    <>
      {previewCss ? <style dangerouslySetInnerHTML={{ __html: previewCss }} /> : null}
      <Canvas
        tree={tree}
        chrome={chrome ?? null}
        data={data}
        catalog={catalog}
        components={componentsByKey}
        resolveVersion={resolveVersion}
        device={device}
        selectedId={selectedId}
        onSelect={handleSelect}
        frame={frame}
      />
    </>
  );
}
