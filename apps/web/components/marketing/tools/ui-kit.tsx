'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from '@sparx/ui';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  ColorPicker,
  Field as SilicaField,
  FieldDescription,
  FieldLabel,
  Input,
  Range,
  type ButtonProps,
  type RangeProps,
} from '@wizeworks/silicaui-react';
import { parseHex, rgbToHex } from './lib/color';

/**
 * Shared client building blocks for the tools — a copy-to-clipboard button, a
 * labeled field wrapper, a scalar slider, and the responsive two-pane
 * "workbench" (controls left, live output right).
 *
 * Every surface and control here comes from silicaui; this file contributes
 * LAYOUT ONLY. It never declares a background + foreground pair, a border, or a
 * radius — that is re-skinning a control, and because ~18 tools inherit their
 * look from `Panel`/`Field`, a skin invented here silently becomes the whole
 * /tools section's design system. Named layout classes (`.tool-*`) live in
 * app/marketing.css; apps/web is class-based, so prefer one of those over an
 * inline `style` prop.
 */

/** Copy `value` to the clipboard with a transient "Copied" toast + icon flip. */
export function useCopy(): { copied: boolean; copy: (value: string, label?: string) => void } {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => clear(timer), []);
  const copy = React.useCallback((value: string, label = 'Copied to clipboard') => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        toast.success(label);
        clear(timer);
        timer.current = setTimeout(() => setCopied(false), 1600);
      },
      () => toast.error('Could not copy — your browser blocked clipboard access')
    );
  }, []);
  return { copied, copy };
}

function clear(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) clearTimeout(ref.current);
}

export interface CopyButtonProps extends Omit<ButtonProps, 'children' | 'onClick'> {
  /** Static value, or pass `getValue` to compute lazily on click. */
  value?: string;
  getValue?: () => string;
  label?: string;
  copiedLabel?: string;
  /** Toast message on success. */
  toastLabel?: string;
}

/** A button that copies a string and shows "Copied" feedback for a beat. */
export function CopyButton({
  value,
  getValue,
  label = 'Copy',
  copiedLabel = 'Copied',
  toastLabel,
  variant = 'outline',
  color = 'neutral',
  size = 'sm',
  ...rest
}: CopyButtonProps) {
  const { copied, copy } = useCopy();
  return (
    <Button
      type="button"
      variant={variant}
      color={color}
      size={size}
      onClick={() => copy(getValue ? getValue() : (value ?? ''), toastLabel ?? `${label} done`)}
      {...rest}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  /** Right-aligned adornment on the label row (e.g. a char counter). */
  adornment?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Vertical labeled field: label row, control, optional hint. Rendered through
 * silica's `Field`/`FieldLabel` for consistent look + a11y (`required` draws the
 * asterisk). The control is passed as `children` — the tools hand it heterogeneous
 * inputs (silica `Input`/`Textarea`, `ColorPicker`, `FileUpload`, sliders, canvas-
 * wired controls), so we don't force a `FieldControl` here; the bespoke inline
 * layout (label row + adornment + hint) is preserved.
 */
export function Field({ label, htmlFor, hint, required, adornment, children }: FieldProps) {
  return (
    <SilicaField className="tool-field">
      {label || adornment ? (
        <div className="tool-field__head">
          {label ? (
            <FieldLabel htmlFor={htmlFor} required={required}>
              {label}
            </FieldLabel>
          ) : (
            <span />
          )}
          {adornment ? <span className="tool-field__adornment">{adornment}</span> : null}
        </div>
      ) : null}
      {children}
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </SilicaField>
  );
}

export interface NumberRangeProps extends Omit<
  RangeProps,
  'value' | 'defaultValue' | 'onValueChange'
> {
  value: number;
  onValueChange: (value: number) => void;
}

/**
 * Single-thumb slider bound to a plain number.
 *
 * ALWAYS drive silica's `Range` with a scalar — never a one-element array. Base
 * UI (1.0.0-rc.0) decides "is this a multi-thumb range?" two different ways:
 * `SliderRoot` checks `Array.isArray(value)`, `SliderControl` checks
 * `values.length > 1`. A one-element array makes them disagree, so the POINTER
 * path emits a bare number while the KEYBOARD path emits an array. A call site
 * that unwraps with `v[0]` then reads `undefined` on every drag and the
 * controlled thumb snaps straight back — arrow keys work, dragging doesn't.
 * Scalar in, scalar out, both paths agree. This wrapper is the only place that
 * has to know, so no tool can reintroduce it.
 */
export function NumberRange({ value, onValueChange, ...rest }: NumberRangeProps) {
  return (
    <Range
      {...rest}
      value={value}
      onValueChange={(v) => onValueChange(typeof v === 'number' ? v : (v[0] ?? value))}
    />
  );
}

export interface HexColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  /** Accessible name for the swatch and the text input. */
  label: string;
  id?: string;
}

/**
 * A color control that keeps hex entry one keystroke away.
 *
 * Silica's `ColorPicker` is OKLCH-native and, in `variant="swatch"`, keeps its
 * hex field INSIDE the popover. Every tool here is hex-first — people arrive
 * with a brand hex to paste — so the swatch is paired with a visible mono
 * `Input`. Without this pairing the silica swap is a straight downgrade from the
 * control it replaced, which had an always-visible hex field.
 *
 * Two details that are load-bearing, not incidental:
 *  - `format="hex"` is REQUIRED. Silica defaults to OKLCH output, which would
 *    push `oklch(…)` strings into the canvas/render paths and break them
 *    silently — a runtime bug, not a type error.
 *  - The input holds a DRAFT and only lifts the value once it parses. Typing
 *    "#1a2" through to "#1a2b3c" would otherwise fire a stream of half-finished
 *    hexes at whatever derives from this color. Committing through
 *    `parseHex`/`rgbToHex` also normalizes shorthand, so "#abc" reaches state as
 *    "#aabbcc" and downstream comparisons don't see two spellings of one color.
 */
export function HexColorField({ value, onChange, label, id }: HexColorFieldProps) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  return (
    <div className="flex items-center gap-2">
      <ColorPicker
        variant="swatch"
        format="hex"
        value={value}
        onValueChange={(v) => onChange(v)}
        aria-label={label}
      />
      <Input
        id={id}
        value={draft}
        spellCheck={false}
        aria-label={label}
        className="font-mono"
        onChange={(e) => {
          const raw = e.target.value;
          const next = raw === '' || raw.startsWith('#') ? raw : `#${raw}`;
          setDraft(next);
          const rgb = parseHex(next);
          if (rgb) onChange(rgbToHex(rgb));
        }}
      />
    </div>
  );
}

export interface CodeBlockProps {
  children: React.ReactNode;
  /** `none` for a snippet that should never scroll, `short` for a compact well. */
  height?: 'default' | 'short' | 'none';
  className?: string;
}

/**
 * A read-only well for generated markup/JSON the visitor copies out.
 *
 * Silica ships no "light code well" primitive — `MockupCode` is a dark terminal,
 * which is a different thing — so this composes one from silica TOKENS
 * (`base-200` inset on the `base-100` panel, `base-300` hairline) in a single
 * place. That keeps it theme-aware and consistent without re-inventing the skin
 * in each of the seven tools that emit a snippet.
 */
export function CodeBlock({ children, height = 'default', className }: CodeBlockProps) {
  return (
    <pre
      className={[
        'bg-base-200 border-base-300 m-0 overflow-auto rounded-lg border p-4',
        'text-mini font-mono whitespace-pre [tab-size:2]',
        height === 'default' && 'tool-code',
        height === 'short' && 'tool-code tool-code--short',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </pre>
  );
}

export interface PanelProps {
  title?: React.ReactNode;
  /** Optional right-aligned header content (a reset link, a toggle). */
  action?: React.ReactNode;
  /** Extra layout classes for the body (e.g. `tool-panel__body--flush`). */
  className?: string;
  children: React.ReactNode;
}

/**
 * A grouped surface for a cluster of controls or a preview.
 *
 * The surface is silica's `Card` — this component contributes LAYOUT only (the
 * header row and the control stack's rhythm). It must never re-declare the
 * background, border, or radius: that skin belongs to `Card`, and a tool panel
 * that hand-rolls it drifts out of the design system the moment a token moves.
 */
export function Panel({ title, action, className, children }: PanelProps) {
  return (
    <Card>
      <CardBody className={['tool-panel__body', className].filter(Boolean).join(' ')}>
        {title || action ? (
          <header className="tool-panel__head">
            {title ? <CardTitle className="tool-panel__title">{title}</CardTitle> : <span />}
            {action}
          </header>
        ) : null}
        {children}
      </CardBody>
    </Card>
  );
}

/** Two-pane responsive layout: controls column + live-output column. */
export function Workbench({ children }: { children: React.ReactNode }) {
  return <div className="tool-workbench">{children}</div>;
}

/** Left column — a vertical stack of control panels. */
export function ControlsPane({ children }: { children: React.ReactNode }) {
  return <div className="tool-pane">{children}</div>;
}

/** Right column — the live preview / output, sticky on desktop. */
export function OutputPane({ children }: { children: React.ReactNode }) {
  return <div className="tool-pane tool-sticky">{children}</div>;
}
