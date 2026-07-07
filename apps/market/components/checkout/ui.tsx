// Shared silicaui-native building blocks for the marketplace checkout forms —
// replacing the bespoke `.mx-form` / `.mx-field` / `.mx-totals` CSS with small
// composable helpers (label+control fields, a totals row). Server-safe.

import type { ReactNode } from 'react';

/** A vertical stack of form fields (was `.mx-form`). */
export function FormStack({ children, ...rest }: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className="flex flex-col gap-4" {...rest}>
      {children}
    </form>
  );
}

/** A labelled form field (was `.mx-field`). `full` spans both columns in a grid. */
export function Field({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      {children}
    </label>
  );
}

/** A two-column responsive field grid (was `.mx-addr`). */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/** One line in an order-totals block (was `.mx-totals__row`). */
export function TotalsRow({
  label,
  value,
  tone = 'muted',
  grand = false,
}: {
  label: string;
  value: string;
  tone?: 'muted' | 'success';
  grand?: boolean;
}) {
  if (grand) {
    return (
      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-default)] pt-3 text-[1.0625rem] font-bold text-[var(--color-text-primary)]">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-between ${
        tone === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
