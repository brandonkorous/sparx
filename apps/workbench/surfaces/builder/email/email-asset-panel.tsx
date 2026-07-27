'use client';

// The email builder's picture picker — a host inspector panel (silicaui
// `EmailBuilderHost.inspectorPanels`) on the three asset-bearing node kinds, so an
// author picks a picture from their own media library instead of pasting a URL.
//
// Asking a non-technical business owner to paste an image URL is a technical act; every
// other builder surface (CMS, site, commerce) hands them the shared media browser, and
// this brings the EMAIL builder to parity. silica's email host has no `pickAsset` seam,
// but it exposes `inspectorPanels?(node)`, whose `ctx.update()` writes through the engine's
// OWN mutation path — so a small panel on `image` (src), `video` (thumbnail) and `section`
// (bgImage) is all a picker needs. It renders ABOVE the built-in Settings sections; the
// built-in URL field stays too, so a pasted URL still works.
//
// The panel resolves the shared `useMediaPicker()` — so `<EmailBuilder>` must be wrapped in
// a `<MediaPickerProvider>` (email-editor.tsx does this). Emails write the picked asset's
// URL (an email `src` is a real URL, never a media id, because a mail client fetches it
// cross-origin with no app to resolve an id).

import Image from 'next/image';
import { Button } from '@wizeworks/silicaui-react';
import { ImageOff, ImagePlus, Trash2 } from 'lucide-react';
import type { EmailBuilderHost } from '@wizeworks/silicaui-builder/email/react';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import { useMediaPicker } from '../../cms/media-picker';

/** The asset field each node kind exposes, and how to talk about it. `removable` is false
 *  for an image (its `src` IS the block — an image with no picture is nothing to keep) and
 *  true for the optional thumbnail / background. */
const ASSET: Record<
  string,
  { field: 'src' | 'thumbnail' | 'bgImage'; title: string; noun: string; removable: boolean }
> = {
  image: { field: 'src', title: 'Picture', noun: 'picture', removable: false },
  video: { field: 'thumbnail', title: 'Video thumbnail', noun: 'thumbnail', removable: true },
  section: {
    field: 'bgImage',
    title: 'Background image',
    noun: 'background image',
    removable: true,
  },
};

function currentUrl(node: EmailNode, field: string): string {
  const v = (node as unknown as Record<string, unknown>)[field];
  return typeof v === 'string' ? v : '';
}

function EmailAssetPanel({
  node,
  update,
}: {
  node: EmailNode;
  update: (patch: Record<string, unknown>) => void;
}) {
  const pick = useMediaPicker();
  const spec = ASSET[node.kind];
  if (!spec) return null;
  const current = currentUrl(node, spec.field);

  const choose = async () => {
    const picked = await pick();
    // A library asset without a resolvable URL can't render in an inbox — skip it rather
    // than write an empty src.
    if (!picked?.url) return;
    update({ [spec.field]: picked.url });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-base-200 relative h-28 w-full overflow-hidden rounded-md">
        {current ? (
          <Image
            src={current}
            alt=""
            fill
            sizes="280px"
            className="object-contain"
            // Unoptimized: cross-origin tenant media, where the image optimizer's host
            // allow-list is environment-fragile — same call the media browser makes.
            unoptimized
          />
        ) : (
          <span className="flex h-full items-center justify-center">
            <ImageOff className="size-5" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            void choose();
          }}
        >
          <ImagePlus className="size-4" aria-hidden />
          {current ? 'Change' : `Choose a ${spec.noun}`}
        </Button>
        {current && spec.removable ? (
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            onClick={() => {
              update({ [spec.field]: '' });
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Host inspector panels for the email builder: a picture picker on the asset-bearing
 *  kinds, nothing on the rest. Rendered above the built-in Settings (`order` negative). */
export const emailInspectorPanels: NonNullable<EmailBuilderHost['inspectorPanels']> = (node) => {
  const spec = ASSET[node.kind];
  if (!spec) return [];
  return [
    {
      id: 'sx-media',
      title: spec.title,
      order: -100,
      render: (n, ctx) => (
        <EmailAssetPanel
          node={n}
          update={(patch) => {
            ctx.update(patch);
          }}
        />
      ),
    },
  ];
};
