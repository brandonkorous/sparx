'use client';

// One sellable version: a summary line that opens into its editor.

import { Badge } from '@wizeworks/silicaui-react';
import { faChevronDown, faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { cents, changed, draftProblem, offersCoreFirst, type VariantDraft } from './draft';
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

/** The summary line. A real <button>: it is the control that opens the editor,
 *  so it has to be one for the keyboard too. */
interface SummaryProps {
  variant: Variant;
  label: string;
  draft: VariantDraft;
  isOpen: boolean;
  isDirty: boolean;
  panelId: string;
  onToggle: () => void;
}

function RowSummary({ variant, label, draft, isOpen, isDirty, panelId, onToggle }: SummaryProps) {
  return (
    <button
      type="button"
      className="flex w-full flex-wrap items-center gap-2 text-left"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <Icon
        glyph={isOpen ? faChevronDown : faChevronRight}
        className="size-4 shrink-0"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="tabular-nums">{formatCents(cents(draft.price), variant.currency)}</span>
      {draft.core !== null && draft.core > 0 ? (
        <span className="tabular-nums">
          + {formatCents(cents(draft.core), variant.currency)} core
          {offersCoreFirst(draft) ? ', or old part first' : ''}
        </span>
      ) : null}
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
  );
}

/** The open editor under the summary line. */
function RowPanel(props: {
  id: string;
  variant: Variant;
  label: string;
  draft: VariantDraft;
  problem: string | null;
  onChange: (change: Partial<VariantDraft>) => void;
  onRetire: (variant: Variant) => void;
  onMakeDefault: (variant: Variant) => void;
}) {
  const { variant, draft, onChange } = props;
  return (
    <div id={props.id} className="flex flex-col gap-4 pl-6">
      <VariantEditor
        variant={variant}
        label={props.label}
        draft={draft}
        problem={props.problem}
        onChange={onChange}
      />
      <ParcelSize draft={draft} onChange={onChange} />
      <VariantRisks
        variant={variant}
        onRetire={props.onRetire}
        onMakeDefault={props.onMakeDefault}
      />
    </div>
  );
}

export function VariantRow(props: RowProps & { variant: Variant; label: string }) {
  const { variant, label, onToggle, onChange, onRetire, onMakeDefault } = props;
  const draft = props.drafts[variant.id];
  const before = props.saved[variant.id];
  if (!draft || !before) return null;

  const isOpen = props.open[variant.id] === true;
  const isDirty = changed(draft, before);
  const problem = isDirty ? draftProblem(draft) : null;
  const panelId = `variant-panel-${variant.id}`;

  return (
    <div className="border-base-300 flex flex-col gap-3 border-b pb-3 last:border-b-0">
      <RowSummary
        variant={variant}
        label={label}
        draft={draft}
        isOpen={isOpen}
        isDirty={isDirty}
        panelId={panelId}
        onToggle={() => {
          onToggle(variant.id);
        }}
      />

      {isOpen ? (
        <RowPanel
          id={panelId}
          variant={variant}
          label={label}
          draft={draft}
          problem={problem}
          onChange={(change) => {
            onChange(variant.id, change);
          }}
          onRetire={onRetire}
          onMakeDefault={onMakeDefault}
        />
      ) : null}
    </div>
  );
}
