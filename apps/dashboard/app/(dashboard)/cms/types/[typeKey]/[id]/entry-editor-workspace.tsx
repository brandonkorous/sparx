'use client';

// The entry editor workspace (docs/51 §6) — wraps the existing schema-driven
// <EditEntryForm> (unchanged) in a two-pane shell with a LIVE preview of the entry
// rendered through its collection template. The form stays the editing surface; the
// preview is the builder's own canvas (preview == production), linked both ways:
//   · type in a field        → the preview re-renders (the form mirrors `body` up
//                               via EditEntryForm's `onBody`)
//   · click a bound node     → its form field focuses (the bridge maps node→field)
//   · focus a field          → its node highlights in the preview
//
// The whole preview half is OPTIONAL: with no collection template (Builder module
// off, or a non-routable type) `preview` is null and this renders the form exactly
// as before — full width, no toolbar.

import * as React from 'react';
import Link from 'next/link';
import { Button, cn } from '@sparx/ui';
import {
  Columns2,
  Eye,
  LayoutTemplate,
  Monitor,
  Smartphone,
  SquarePen,
  Tablet,
} from 'lucide-react';

import { EditEntryForm, type EditEntryFormProps } from './edit-entry-form';
import { EmbeddedRecordPreview } from '../../../../builder/_builder/embedded-record-preview';
import type { RecordPreviewBundle } from '../../../../builder/_lib/record-preview';

type View = 'form' | 'split' | 'preview';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

/** The preview half, assembled server-side, plus the bits the embed needs from the
 *  entry: which type it is and the path it lives at. */
export type EntryPreview = RecordPreviewBundle & {
  typeKey: string;
  path: string;
  /** The collection template this entry renders through — the "Edit layout" button
   *  deep-links to it in the builder, so the author edits the LAYOUT there and the
   *  CONTENT here. */
  templateId: string;
};

export interface EntryEditorWorkspaceProps {
  form: EditEntryFormProps;
  preview: EntryPreview | null;
}

interface SegOption<T extends string> {
  value: T;
  label?: string;
  title: string;
  icon: React.ReactNode;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex gap-0.5 rounded-md bg-[var(--color-bg-subtle)] p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium transition-colors',
            value === o.value
              ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          )}
        >
          {o.icon}
          {o.label ? <span>{o.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

const VIEW_OPTIONS: SegOption<View>[] = [
  { value: 'form', label: 'Form', title: 'Form only', icon: <SquarePen className="h-3.5 w-3.5" /> },
  {
    value: 'split',
    label: 'Split',
    title: 'Form + preview',
    icon: <Columns2 className="h-3.5 w-3.5" />,
  },
  {
    value: 'preview',
    label: 'Preview',
    title: 'Preview only',
    icon: <Eye className="h-3.5 w-3.5" />,
  },
];

const DEVICE_OPTIONS: SegOption<PreviewDevice>[] = [
  { value: 'desktop', title: 'Desktop', icon: <Monitor className="h-3.5 w-3.5" /> },
  { value: 'tablet', title: 'Tablet', icon: <Tablet className="h-3.5 w-3.5" /> },
  { value: 'mobile', title: 'Mobile', icon: <Smartphone className="h-3.5 w-3.5" /> },
];

export function EntryEditorWorkspace({ form, preview }: EntryEditorWorkspaceProps) {
  // `body` is a MIRROR of EditEntryForm's body (it still owns + autosaves it); we
  // only observe it to feed the live preview, so the autosave machinery is untouched.
  const [body, setBody] = React.useState<Record<string, unknown>>(form.initialBody);
  const [view, setView] = React.useState<View>(preview ? 'split' : 'form');
  const [device, setDevice] = React.useState<PreviewDevice>('desktop');
  const [selectedFieldKey, setSelectedFieldKey] = React.useState<string | null>(null);

  const formHostRef = React.useRef<HTMLDivElement>(null);

  // Scroll a field into view + focus its control (the preview → form half of the
  // bridge). Field wrappers carry `data-cms-field="<key>"` (ContentEntryForm).
  const focusField = React.useCallback((key: string) => {
    const host = formHostRef.current;
    if (!host) return;
    const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key;
    const wrap = host.querySelector(`[data-cms-field="${safe}"]`);
    if (!wrap) return;
    wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const ctl = wrap.querySelector('input, textarea, select, [contenteditable="true"]');
    if (ctl instanceof HTMLElement) ctl.focus({ preventScroll: true });
  }, []);

  const onPickField = React.useCallback(
    (key: string | null) => {
      setSelectedFieldKey(key);
      if (key) focusField(key);
    },
    [focusField]
  );

  // Focusing a field (anywhere in the form pane) highlights its node — the form →
  // preview half of the bridge.
  const onFormFocus = React.useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const wrap = (e.target as HTMLElement).closest('[data-cms-field]');
    const key = wrap?.getAttribute('data-cms-field');
    if (key) setSelectedFieldKey(key);
  }, []);

  // Form-only fast path: no preview to show, so render the form exactly as before.
  if (!preview) {
    return <EditEntryForm {...form} onBody={setBody} />;
  }

  const formPane = (
    <div
      ref={formHostRef}
      onFocusCapture={onFormFocus}
      className={cn(
        // The form pane scrolls on its own so the preview stays put — the editor
        // fills the content area instead of scrolling the whole page (a builder).
        'min-h-0 min-w-0 overflow-y-auto',
        view === 'preview' && 'hidden',
        view === 'split' && 'hidden lg:block lg:w-[440px] lg:flex-none',
        view === 'form' && 'w-full flex-1'
      )}
    >
      <EditEntryForm {...form} onBody={setBody} />
    </div>
  );

  const previewPane = (
    <div className={cn('min-h-0 min-w-0 flex-1', view === 'form' && 'hidden')}>
      <div className="h-full overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]">
        <EmbeddedRecordPreview
          tree={preview.tree}
          chrome={preview.chrome}
          catalog={preview.catalog}
          typeKey={preview.typeKey}
          body={body}
          tenantSlug={preview.tenantSlug}
          sitePreview={preview.sitePreview}
          siteOrigin={preview.siteOrigin}
          path={preview.path}
          device={device}
          selectedFieldKey={selectedFieldKey}
          onPickField={onPickField}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* The tenant-brand theme scoped to `.bx-canvas`, so the embedded preview
          paints in the merchant's brand (parity with /builder/studio). */}
      {preview.themeCss ? <style dangerouslySetInnerHTML={{ __html: preview.themeCss }} /> : null}

      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2">
          <Segmented
            value={view}
            onChange={setView}
            options={VIEW_OPTIONS}
            ariaLabel="Editor view"
          />
          <div className="flex items-center gap-2">
            {view !== 'form' ? (
              <Segmented
                value={device}
                onChange={setDevice}
                options={DEVICE_OPTIONS}
                ariaLabel="Preview device"
              />
            ) : null}
            {/* Hand control of the LAYOUT to the real designer: this opens the
                entry's collection template in the builder. Content is edited here;
                structure is edited there. */}
            <Button
              asChild
              variant="outline"
              size="sm"
              leftIcon={<LayoutTemplate className="h-3.5 w-3.5" />}
            >
              <Link href={`/builder/studio?page=${preview.templateId}`}>Edit layout</Link>
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-6">
          {formPane}
          {previewPane}
        </div>
      </div>
    </>
  );
}
