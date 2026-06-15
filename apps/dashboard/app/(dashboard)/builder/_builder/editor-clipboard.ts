// The Builder clipboard codec (docs/builder/05 §2.5). Copy serializes a node (or
// a multi-node selection) to JSON; paste reads it back as fresh subtrees. The
// single-node form is a BARE node tree — byte-for-byte the same shape the
// Import/Export path accepts (docs/47, import-export.ts) — so a copied block can
// be pasted into a fresh tab OR dropped into the Import field, one path (the doc's
// §5 "system-clipboard JSON must match the import/export schema"). A multi-node
// copy uses a thin `clipboard` envelope whose members are each that same bare-node
// shape.
//
// Paste always regenerates ids (cloneWithFreshIds) so a pasted block can coexist
// with its source in the same tree and never collides with the target's ids —
// the validation + intra-tree dedupe comes free from parsePageImport.

import { parsePageImport } from '@sparx/builder-schemas';
import { cloneWithFreshIds, type BuilderNode } from './model';

/** Tag shared with the Import/Export documents (import-export.ts). */
const CLIP_FORMAT = 'sparx.builder/v1';

interface ClipboardEnvelope {
  format: typeof CLIP_FORMAT;
  type: 'clipboard';
  nodes: BuilderNode[];
}

/** Serialize a copied selection. One node → a bare node tree (import-compatible);
 *  many → a `clipboard` envelope of bare nodes. Pretty-printed so the system
 *  clipboard holds human-/agent-readable JSON. Returns '' for an empty selection. */
export function serializeClipboard(nodes: readonly BuilderNode[]): string {
  if (nodes.length === 0) return '';
  if (nodes.length === 1) return JSON.stringify(nodes[0], null, 2);
  const envelope: ClipboardEnvelope = { format: CLIP_FORMAT, type: 'clipboard', nodes: [...nodes] };
  return JSON.stringify(envelope, null, 2);
}

function isClipboardEnvelope(v: unknown): v is ClipboardEnvelope {
  return (
    Boolean(v) &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    (v as { type?: unknown }).type === 'clipboard' &&
    Array.isArray((v as { nodes?: unknown }).nodes)
  );
}

/** Parse clipboard text into ready-to-insert subtrees with all-fresh ids. Accepts
 *  our multi-node envelope, a bare node, OR a full Builder document (page/layout/
 *  email) — so pasting an exported page's JSON works too. Returns null when the
 *  text isn't valid JSON or doesn't validate as Builder content. */
export function parseClipboard(text: string): BuilderNode[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  if (isClipboardEnvelope(data)) {
    const out: BuilderNode[] = [];
    for (const raw of data.nodes) {
      const parsed = parsePageImport(raw); // a bare node validates + dedupes intra-node ids
      if (!parsed.ok) return null;
      out.push(cloneWithFreshIds(parsed.tree));
    }
    return out.length > 0 ? out : null;
  }

  // A bare node or a full document envelope → one subtree.
  const parsed = parsePageImport(data);
  if (!parsed.ok) return null;
  return [cloneWithFreshIds(parsed.tree)];
}
