'use client';

// One row per policy document: what it is called, what state it is in, and the
// one action that moves it forward. Split from `legal-list.tsx` under RULE #0.5.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faArrowsRotate, faCheck, faPenSquare, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { legalItemStatus, legalKindBlurb, type ChecklistItem } from './legal-data';
import { useSiteIsDark } from '../../lib/billing/site-live';

/* ── The checklist rows ─────────────────────────────────────────────────── */

export interface ChecklistRowsProps {
  items: ChecklistItem[];
  onAdd: (item: ChecklistItem) => void;
  onEdit: (item: ChecklistItem, event: { shiftKey: boolean; altKey: boolean }) => void;
  onAcknowledge: (item: ChecklistItem) => void;
  onTakeWording: (item: ChecklistItem) => void;
  /** A sentence under a row when something elsewhere makes the page's words untrue. */
  noteFor?: (item: ChecklistItem) => string | null;
  /** The legalKind currently being instantiated, so only its row shows a spinner. */
  addingKind: string | undefined;
  /** The entry id currently being acknowledged. */
  acknowledgingId: string | undefined;
  /** The entry id currently taking the newer starter wording. */
  takingWordingId: string | undefined;
}

type RowProps = Omit<ChecklistRowsProps, 'items'> & { item: ChecklistItem };

/** A titled card holding one group of rows (the required pages, or the optional ones). */
export function ChecklistGroup({
  title,
  description,
  ...rows
}: ChecklistRowsProps & { title: string; description: string }) {
  if (rows.items.length === 0) return null;
  return (
    <FormSection title={title} description={description}>
      <ChecklistRows {...rows} />
    </FormSection>
  );
}

export function ChecklistRows({ items, ...rest }: ChecklistRowsProps) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <ChecklistRow key={item.legalKind} item={item} {...rest} />
      ))}
    </ul>
  );
}

function ChecklistRow(props: RowProps) {
  const { item, noteFor } = props;
  const siteIsDark = useSiteIsDark();
  const status = legalItemStatus(item, siteIsDark);
  const note = noteFor?.(item) ?? null;
  return (
    <li className="border-base-300 flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <Text className="font-medium">{item.title}</Text>
          <Badge color={status.tone} variant="soft" size="sm">
            {status.label}
          </Badge>
          {(item.stillGuessing ?? []).length > 0 ? (
            <Badge color="warning" variant="soft" size="sm">
              Still our wording
            </Badge>
          ) : null}
        </div>
        <Text className="text-sm">{legalKindBlurb(item.legalKind)}</Text>
        {status.detail ? <Text className="text-sm">{status.detail}</Text> : null}
        {note ? <Text className="text-sm font-medium">{note}</Text> : null}
        <StillGuessing sentences={item.stillGuessing ?? []} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <RowActions {...props} stale={status.stale} />
      </div>
    </li>
  );
}

function RowActions({ stale, ...props }: RowProps & { stale: boolean }) {
  const { item, onAdd, onEdit, onAcknowledge, onTakeWording } = props;
  const entry = item.entry;
  if (entry === null) {
    return (
      <Button
        size="sm"
        color="module"
        loading={props.addingKind === item.legalKind}
        onClick={() => {
          onAdd(item);
        }}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add
      </Button>
    );
  }
  // Acknowledging cannot fix a stale page (only new wording can), so it is offered
  // only when unreviewed starter wording is the whole story.
  const showAcknowledge = !entry.acknowledged && !stale;
  return (
    <>
      {stale ? (
        <Button
          size="sm"
          color="warning"
          loading={props.takingWordingId === entry.id}
          onClick={() => {
            onTakeWording(item);
          }}
        >
          <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
          Use the new wording
        </Button>
      ) : null}
      {showAcknowledge ? (
        <Button
          size="sm"
          variant="soft"
          color="warning"
          loading={props.acknowledgingId === entry.id}
          onClick={() => {
            onAcknowledge(item);
          }}
        >
          <Icon glyph={faCheck} className="size-4" aria-hidden />
          Mark reviewed
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        color="neutral"
        title="Open the editor: hold Shift to open alongside, Alt for a new window"
        onClick={(event) => {
          onEdit(item, event);
        }}
      >
        <Icon glyph={faPenSquare} className="size-4" aria-hidden />
        Edit text
      </Button>
    </>
  );
}

/**
 * What this published page still claims on the business's behalf: a guessed
 * sentence reads as a decision once it is live (issue 375). Console only (issue 267).
 */
function StillGuessing({ sentences }: { sentences: readonly string[] }) {
  if (sentences.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-1">
      {/* The color is on the row's badge: `text-warning` as ink measured 1.44:1. */}
      <Text className="font-medium">Nobody has changed this page, so it still says:</Text>
      <ul className="flex list-disc flex-col gap-0.5 pl-5">
        {sentences.map((sentence) => (
          <li key={sentence}>
            <Text as="span">{sentence}</Text>
          </li>
        ))}
      </ul>
      <Text>
        We had to write something, and we guessed. Change anything that is not how you work.
      </Text>
    </div>
  );
}
