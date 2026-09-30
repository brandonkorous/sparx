'use client';

// The lines of a count — being counted, or read back afterwards.
//
// On a BLIND count the server sends no expected quantity while counting, so
// there is nothing to show and no difference to compute. The columns go away
// rather than showing an em-dash: an empty column invites someone to go and look
// the number up, which is exactly what blind counting is preventing.

import { Badge, Button, Heading, Input, Text, Textarea } from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { deltaTone, signedDelta } from './movements-data';
import { varianceLabel, varianceTone, type CountDetail, type CountLine } from './counts-data';
import { parseQty } from './count-shared';
import { askWhy, whyFieldLabel, whyIntro, whyPlaceholder } from './count-why';

interface LinesProps {
  count: CountDetail;
  editable: boolean;
  drafts: Record<string, string>;
  setDraft: (lineId: string, value: string) => void;
  /** What has been typed into the why boxes, by line id. Kept apart from
   *  `drafts` so correcting a number never disturbs the words beside it. */
  whyDrafts: Record<string, string>;
  setWhy: (lineId: string, value: string) => void;
  onRemove: (line: CountLine) => void;
  removingId: string | null;
}

function introFor(editable: boolean, blind: boolean): string {
  if (blind) {
    return 'Put in what you actually find. What the system expected is hidden until the count is submitted, so the number you write down is the number you saw.';
  }
  return editable
    ? 'Put in what you actually find on the shelf. The difference from what we expected is worked out for you.'
    : 'The quantities counted, and how they differed from what was expected.';
}

export function LinesCard({
  count,
  editable,
  drafts,
  setDraft,
  whyDrafts,
  setWhy,
  onRemove,
  removingId,
}: LinesProps) {
  const posted = count.status === 'posted';
  const blind = count.isBlind && count.status === 'counting';

  return (
    <section className="card bg-base-100 flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <Heading level={2} className="text-lg font-semibold">
          {editable ? 'Count each item' : 'What was counted'}
        </Heading>
        <Text className="text-sm">{introFor(editable, blind)}</Text>
        {/* Said once here rather than as a label over every box: a full
            count is a hundred lines, and a hundred repetitions of the same
            four words down the screen is not a label, it is wallpaper. */}
        {editable ? <Text className="text-sm">{whyIntro(blind)}</Text> : null}
      </div>

      <Table size="sm">
        <thead>
          <tr>
            <th>Item</th>
            {blind ? null : (
              <th className="hidden text-right whitespace-nowrap @md:table-cell">We think</th>
            )}
            <th className="text-right whitespace-nowrap">Counted</th>
            {blind ? null : <th>{posted ? 'Correction' : 'Difference'}</th>}
            {editable ? <th className="w-0" /> : null}
          </tr>
        </thead>
        <tbody>
          {count.lines.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              blind={blind}
              posted={posted}
              editable={editable}
              draft={drafts[line.id]}
              setDraft={setDraft}
              whyDraft={whyDrafts[line.id]}
              setWhy={setWhy}
              onRemove={onRemove}
              removing={removingId === line.id}
            />
          ))}
        </tbody>
      </Table>
    </section>
  );
}

interface RowProps {
  line: CountLine;
  blind: boolean;
  posted: boolean;
  editable: boolean;
  draft: string | undefined;
  setDraft: (lineId: string, value: string) => void;
  whyDraft: string | undefined;
  setWhy: (lineId: string, value: string) => void;
  onRemove: (line: CountLine) => void;
  removing: boolean;
}

function LineRow({
  line,
  blind,
  posted,
  editable,
  draft,
  setDraft,
  whyDraft,
  setWhy,
  onRemove,
  removing,
}: RowProps) {
  const counted = draft !== undefined ? parseQty(draft) : line.countedQuantity;
  const variance =
    counted === null || line.expectedQuantity === null ? null : counted - line.expectedQuantity;
  const why = whyDraft ?? line.note ?? '';
  const ask =
    editable && askWhy({ counted, difference: variance, hasWords: why.trim().length > 0 });
  const what = line.variantSku ?? line.productTitle ?? 'this item';

  return (
    <tr>
      <td className="w-full max-w-0 min-w-56">
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{line.productTitle ?? 'Untitled product'}</span>
          <span className="truncate font-mono text-sm">{line.variantSku ?? 'No code'}</span>
          {blind ? null : (
            <span className="truncate text-sm @md:hidden">
              We think {String(line.expectedQuantity ?? '—')} here
            </span>
          )}
          {/* The words live in the item's own cell rather than in a column
              or a row of their own. A column would take width from the item
              name, which is already the cell that gives; a separate row
              would be cut off from its line by the table's row border. */}
          {ask ? (
            <Textarea
              color="module"
              rows={2}
              className="mt-1 w-full min-w-0"
              aria-label={whyFieldLabel(blind, what)}
              placeholder={whyPlaceholder(blind)}
              maxLength={2000}
              value={why}
              onChange={(event) => {
                setWhy(line.id, event.target.value);
              }}
            />
          ) : null}
          {/* Read back once the count is closed. This is the whole reason
              the box exists: applying a count rewrites the stock numbers, so
              the figures look after themselves and the reason does not. */}
          {!editable && line.note ? (
            <span className="mt-1 block text-sm whitespace-pre-wrap">{line.note}</span>
          ) : null}
        </span>
      </td>

      {blind ? null : (
        <td className="hidden text-right tabular-nums @md:table-cell">
          {line.expectedQuantity ?? '—'}
        </td>
      )}

      <td className="text-right">
        {editable ? (
          <Input
            color="module"
            size="sm"
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={`Counted quantity for ${line.variantSku ?? 'item'}`}
            /* `w-24`, not `max-w-24`. A ceiling is not a floor: beside the
               `w-full` item column this box could still be squeezed under it,
               and the count somebody typed is the one number on this screen
               that must be readable. */
            className="ml-auto w-24 text-right"
            value={draft ?? line.countedQuantity?.toString() ?? ''}
            onChange={(event) => {
              setDraft(line.id, event.target.value);
            }}
          />
        ) : (
          <span className="tabular-nums">{line.countedQuantity ?? '—'}</span>
        )}
      </td>

      {blind ? null : (
        <td>
          {posted ? (
            <AppliedBadge delta={line.appliedDelta} />
          ) : (
            <Badge color={varianceTone(variance)} variant="soft" size="sm">
              {varianceLabel(variance)}
            </Badge>
          )}
        </td>
      )}

      {editable ? (
        <td>
          <Button
            size="sm"
            variant="ghost"
            shape="square"
            aria-label={`Remove ${line.variantSku ?? 'this item'} from the count`}
            title="Remove from this count"
            loading={removing}
            onClick={() => {
              onRemove(line);
            }}
          >
            <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          </Button>
        </td>
      ) : null}
    </tr>
  );
}

function AppliedBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return (
      <Badge variant="soft" size="sm">
        No change
      </Badge>
    );
  }
  return (
    <Badge color={deltaTone(delta)} variant="soft" size="sm">
      <span className="tabular-nums">{signedDelta(delta)}</span>
    </Badge>
  );
}
