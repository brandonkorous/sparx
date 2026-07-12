'use client';

// The CMS media library, bridged into the silica email inspector (docs/120 A2).
//
// silica's `EmailBuilderHost` has no `pickAsset` — its image / video / background
// fields are plain URL inputs, unlike the site builder's asset-picker-integrated
// ones. But it DOES expose `inspectorPanels()`, whose `ctx.update()` writes through
// the engine's OWN mutation path (never a second node-mutation API), so the library
// bridges in as an additive host panel rather than an upstream engine change.
//
// This is not cosmetic parity: asking someone to paste an image URL is a technical
// act, and the people authoring these emails are business owners, not developers.

import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import type {
  EmailBuilderHost,
  EmailInspectorPanel,
  EmailInspectorPanelCtx,
} from '@wizeworks/silicaui-builder/email/react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@sparx/ui';

/** Opens the media library; settles with the chosen asset, or null if cancelled. The
 *  studio owns the dialog and hands this promise bridge down. It takes no `kind` (the
 *  site host's does): every asset field in an email is an image — even a video block's
 *  is a still thumbnail, since no client plays inline video. */
export type PickAsset = () => Promise<{ url: string; alt?: string } | null>;

/** How a node kind exposes an asset — what to call it, what it currently holds, and
 *  how to write a picked asset onto it. Null for every other kind, in which case the
 *  panel simply doesn't appear. The three asset-bearing kinds in silica's closed
 *  email schema are `image` (src), `video` (thumbnail) and `section` (bgImage). */
interface AssetField {
  title: string;
  current: string;
  /** A background image is optional, so it can be taken back off; an `image` node's
   *  src is the node's whole reason to exist, so it can only be replaced. */
  clearable: boolean;
  patch(asset: { url: string; alt?: string }): Record<string, unknown>;
  clear: Record<string, unknown>;
}

function assetFieldOf(node: EmailNode): AssetField | null {
  switch (node.kind) {
    case 'image':
      return {
        title: 'Image',
        current: node.src,
        clearable: false,
        // Carry the library's alt text across — but never over alt the author
        // already wrote themselves.
        patch: (a) => ({ src: a.url, ...(a.alt && !node.alt ? { alt: a.alt } : {}) }),
        clear: {},
      };
    case 'video':
      return {
        title: 'Video thumbnail',
        current: node.thumbnail,
        clearable: false,
        patch: (a) => ({ thumbnail: a.url }),
        clear: {},
      };
    case 'section':
      return {
        title: 'Background image',
        current: node.bgImage ?? '',
        clearable: true,
        patch: (a) => ({ bgImage: a.url }),
        clear: { bgImage: undefined },
      };
    default:
      return null;
  }
}

function MediaField({
  node,
  ctx,
  pick,
}: {
  node: EmailNode;
  ctx: EmailInspectorPanelCtx;
  pick: PickAsset;
}) {
  const field = assetFieldOf(node);
  if (!field) return null;

  const choose = async () => {
    const asset = await pick();
    if (asset) ctx.update(field.patch(asset));
  };

  return (
    <div className="flex flex-col gap-2">
      {field.current ? (
        // Decorative preview of the author's own choice — the alt that matters is
        // the one on the node, edited in silica's own field below.
        <img
          src={field.current}
          alt=""
          className="border-base-300 h-24 w-full rounded border object-cover"
        />
      ) : (
        <p className="text-base-content/60">No picture chosen yet.</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<ImagePlus className="h-3.5 w-3.5" />}
          onClick={() => void choose()}
        >
          Choose from library
        </Button>
        {field.clearable && field.current ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Remove the background picture"
            onClick={() => ctx.update(field.clear)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** The host's `inspectorPanels` — a media-library panel on every node that carries an
 *  asset, and nothing at all anywhere else. Ordered ahead of silica's built-in
 *  sections so the library reads as the primary path and the raw URL field below it
 *  as the escape hatch (an author pasting a hot-linked URL is still supported). */
export function makeAssetPanels(pick: PickAsset): NonNullable<EmailBuilderHost['inspectorPanels']> {
  return (node: EmailNode): EmailInspectorPanel[] => {
    const field = assetFieldOf(node);
    if (!field) return [];
    return [
      {
        id: 'sparx-media',
        title: field.title,
        order: -10,
        render: (n, ctx) => <MediaField node={n} ctx={ctx} pick={pick} />,
      },
    ];
  };
}
