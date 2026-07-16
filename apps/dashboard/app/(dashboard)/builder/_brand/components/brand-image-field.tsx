'use client';

// A brand asset field (logo light/dark, favicon). Unlike the section-editor
// MediaField — which only PICKS from existing assets — a fresh tenant has no
// media yet, so this also UPLOADS: it reuses the shared presigned-URL flow
// (initUpload → browser PUT → completeUpload) and the CMS asset picker, then
// reports the chosen asset id + a preview URL up to the parent. The brand form
// stores the id; the URL is only for the board preview.

import * as React from 'react';
import { Button } from '@sparx/ui';
import { ImageIcon, Upload } from 'lucide-react';
import { MediaPicker } from '@/app/(dashboard)/cms/_components/media-picker';
import { initUpload, completeUpload } from '@/app/(dashboard)/cms/media/actions';
import { resolveBrandMedia } from '../lib/actions';

export interface BrandImageFieldProps {
  label: string;
  /** Stored asset id, or null. */
  value: string | null;
  /** Resolved preview URL for the current value (may be null while resolving). */
  previewUrl: string | null;
  onChange: (assetId: string | null, previewUrl: string | null) => void;
  help?: string;
  /** Dark chip so a light/white logo is visible in its thumbnail. */
  dark?: boolean;
}

export function BrandImageField({
  label,
  value,
  previewUrl,
  onChange,
  help,
  dark,
}: BrandImageFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Track a broken preview so a stale/unresolvable id shows the placeholder
  // instead of a broken-image glyph. Reset whenever the URL changes.
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [previewUrl]);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const init = await initUpload({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        byteSize: file.size,
      });
      if (!init.ok || !init.data) {
        throw new Error(init.ok ? 'Server returned no upload URL.' : init.error);
      }
      const put = await fetch(init.data.upload.url, {
        method: 'PUT',
        headers: init.data.upload.headers,
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (HTTP ${put.status}).`);
      const done = await completeUpload(init.data.asset.id);
      if (!done.ok) throw new Error(done.error);
      const url = await resolveBrandMedia(init.data.asset.id);
      onChange(init.data.asset.id, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-base-content text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={`border-base-300 flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-md border ${
            dark ? 'bg-[#0b0b0f]' : 'bg-base-200'
          }`}
        >
          {previewUrl && !imgFailed ? (
            <img
              src={previewUrl}
              alt=""
              decoding="async"
              className="h-full w-full object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ImageIcon className="text-base-content h-5 w-5" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              loading={busy}
            >
              Upload
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(true)}
              disabled={busy}
            >
              Choose existing
            </Button>
            {value ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(null, null)}
                disabled={busy}
              >
                Remove
              </Button>
            ) : null}
          </div>
          {error ? (
            <span className="text-danger text-xs">{error}</span>
          ) : help ? (
            <span className="text-base-content text-xs">{help}</span>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept="image/*"
        onChange={onFile}
        aria-hidden
        tabIndex={-1}
      />
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        accept={['image/*']}
        onPick={(asset) => {
          onChange(asset.assetId, asset.src || null);
          setOpen(false);
        }}
      />
    </div>
  );
}
