'use client';

// Inspector chrome primitives — the collapsible property CARD, the labelled
// FIELD row, the panel HEADER (selected-node identity), and the segmented toggle.
// These mirror the Builder's inspector primitives 1:1 (icon chip + title + a
// one-line summary shown while collapsed; native <details> for free keyboard +
// a11y), styled via the `.ax-*` classes in automation-editor.css so the two
// editors read as siblings.

import * as React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@sparx/ui';

/** The selected-node header: a tinted icon + title + plain subtitle. */
export function PanelHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="ax-ins-head">
      <span className="ax-ins-head__icon">
        <Icon aria-hidden />
      </span>
      <div className="ax-ins-head__titles">
        <h3>{title}</h3>
        <span className="ax-ins-head__sub">{subtitle}</span>
      </div>
    </header>
  );
}

/** A collapsible property card: icon + title + (collapsed) one-line summary. */
export function InspectorCard({
  icon: Icon,
  title,
  summary,
  caption,
  defaultOpen = true,
  muted = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Current-value preview shown while collapsed. */
  summary?: string;
  /** Optional lead text inside the open body. */
  caption?: string;
  defaultOpen?: boolean;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <details
      className={cn('ax-card', muted && 'ax-card--muted')}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="ax-card__head">
        <span className="ax-card__icon">
          <Icon aria-hidden />
        </span>
        <span className="ax-card__titles">
          <span className="ax-card__title">{title}</span>
          {summary ? <span className="ax-card__summary">{summary}</span> : null}
        </span>
        <ChevronDown className="ax-card__chev" aria-hidden />
      </summary>
      <div className="ax-card__body">
        {caption ? <p className="ax-card__caption">{caption}</p> : null}
        {children}
      </div>
    </details>
  );
}

/** A labelled field row (label + control + optional hint). */
export function Field({
  label,
  required,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ax-field">
      <label className="ax-field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ax-field__req"> *</span> : null}
      </label>
      {children}
      {hint ? <span className="ax-field__hint">{hint}</span> : null}
    </div>
  );
}

/** A segmented (radio-style) toggle. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="ax-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="ax-seg__btn"
          data-on={o.value === value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
