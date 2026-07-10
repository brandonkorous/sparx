'use client';

// Asset detail form: focal-point editor + alt-text + caption + destructive
// delete. Optimistic local state mirrors the existing /cms edit form so
// the UX stays consistent: save commits via a server action; pending UI
// blocks the buttons rather than rolling back on failure.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdaptiveLabel, toast, useConfirm } from '@sparx/ui';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Check, Trash2 } from 'lucide-react';
import { deleteAsset, patchAsset } from '../actions';
import { DetailFooterSlot, DetailHeaderSlot } from '../../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

const FORM_ID = 'media-asset-edit-form';

export interface AssetEditFormProps {
  assetId: string;
  isImage: boolean;
  previewUrl: string | null;
  altText: string | null;
  caption: string | null;
  focalPoint: { x: number; y: number };
}

export function AssetEditForm({
  assetId,
  isImage,
  previewUrl,
  altText: initialAltText,
  caption: initialCaption,
  focalPoint: initialFocalPoint,
}: AssetEditFormProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [altText, setAltText] = React.useState(initialAltText ?? '');
  const [caption, setCaption] = React.useState(initialCaption ?? '');
  const [focal, setFocal] = React.useState(initialFocalPoint);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Register the dirty state so the detail page's guarded back-link / presentation
  // switch confirm before discarding unsaved asset edits (docs/105).
  const dirty =
    altText !== (initialAltText ?? '') ||
    caption !== (initialCaption ?? '') ||
    focal.x !== initialFocalPoint.x ||
    focal.y !== initialFocalPoint.y;
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'asset' });

  function onFocalClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isImage || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const next = { x: round(x), y: round(y) };
    setFocal(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedAt(null);
    startTransition(async () => {
      const result = await patchAsset(assetId, {
        alt_text: altText || null,
        caption: caption || null,
        focal_point_x: focal.x,
        focal_point_y: focal.y,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save changes.');
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this asset?',
      description: 'This cannot be undone — the file and every reference to it are removed.',
      confirmLabel: 'Delete asset',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteAsset(assetId);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete asset.');
        return;
      }
      router.push('/cms/media');
      router.refresh();
    });
  }

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate>
      {/* Delete is rare + destructive, so it's demoted the same way Page/Author
          demote it: icon-only ghost + tooltip in the shared detail chrome's
          header, rather than a full-width button in the scrolling body. */}
      <DetailHeaderSlot>
        <Tooltip content="Delete">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete"
            disabled={pending}
            onClick={() => void onDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </DetailHeaderSlot>

      <div className="flex flex-col gap-4">
        {isImage && previewUrl ? (
          <div
            ref={containerRef}
            role="button"
            tabIndex={0}
            aria-label="Click to set focal point"
            onClick={onFocalClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFocal({ x: 0.5, y: 0.5 });
              }
            }}
            className="border-base-300 bg-base-200 relative w-full cursor-crosshair overflow-hidden rounded-md border"
            style={{ aspectRatio: '16 / 9' }}
          >
            <img
              src={previewUrl}
              alt={altText || 'Asset preview'}
              className="h-full w-full object-contain"
              draggable={false}
            />
            <div
              className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
              style={{
                left: `${focal.x * 100}%`,
                top: `${focal.y * 100}%`,
                backgroundColor: 'var(--color-module)',
              }}
              aria-hidden
            />
          </div>
        ) : (
          <p className="text-base-content/70 text-sm">
            {previewUrl ? 'Preview not available for this file type.' : 'No preview available.'}
          </p>
        )}

        <Field>
          <FieldLabel>Alt text</FieldLabel>
          <FieldControl
            name="alt-text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            maxLength={500}
            placeholder="Describe the image for screen readers and SEO."
          />
        </Field>

        <Field>
          <FieldLabel>Caption (optional)</FieldLabel>
          <FieldControl
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2000}
            render={<Textarea rows={2} />}
          />
        </Field>

        {isImage && (
          <p className="text-base-content/70 text-xs">
            Focal point: ({focal.x.toFixed(2)}, {focal.y.toFixed(2)})
          </p>
        )}
      </div>

      {/* The primary action teleports up into the shared detail chrome's footer
          (next to Delete), not floored at the bottom of the scrolling body — a
          failed save surfaces as a toast since there's no room for a persistent
          error line in the compact shared toolbar row. */}
      <DetailFooterSlot>
        <div className="flex items-center gap-2">
          {savedAt !== null && !dirty && (
            <span className="text-success flex items-center gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            form={FORM_ID}
            size="sm"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            <AdaptiveLabel label={{ full: 'Save changes', short: 'Save' }} />
          </Button>
        </div>
      </DetailFooterSlot>
    </form>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
