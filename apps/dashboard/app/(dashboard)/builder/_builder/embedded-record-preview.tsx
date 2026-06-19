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
import type { BindingCatalog } from '@sparx/builder-schemas';

// The base canvas sheet (.bx-* chrome + the `.bx-canvas` theme host) and the
// Surface RECIPE (@sparx/site-ui's `st-*` classes pre-scoped to `.bx-canvas`), so
// the embedded canvas paints exactly like /builder/studio (docs/47 §5).
import '../builder.css';
import '@sparx/site-ui/styles.canvas.css';

import { Canvas, type CanvasFrame } from './canvas';
import type { BuilderNode, Device } from './model';
import type { SitePreviewData } from './binding-catalog';
import { buildNodeFieldMaps, buildRecordPreviewData, fieldKeySet } from './record-preview-data';

export interface EmbeddedRecordPreviewProps {
  /** The collection template the entry renders through (the chosen/default page). */
  tree: BuilderNode;
  catalog: BindingCatalog;
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
  catalog,
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
  // The resolver root, rebuilt as the body changes — this is the "live" in live preview.
  const data = React.useMemo(
    () => buildRecordPreviewData(catalog, typeKey, body, tenantSlug, sitePreview),
    [catalog, typeKey, body, tenantSlug, sitePreview]
  );

  const selectedId = selectedFieldKey ? (maps.fieldToNode.get(selectedFieldKey) ?? null) : null;
  const frame: CanvasFrame = { kind: 'browser', origin: siteOrigin, path };

  const handleSelect = React.useCallback(
    (id: string | null) => {
      onPickField(id ? (maps.nodeToField.get(id) ?? null) : null);
    },
    [maps, onPickField]
  );

  return (
    <Canvas
      tree={tree}
      data={data}
      catalog={catalog}
      device={device}
      selectedId={selectedId}
      onSelect={handleSelect}
      frame={frame}
    />
  );
}
