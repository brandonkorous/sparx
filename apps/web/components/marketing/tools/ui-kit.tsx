'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from '@sparx/ui';
import {
  Button,
  Field as SilicaField,
  FieldLabel,
  type ButtonProps,
} from '@wizeworks/silicaui-react';

/**
 * Shared client building blocks for the tools — a copy-to-clipboard button, a
 * labeled field wrapper, and the responsive two-pane "workbench" (controls left,
 * live output right). These compose @sparx/ui controls and the marketing tokens;
 * they never re-skin a control. Layout/structure only — the named `.tool-*`
 * classes live in app/marketing.css.
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
    <SilicaField style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
      {label || adornment ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {label ? (
            <FieldLabel htmlFor={htmlFor} required={required}>
              {label}
            </FieldLabel>
          ) : (
            <span />
          )}
          {adornment ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {adornment}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
      {hint ? (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12.5px',
            lineHeight: '18px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          {hint}
        </span>
      ) : null}
    </SilicaField>
  );
}

export interface PanelProps {
  title?: React.ReactNode;
  /** Optional right-aligned header content (a reset link, a toggle). */
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** A grouped surface for a cluster of controls or a preview. */
export function Panel({ title, action, children, style }: PanelProps) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        padding: '22px',
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: 'var(--radius-xl)',
        ...style,
      }}
    >
      {title ? (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '14px',
              letterSpacing: '-0.01em',
              color: 'var(--color-base-content)',
              margin: 0,
            }}
          >
            {title}
          </h3>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Two-pane responsive layout: controls column + live-output column. */
export function Workbench({ children }: { children: React.ReactNode }) {
  return <div className="tool-workbench">{children}</div>;
}

/** Left column — a vertical stack of control panels. */
export function ControlsPane({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
      {children}
    </div>
  );
}

/** Right column — the live preview / output, sticky on desktop. */
export function OutputPane({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="tool-sticky"
      style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}
    >
      {children}
    </div>
  );
}
