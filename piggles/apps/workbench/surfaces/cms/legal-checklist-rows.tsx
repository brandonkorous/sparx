'use client';

// One row per policy document: what it is called, what state it is in, and the
// one action that moves it forward. Split from `legal-list.tsx` under RULE #0.5.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faArrowsRotate, faCheck, faPenSquare, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { legalItemStatus, legalKindBlurb, type ChecklistItem } from './legal-data';

/* ── The checklist rows ─────────────────────────────────────────────────── */

export interface ChecklistRowsProps {
  items: ChecklistItem[];
  onAdd: (item: ChecklistItem) => void;
  onEdit: (item: ChecklistItem, event: { shiftKey: boolean; altKey: boolean }) => void;
  onAcknowledge: (item: ChecklistItem) => void;
  onTakeWording: (item: ChecklistItem) => void;
  /** The legalKind currently being instantiated, so only its row shows a spinner. */
  addingKind: string | undefined;
  /** The entry id currently being acknowledged. */
  acknowledgingId: string | undefined;
  /** The entry id currently taking the newer starter wording. */
  takingWordingId: string | undefined;
}

export function ChecklistRows({
  items,
  onAdd,
  onEdit,
  onAcknowledge,
  onTakeWording,
  addingKind,
  acknowledgingId,
  takingWordingId,
}: ChecklistRowsProps) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const status = legalItemStatus(item);
        const entry = item.entry;
        // Acknowledging only clears the "unreviewed starter wording" note — it
        // cannot resolve a newer-version-available (stale) page, whose real fix
        // is editing the text. So it is offered only when that is the whole story.
        const showAcknowledge = entry !== null && !entry.acknowledged && !status.stale;

        return (
          <li
            key={item.legalKind}
            className="border-base-300 flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0"
          >
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
              <StillGuessing sentences={item.stillGuessing ?? []} />
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {entry === null ? (
                <Button
                  size="sm"
                  color="module"
                  loading={addingKind === item.legalKind}
                  onClick={() => {
                    onAdd(item);
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Add
                </Button>
              ) : (
                <>
                  {status.stale ? (
                    <Button
                      size="sm"
                      color="warning"
                      loading={takingWordingId === entry.id}
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
                      loading={acknowledgingId === entry.id}
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
                    title="Open the editor — hold Shift to open alongside, Alt for a new window"
                    onClick={(event) => {
                      onEdit(item, event);
                    }}
                  >
                    <Icon glyph={faPenSquare} className="size-4" aria-hidden />
                    Edit text
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What this published page still claims on the business's behalf.
 *
 * A starter has to say SOMETHING about a return window and a packing time, and a
 * blank on a policy page is worse than a sensible default — but a number on a
 * published page is indistinguishable from a decision, and the page is what
 * governs when a customer disputes it. A real shop published "orders are usually
 * processed within one to two business days" while posting on Tuesdays and
 * Fridays, and every signal the console had said that page was done (issue 375).
 *
 * Nothing of this reaches the published page: issue 267 settled that a legal body
 * addresses the visitor and never the owner. This is the console, which is where
 * the note belongs.
 */
function StillGuessing({ sentences }: { sentences: readonly string[] }) {
  if (sentences.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-1">
      {/* The COLOUR is on the badge in the row above, not on this text. `text-warning`
          is a fill colour: as ink on a white card it measured 1.44:1 at 14px, which
          is the exact failure this block exists to warn about. Sentences somebody is
          meant to read get the inherited ink and the reading size. */}
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
