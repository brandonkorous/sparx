'use client';

// The footer links: which legal pages a visitor can actually reach, and adding or
// removing one. Split from `legal-list.tsx` under RULE #0.5.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faEye, faEyeSlash, faLink, faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { FormSection } from '../../components/form-section';
import { contentErrorMessage, entryStatusState } from './data';
import type { useLegalPlacements } from './legal-data';
import {
  useAddPlacement,
  useRemovePlacement,
  useSetPlacementEnabled,
  type ChecklistItem,
  type LegalPlacement,
} from './legal-data';

/* ── Footer placements ──────────────────────────────────────────────────── */

export interface PlacementsSectionProps {
  ctx: SurfaceContext;
  items: ChecklistItem[];
  placements: ReturnType<typeof useLegalPlacements>;
}

export function PlacementsSection({ items, placements }: PlacementsSectionProps) {
  const toast = useToast();
  const confirm = useConfirm();

  const add = useAddPlacement();
  const setEnabled = useSetPlacementEnabled();
  const remove = useRemovePlacement();

  const [pick, setPick] = useState('');

  const rows = placements.data ?? [];

  // A page can be linked only if it exists AND is not already in the footer.
  const placedEntryIds = useMemo(
    () =>
      new Set(
        (placements.data ?? []).map((row) => row.entryId).filter((id): id is string => id !== null)
      ),
    [placements.data]
  );
  const candidates = useMemo(
    () => items.filter((item) => item.entry !== null && !placedEntryIds.has(item.entry.id)),
    [items, placedEntryIds]
  );

  // Names for the footer rows: prefer the placement's own label, then the
  // document's proper name, then its address — never a blank row.
  const titleByEntryId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.entry) map.set(item.entry.id, item.title);
    }
    return map;
  }, [items]);

  const linkChosen = () => {
    const item = candidates.find((candidate) => candidate.entry?.id === pick);
    if (!item?.entry) return;
    add.mutate(
      { entryId: item.entry.id, label: item.title },
      {
        onSuccess: () => {
          setPick('');
          toast.add({ title: `${item.title} linked in your footer`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not link this page',
            description: contentErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const toggle = (row: LegalPlacement) => {
    setEnabled.mutate(
      { id: row.id, enabled: !row.enabled },
      {
        onError: (error) => {
          toast.add({
            title: 'Could not change this link',
            description: contentErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const removeRow = async (row: LegalPlacement) => {
    const name = placementName(row, titleByEntryId);
    const ok = await confirm({
      title: `Remove “${name}” from your footer?`,
      description:
        'This only takes the link out of your footer — the page itself, and everything on it, stays exactly as it is. You can link it again whenever you like.',
      confirmLabel: 'Remove the link',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(row.id, {
      onSuccess: () => {
        toast.add({ title: `${name} unlinked from your footer`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this link',
          description: contentErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <FormSection
      title="Links in your footer"
      description="The legal pages people can reach from the footer at the bottom of every page."
    >
      {placements.isError ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>Could not load your footer links</AlertTitle>
            <AlertDescription>This is a problem reaching the server.</AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="warning"
            variant="soft"
            onClick={() => {
              void placements.refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      ) : placements.isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : (
        <>
          {rows.length === 0 ? (
            <Text className="text-sm">
              No legal pages are linked in your footer yet. Add one below so visitors can find it.
            </Text>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => {
                const name = placementName(row, titleByEntryId);
                const state = row.status ? entryStatusState(row.status) : null;
                return (
                  <li
                    key={row.id}
                    className="border-base-300 flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-[1_1_16rem] flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon glyph={faLink} className="size-4 shrink-0" aria-hidden />
                        <Text className="font-medium">{name}</Text>
                        {!row.enabled ? (
                          <Badge color="neutral" variant="soft" size="sm">
                            Hidden
                          </Badge>
                        ) : null}
                        {state ? (
                          <Badge color={state.tone} variant="soft" size="sm">
                            {state.label}
                          </Badge>
                        ) : null}
                      </div>
                      <Text className="text-sm">
                        {row.propertyId === null
                          ? 'Shown on every site you run.'
                          : 'Shown on this site only.'}
                        {row.slug ? ` · /${row.slug}` : ''}
                      </Text>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        loading={setEnabled.isPending && setEnabled.variables?.id === row.id}
                        title={
                          row.enabled ? 'Hide this link without removing it' : 'Show this link'
                        }
                        onClick={() => {
                          toggle(row);
                        }}
                      >
                        {row.enabled ? (
                          <Icon glyph={faEyeSlash} className="size-4" aria-hidden />
                        ) : (
                          <Icon glyph={faEye} className="size-4" aria-hidden />
                        )}
                        {row.enabled ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        color="danger"
                        loading={remove.isPending && remove.variables === row.id}
                        onClick={() => {
                          void removeRow(row);
                        }}
                      >
                        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {candidates.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <label className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
                <span className="text-sm font-medium">Link another page</span>
                <NativeSelect
                  color="module"
                  value={pick}
                  aria-label="Choose a page to link in your footer"
                  onChange={(event) => {
                    setPick(event.target.value);
                  }}
                >
                  <option value="">Choose a page…</option>
                  {candidates.map((item) => (
                    <option key={item.legalKind} value={item.entry?.id ?? ''}>
                      {item.title}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button
                size="sm"
                color="module"
                disabled={pick === ''}
                loading={add.isPending}
                onClick={linkChosen}
              >
                <Icon glyph={faPlus} className="size-4" aria-hidden />
                Link to footer
              </Button>
            </div>
          ) : rows.length > 0 ? (
            <Text className="text-sm">
              Every legal page you have added is already linked. Add a new page above to link more.
            </Text>
          ) : null}
        </>
      )}
    </FormSection>
  );
}

/** The best available name for a footer link: its own label, then the document's
 *  proper name, then its address, then a safe fallback. */
function placementName(row: LegalPlacement, titleByEntryId: Map<string, string>): string {
  if (row.label && row.label.trim() !== '') return row.label.trim();
  if (row.entryId) {
    const title = titleByEntryId.get(row.entryId);
    if (title) return title;
  }
  if (row.slug) return `/${row.slug}`;
  return 'Legal page';
}
