'use client';

// SEO panel — title / meta description / OG image / canonical / robots.
//
// Rendered inside the edit form so all save-the-entry traffic flows
// through one POST. The component is presentational + state-managed by
// the parent EditPageForm; everything here is a controlled input writing
// to the parent's React state.
//
// Google preview matches search-result typography: title in the blue
// link weight, URL in the small green serif, description in standard
// gray. Pixel-perfect parity isn't possible (Google's algorithm
// rewrites titles based on query), but the layout gives editors enough
// signal to spot truncation before publishing.

import * as React from 'react';
import { Button, Card, CardBody, Input, Label, NativeSelect, Textarea } from 'silicaui-react';
import { ImageOff, Pencil } from 'lucide-react';
import { SeoScoreChip } from '@/components/seo/seo-score';
import { MediaPicker, type PickedAsset } from '../_components/media-picker';

export interface SeoFields {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogImage: string;
}

interface SeoPanelProps {
  value: SeoFields;
  onChange: (next: SeoFields) => void;
  // Used to render the "URL preview" line in the Google search result.
  // We don't know the storefront domain here — apps/dashboard runs on
  // app.sparx.works and the actual public URL depends on which storefront
  // the entry belongs to. For now we render `{previewOrigin}/{slug}` with
  // the slug as authoritative; future-pass swap in the per-tenant
  // storefront origin.
  previewOrigin: string;
  slug: string;
  fallbackTitle: string;
  // The content entry's id — when present, the SEO health chip renders in the
  // header (live audit + hover report). Optional so the panel still works in
  // any context that doesn't have a persisted entry yet.
  entryId?: string;
}

const ROBOTS_OPTIONS = [
  { value: 'default', label: 'Default (index, follow)' },
  { value: 'index,follow', label: 'Index, follow' },
  { value: 'noindex,follow', label: 'No-index, follow' },
  { value: 'index,nofollow', label: 'Index, no-follow' },
  { value: 'noindex,nofollow', label: 'No-index, no-follow' },
];

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export function SeoPanel({
  value,
  onChange,
  previewOrigin,
  slug,
  fallbackTitle,
  entryId,
}: SeoPanelProps) {
  const update = <K extends keyof SeoFields>(k: K, v: SeoFields[K]) => {
    onChange({ ...value, [k]: v });
  };

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [ogPreview, setOgPreview] = React.useState<PickedAsset | null>(null);

  const previewTitle = value.title || fallbackTitle || 'Untitled page';
  const previewDescription =
    value.description ||
    'Provide a meta description so Google can show this snippet under your search result.';

  return (
    <Card className="bg-module bg-soft">
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">SEO</h3>
            <p className="opacity-70">
              Controls how this page appears in Google and on social shares.
            </p>
          </div>
          {/* Live SEO health for the saved entry; hover for the full report. */}
          {entryId ? <SeoScoreChip type="cms_page" id={entryId} /> : null}
        </div>
        <div className="flex flex-col gap-5">
          <GooglePreview
            origin={previewOrigin}
            slug={slug}
            title={previewTitle}
            description={previewDescription}
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-end justify-between gap-4">
              <Label htmlFor="seoTitle">Search title</Label>
              <CharCount value={value.title} max={TITLE_MAX} />
            </div>
            <Input
              id="seoTitle"
              name="seoTitle"
              value={value.title}
              onChange={(e) => update('title', e.target.value)}
              maxLength={TITLE_MAX + 20}
              placeholder={fallbackTitle || 'Falls back to the page title.'}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-end justify-between gap-4">
              <Label htmlFor="metaDescription">Meta description</Label>
              <CharCount value={value.description} max={DESCRIPTION_MAX} />
            </div>
            <Textarea
              id="metaDescription"
              name="metaDescription"
              value={value.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              maxLength={DESCRIPTION_MAX + 40}
              placeholder="One-sentence summary Google can show as the snippet."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ogImage">Social share image</Label>
            <OgImageField
              assetId={value.ogImage}
              preview={ogPreview}
              onPick={() => setPickerOpen(true)}
              onClear={() => {
                setOgPreview(null);
                update('ogImage', '');
              }}
            />
            <p className="text-base-content/70 text-xs">
              Used as the Open Graph image when this page is shared on Facebook, LinkedIn, Slack,
              etc. Falls back to your default OG image when blank.
            </p>
            <MediaPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              accept={['image/*']}
              onPick={(asset) => {
                setOgPreview(asset);
                update('ogImage', asset.assetId);
                setPickerOpen(false);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="canonical">Canonical URL</Label>
            <Input
              id="canonical"
              name="canonical"
              value={value.canonical}
              onChange={(e) => update('canonical', e.target.value)}
              placeholder={`${previewOrigin}/${slug || ''}`}
            />
            <p className="text-base-content/70 text-xs">
              Set this if the same content lives at multiple URLs. Leave blank to use the
              page&apos;s own URL.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="robots">Robots directive</Label>
            {/* A plain native select — like the Page template picker below. A simple
                text-option enum needs no Radix Select (whose hidden form-mirror is an
                absolutely-positioned element that escapes scroll containers). */}
            <NativeSelect
              id="robots"
              aria-label="Robots directive"
              value={value.robots ? value.robots : 'default'}
              onChange={(e) => update('robots', e.target.value === 'default' ? '' : e.target.value)}
            >
              {ROBOTS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-base-content/70 text-xs">
              Controls whether search engines index this page and follow its links.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function OgImageField({
  assetId,
  preview,
  onPick,
  onClear,
}: {
  assetId: string;
  preview: PickedAsset | null;
  onPick: () => void;
  onClear: () => void;
}) {
  // Two display states: nothing picked → "Pick image" button; picked →
  // thumbnail (if we have one cached from this session) + filename + change/
  // clear actions. We deliberately don't fetch the asset on mount when only
  // an assetId is present — the picker can re-surface it lazily without an
  // extra round-trip on every edit-page open.
  const hasAsset = assetId.length > 0;
  if (!hasAsset) {
    return (
      <div className="flex flex-row items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onPick}>
          Pick image
        </Button>
        <p className="text-base-content/70 text-xs">
          No image selected — Slack and OG cards will use the site default.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-row items-center gap-3">
      {preview?.src ? (
        <img
          src={preview.src}
          alt={preview.alt || 'Selected social share image'}
          className="h-14 w-14 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]">
          <ImageOff aria-hidden className="h-5 w-5 text-[var(--color-text-tertiary)]" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm">{preview?.alt ?? preview?.caption ?? 'Image selected'}</p>
        <p className="text-base-content/70 text-xs">Asset {assetId.slice(0, 8)}…</p>
      </div>
      <div className="ml-auto flex flex-row gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconStart={<Pencil className="h-3.5 w-3.5" />}
          onClick={onPick}
        >
          Change
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  // Text only supports danger | muted | subtle (no warning variant); fall
  // back to danger when we're past the warning threshold too.
  const variant: 'danger' | 'muted' = len > max * 0.9 ? 'danger' : 'muted';
  return (
    <p className={`text-xs ${variant === 'danger' ? 'text-danger' : 'text-base-content/70'}`}>
      {len} / {max}
    </p>
  );
}

function GooglePreview({
  origin,
  slug,
  title,
  description,
}: {
  origin: string;
  slug: string;
  title: string;
  description: string;
}) {
  const url = `${origin}/${slug ?? ''}`.replace(/\/+$/, '');
  // Display: chevron-separated "domain › path"
  const displayUrl = url.replace(/^https?:\/\//, '').replace('/', ' › ');
  // Brand-fidelity exception: this block deliberately mimics Google's SERP
  // typography (the blue title link `#1a0dab`, the gray description `#4d5156`,
  // the dark URL chip `#202124`). Those colors are not in the sparx design
  // system — they're Google's, and editors expect to see what their result
  // will look like there. Keep the inline Tailwind here; do not migrate to
  // sparx tokens. The surrounding chrome (border / background) does use
  // tokens.
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <p className="text-base-content/70 text-xs">Google preview</p>
      <p className="text-xs text-[#202124]">{displayUrl}</p>
      <p className="text-lg font-medium text-[#1a0dab]">{truncate(title, 60)}</p>
      <p className="text-sm text-[#4d5156]">{truncate(description, 160)}</p>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}
