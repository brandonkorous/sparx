'use client';

// One sellable version: a summary line that opens into its editor.

import { Badge } from '@wizeworks/silicaui-react';
import { faChevronDown, faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { cents, changed, draftProblem, type VariantDraft } from './draft';
import { VariantEditor } from './variant-editor';
import { ParcelSize, VariantRisks } from './variant-parcel';
import { formatCents, type Variant } from '../products-data';

export interface RowProps {
  drafts: Record<string, VariantDraft>;
  saved: Record<string, VariantDraft>;
  open: Record<string, true>;
  onToggle: (id: string) => void;
  onChange: (id: string, change: Partial<VariantDraft>) => void;
  onRetire: (variant: Variant) => void;
  onMakeDefault: (variant: Variant) => void;
}

export function VariantRow({
  variant,
  label,
  drafts,
  saved,
  open,
  onToggle,
  onChange,
  onRetire,
  onMakeDefault,
}: RowProps & { variant: Variant; label: string }) {
  const draft = drafts[variant.id];
  const before = saved[variant.id];
  if (!draft || !before) return null;

  const isOpen = open[variant.id] === true;
  const isDirty = changed(draft, before);
  const problem = isDirty ? draftProblem(draft) : null;
  const panelId = `variant-panel-${variant.id}`;

  return (
    <div className="border-base-300 flex flex-col gap-3 border-b pb-3 last:border-b-0">
      {/* A real <button>, not a row with a click handler — this is the control
          that opens the editor, so it has to be one for the keyboard too. */}
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-left"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          onToggle(variant.id);
        }}
      >
        {isOpen ? (
          <Icon glyph={faChevronDown} className="size-4 shrink-0" aria-hidden />
        ) : (
          <Icon glyph={faChevronRight} className="size-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="tabular-nums">{formatCents(cents(draft.price), variant.currency)}</span>
        {variant.isDefault ? (
          <Badge color="info" variant="soft" size="sm">
            Shown first
          </Badge>
        ) : null}
        {isDirty ? (
          <Badge color="warning" variant="soft" size="sm">
            Unsaved
          </Badge>
        ) : null}
      </button>

      {isOpen ? (
        <div id={panelId} className="flex flex-col gap-4 pl-6">
          <VariantEditor
            variant={variant}
            label={label}
            draft={draft}
            problem={problem}
            onChange={(change) => {
              onChange(variant.id, change);
            }}
          />
          <ParcelSize
            draft={draft}
            onChange={(change) => {
              onChange(variant.id, change);
            }}
          />
          <VariantRisks variant={variant} onRetire={onRetire} onMakeDefault={onMakeDefault} />
        </div>
      ) : null}
    </div>
  );
}
