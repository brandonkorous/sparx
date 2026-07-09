'use client';

// Renders a single SectionField onto a @sparx/ui control. The same descriptor
// drives section config editing and (via the settings panels) theme settings.
// Form state is controlled by the parent — every control reports changes up via
// onChange so the customizer owns a single draft object.

import * as React from 'react';
import {
  Button,
  ButtonGroup,
  ColorPicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Textarea,
} from '@sparx/ui';
import { ImageIcon } from 'lucide-react';
import type { SectionField } from '@sparx/sitebuilder-schemas';
// The media library is shared dashboard infra (docs/29 §1) — Brand & theme image
// fields reuse the CMS asset picker rather than a parallel one.
import { MediaPicker } from '@/app/(dashboard)/cms/_components/media-picker';
import { ImageFramingModal } from './image-framing-modal';
import { LucideIconLink, isLucideIconField } from '@/lib/lucide-icon-hint';

// Web-safe + popular Google fonts offered in font pickers.
const FONT_OPTIONS = [
  'Inter',
  'Geist',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Oswald',
  'Playfair Display',
  'Fraunces',
  'Nunito Sans',
  'IBM Plex Sans',
  'Merriweather',
  'Source Sans 3',
];

export interface FieldControlProps {
  field: SectionField;
  value: unknown;
  onChange: (value: unknown) => void;
  // Optional: the full section config + a multi-key patch setter. Threaded only
  // by the section editor so a composite control (the image framing modal) can
  // read/write sibling keys (fit/focal/zoom). Plain fields ignore both.
  config?: Record<string, unknown>;
  onPatch?: (partial: Record<string, unknown>) => void;
}

export function FieldControl({ field, value, onChange, config, onPatch }: FieldControlProps) {
  const id = `fld-${field.key}`;
  return (
    <div className="flex flex-col gap-1.5">
      {field.type !== 'boolean' ? <Label htmlFor={id}>{field.label}</Label> : null}
      <Control
        field={field}
        id={id}
        value={value}
        onChange={onChange}
        config={config}
        onPatch={onPatch}
      />
      {field.help ? <p className="text-base-content/60 text-xs">{field.help}</p> : null}
      {isLucideIconField(field.help) && <LucideIconLink />}
    </div>
  );
}

function Control({
  field,
  id,
  value,
  onChange,
  config,
  onPatch,
}: FieldControlProps & { id: string }) {
  switch (field.type) {
    case 'textarea':
    case 'richtext':
      return (
        <Textarea
          id={id}
          rows={field.type === 'richtext' ? 6 : 3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={field.type === 'richtext' ? 'font-mono text-sm' : undefined}
        />
      );
    case 'color':
      return (
        <ColorPicker value={(value as string) ?? ''} onChange={onChange} ariaLabel={field.label} />
      );
    case 'font':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose a font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'select':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'buttongroup':
      return (
        <ButtonGroup>
          {(field.options ?? []).map((o) => {
            const active = value === o.value;
            return (
              <Button
                key={o.value}
                type="button"
                size="sm"
                color={active ? 'module' : 'neutral'}
                variant={active ? 'solid' : 'outline'}
                aria-pressed={active}
                onClick={() => onChange(o.value)}
              >
                {o.label}
              </Button>
            );
          })}
        </ButtonGroup>
      );
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'range': {
      const n = typeof value === 'number' ? value : (field.min ?? 0);
      return (
        <div className="flex items-center gap-3">
          <Slider
            value={[n]}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onValueChange={(v) => onChange(v[0])}
            className="flex-1"
          />
          <span className="text-base-content/60 w-10 text-right text-sm tabular-nums">{n}</span>
        </div>
      );
    }
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm" htmlFor={id}>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={(c) => onChange(c)} />
          {field.label}
        </label>
      );
    case 'media':
      return (
        <MediaField
          field={field}
          value={value}
          onChange={onChange}
          config={config}
          onPatch={onPatch}
        />
      );
    case 'collection':
    case 'products':
      // Id-based references. A catalog search picker can replace these inputs
      // later without changing the stored shape.
      return (
        <Input
          id={id}
          value={Array.isArray(value) ? (value as string[]).join(', ') : ((value as string) ?? '')}
          placeholder={field.type === 'products' ? 'comma-separated ids' : 'id'}
          onChange={(e) =>
            onChange(
              field.type === 'products'
                ? e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : e.target.value || null
            )
          }
        />
      );
    case 'list':
      return <ListField field={field} value={value} onChange={onChange} />;
    case 'url':
    case 'text':
    default:
      return (
        <Input
          id={id}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

// Image field — accepts EITHER a library asset (via the shared CMS picker,
// stored as its asset id) OR a pasted absolute image/video URL (stored as-is).
// The storefront resolver (lib/media.ts) handles both. Shows a live thumbnail.
function MediaField({ field, value, onChange, config, onPatch }: FieldControlProps) {
  const [open, setOpen] = React.useState(false);
  const [framingOpen, setFramingOpen] = React.useState(false);
  const [pickedSrc, setPickedSrc] = React.useState<string | null>(null);
  const current = typeof value === 'string' && value ? value : null;
  const isUrl = current ? /^https?:\/\//i.test(current) : false;
  const preview = isUrl ? current : pickedSrc;

  // Framing is available when the media field opts in (fit + focal keys) and the
  // editor threaded the section config + patch setter, and we have a displayable
  // image (a pasted URL, or an asset whose preview src we know).
  const framingEnabled = Boolean(field.fitKey && field.focalKey && config && onPatch);
  const focal = (config?.[field.focalKey ?? ''] as { x?: number; y?: number } | undefined) ?? {};

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="border-base-300 bg-base-200 flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-md border">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="text-base-content/50 h-5 w-5" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              {current && !isUrl ? 'Change image' : 'Choose image'}
            </Button>
            {current ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPickedSrc(null);
                  onChange(null);
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
          {current && !isUrl ? (
            <span className="text-base-content/60 font-mono text-[11px]">{current}</span>
          ) : (
            <span className="text-base-content/60 text-xs">
              {isUrl ? 'External URL' : 'No image selected'}
            </span>
          )}
        </div>
      </div>
      <Input
        value={isUrl ? (current ?? '') : ''}
        placeholder="…or paste an image URL (https://…)"
        onChange={(e) => {
          setPickedSrc(null);
          onChange(e.target.value.trim() || null);
        }}
      />
      {framingEnabled ? (
        <>
          <button
            type="button"
            onClick={() => setFramingOpen(true)}
            disabled={!preview}
            className="text-module disabled:text-base-content/60 self-start text-sm hover:underline disabled:cursor-not-allowed disabled:no-underline"
          >
            Adjust framing…
          </button>
          <ImageFramingModal
            open={framingOpen}
            onOpenChange={setFramingOpen}
            src={preview}
            showZoom={Boolean(field.zoomKey)}
            initial={{
              fit: config?.[field.fitKey ?? ''] === 'contain' ? 'contain' : 'cover',
              focal: {
                x: typeof focal.x === 'number' ? focal.x : 50,
                y: typeof focal.y === 'number' ? focal.y : 50,
              },
              zoom:
                field.zoomKey && typeof config?.[field.zoomKey] === 'number'
                  ? (config?.[field.zoomKey] as number)
                  : 1,
            }}
            onApply={(f) => {
              const patch: Record<string, unknown> = {};
              if (field.fitKey) patch[field.fitKey] = f.fit;
              if (field.focalKey) patch[field.focalKey] = f.focal;
              if (field.zoomKey) patch[field.zoomKey] = f.zoom;
              onPatch?.(patch);
            }}
          />
        </>
      ) : null}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        accept={['image/*']}
        onPick={(asset) => {
          setPickedSrc(asset.src || null);
          onChange(asset.assetId);
          setOpen(false);
        }}
      />
    </div>
  );
}

// Repeatable group of item-field rows (e.g. testimonials). Each item is an
// object keyed by the itemFields; add/remove manage the array.
function ListField({ field, value, onChange }: FieldControlProps) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const itemFields = field.itemFields ?? [];

  const setItem = (index: number, key: string, v: unknown) => {
    const next = items.map((it, i) => (i === index ? { ...it, [key]: v } : it));
    onChange(next);
  };
  // Merge multiple keys into one item at once (used by composite controls like
  // the image framing modal, which write fit/focal/zoom together).
  const patchItem = (index: number, partial: Record<string, unknown>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...partial } : it)));
  };
  const addItem = () => onChange([...items, {}]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="border-base-300 flex flex-col gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-base-content/60 text-xs font-medium">
              {field.itemLabel ?? 'Item'} {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-base-content/60 hover:text-base-content text-xs"
            >
              Remove
            </button>
          </div>
          {itemFields.map((f) => (
            <FieldControl
              key={f.key}
              field={f}
              value={item[f.key]}
              onChange={(v) => setItem(i, f.key, v)}
              config={item}
              onPatch={(partial) => patchItem(i, partial)}
            />
          ))}
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="text-module self-start text-sm hover:underline"
      >
        + Add {field.itemLabel ?? 'item'}
      </button>
    </div>
  );
}
