'use client';

// Asset picker modal.
//
// Lazy-loads `/v1/media/assets` and surfaces a grid; the user picks one and
// the parent receives `{ src, alt, caption, assetId }`. Used by both the
// rich-text editor (Insert image button) and the schema-driven form's
// `asset` field type.
//
// Search is debounced client-side over the in-memory list. For tenants
// with thousands of assets we'll add a server-side query — that's a Phase
// 2 follow-up flagged in the comment below.

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogTitle, Input } from '@wizeworks/silicaui-react';
import { ImageIcon, Search } from 'lucide-react';

import { listMediaAssetsAction } from './cms-actions';

export interface PickedAsset {
  src: string;
  alt: string;
  caption?: string;
  assetId: string;
}

interface ApiAsset {
  id: string;
  original_filename: string;
  mime_type: string;
  alt_text: string | null;
  caption: string | null;
  variants?: { format: string; width: number; url: string }[];
  // Original bytes (served by api-rest in local mode; null in prod where
  // originals are private) and the storage key (an absolute URL for hot-linked
  // external assets). Both are thumbnail fallbacks when no variant exists.
  original_url?: string | null;
  key?: string;
}

export interface MediaPickerProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onPick: (asset: PickedAsset) => void;
  /** Filter by mime pattern, e.g. ['image/*']. */
  accept?: string[];
}

function pickBestVariant(asset: ApiAsset): string | null {
  // Prefer webp around 800w as a thumbnail; fall back to the smallest variant.
  const webp = (asset.variants ?? [])
    .filter((v) => v.format === 'webp')
    .sort((a, b) => Math.abs(a.width - 800) - Math.abs(b.width - 800));
  if (webp[0]) return webp[0].url;
  if (asset.variants?.[0]) return asset.variants[0].url;
  // No transcoded variants (dev/local, or a skipped format): serve the original
  // bytes, or — for a hot-linked external asset — its absolute-URL key.
  if (asset.original_url) return asset.original_url;
  if (asset.key && /^https?:\/\//i.test(asset.key)) return asset.key;
  return null;
}

// A thumbnail that degrades to the placeholder icon when there is no source OR
// the image fails to load (e.g. a stray asset row whose bytes never landed).
function AssetThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ImageIcon className="text-base-content/50 h-6 w-6" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function matchesAccept(mime: string, accept: string[] | undefined): boolean {
  if (!accept?.length) return true;
  return accept.some((pat) => {
    if (pat === '*' || pat === '*/*') return true;
    if (pat.endsWith('/*')) return mime.startsWith(pat.slice(0, -1));
    return mime === pat;
  });
}

export function MediaPicker({ open, onOpenChange, onPick, accept }: MediaPickerProps) {
  const [loading, setLoading] = React.useState(false);
  const [assets, setAssets] = React.useState<ApiAsset[]>([]);
  const [q, setQ] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMediaAssetsAction({ limit: 120 })
      .then((body) => {
        if (cancelled) return;
        if (body.success) {
          setAssets(body.data);
        } else {
          setError(body.error.message ?? 'Failed to load assets.');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load assets.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (!matchesAccept(a.mime_type, accept)) return false;
      if (!needle) return true;
      return (
        a.original_filename.toLowerCase().includes(needle) ||
        (a.alt_text ?? '').toLowerCase().includes(needle)
      );
    });
  }, [assets, q, accept]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <div className="px-6 pt-6">
          <DialogTitle>Select an asset</DialogTitle>
        </div>
        <div className="px-6 py-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-2">
              <Search className="text-base-content/50 h-4 w-4" />
              <Input
                placeholder="Filter by filename or alt text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Filter assets"
              />
            </div>
            {loading && <p className="text-base-content/70 text-base">Loading assets…</p>}
            {error && <p className="text-danger text-base">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="text-base-content/70 text-base">No assets matched.</p>
            )}
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((a) => {
                const thumb = pickBestVariant(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      onPick({
                        src: thumb ?? '',
                        alt: a.alt_text ?? '',
                        caption: a.caption ?? undefined,
                        assetId: a.id,
                      })
                    }
                    className="group border-base-300 bg-base-200 focus:ring-primary relative aspect-square overflow-hidden rounded-md border focus:ring-2 focus:outline-none"
                    aria-label={`Pick ${a.original_filename}`}
                  >
                    <AssetThumb src={thumb} alt={a.alt_text ?? a.original_filename} />
                    {/* eslint-disable-next-line no-restricted-syntax -- semi-transparent image overlay label, not a reimplemented control */}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-left text-[10px] text-white">
                      {a.original_filename}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
