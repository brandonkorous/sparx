'use client';

// Where a saved piece is used — the "change it once, it changes everywhere" half
// of the feature, made visible.
//
// Its own file because it answers its own question. The pane beside it edits the
// piece's identity from a draft the author saves explicitly; this reads a separate
// server answer, has its own loading and error states, and never writes anything.
// Two responsibilities, two files.
//
// Every row OPENS what it names. The card exists to say where the piece lives, and
// the only thing anyone does with that answer is go and look — so a row that names
// the page and cannot reach it is a dead end at the exact moment it became useful
// (issue 417).
//
// AND SOME OF THEM LIVE ON ANOTHER SITE. A saved piece belongs to the business,
// pages belong to a site, so this scan legitimately crosses sites — and an id
// from another one, opened in this workspace, resolves to nothing and reads as
// "This page isn't here any more." The rule for when a row names its site, and
// the words for asking before a switch, are in `saved-piece-usage-words.ts`.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { faFileText, faTableLayout } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { buildPath } from '@wizeworks/links';
import { FormSection } from '../../components/form-section';
import { useActivePropertyId, useSites, switchSite } from '../../lib/api/shell-data';
import { useWorkbench } from '../../lib/workbench/context';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { PieceUsage } from './saved-pieces-data';
import { isElsewhere, namesSites, switchAsk, type Placement } from './saved-piece-usage-words';

export function UsagePanel({
  ctx,
  usage,
  isPending,
  isError,
}: {
  ctx: SurfaceContext;
  usage: PieceUsage | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const confirm = useConfirm();
  const { controller } = useWorkbench();
  const activeSiteId = useActivePropertyId();
  const { data: sites } = useSites();

  const rows = usage
    ? [
        ...usage.pages.map((page) => ({ ...page, kind: 'Page' as const })),
        ...usage.layouts.map((layout) => ({ ...layout, kind: 'Layout' as const })),
      ]
    : [];
  const showSite = namesSites(rows, activeSiteId);

  /**
   * Open a placement, switching sites first when it belongs to another one.
   *
   * The switch is a full reload (layouts are per-site), so it holds the same
   * conversation the site switcher and the cross-business link both hold. The
   * address is built with the target site's slug so the workbench comes back up
   * on the page rather than on the root.
   */
  const open = async (row: Placement & { kind: 'Page' | 'Layout' }, event: React.MouseEvent) => {
    const surface = row.kind === 'Page' ? 'builder.page' : 'builder.layout';
    const params = row.kind === 'Page' ? { pageId: row.id } : undefined;

    if (!isElsewhere(row, activeSiteId)) {
      // Same modifier contract as every list in the app: plain opens a tab,
      // Shift docks it alongside, Alt tears it into its own window.
      ctx.open(surface, params, {
        target: event.altKey ? 'window' : event.shiftKey ? 'beside' : 'tab',
      });
      return;
    }

    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        ...switchAsk(row),
        confirmLabel: 'Switch and open',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    const slug = sites?.find((site) => site.id === row.siteId)?.slug;
    // `?? undefined` rather than a bare root: a switch that lands nowhere in
    // particular is still the right site, and is better than refusing to move.
    const address = buildPath(surface, params, slug ? { site: slug } : undefined) ?? undefined;
    await switchSite(controller, activeSiteId ?? 'default', row.siteId, address ? { address } : {});
  };

  return (
    <FormSection
      title="Where it's used"
      description="Every page and layout this piece appears on, across all your sites. Click one to open it. Change it here or in the editor and all of these update together."
    >
      {isError ? (
        <Text className="text-sm">Could not check where this is used just now.</Text>
      ) : isPending ? (
        <Text className="text-sm" role="status">
          Checking…
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">
          This piece isn&apos;t on any page or layout yet. Add it to a page in the editor and it
          will appear here.
        </Text>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={`${row.kind}:${row.id}`} className="border-base-300 border-b last:border-b-0">
              <button
                type="button"
                onClick={(event) => {
                  void open(row, event);
                }}
                className="hover:bg-base-200 flex w-full items-center gap-3 rounded px-1 py-2 text-left"
              >
                {row.kind === 'Page' ? (
                  <Icon glyph={faFileText} className="size-4 shrink-0" aria-hidden />
                ) : (
                  <Icon glyph={faTableLayout} className="size-4 shrink-0" aria-hidden />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <Text className="truncate font-medium">{row.name}</Text>
                  {showSite ? <Text className="truncate text-sm">{row.siteName}</Text> : null}
                </span>
                {/* Colorless, not grey-by-name. "Page" and "Layout" are two kinds
                    of thing and `neutral` says neither of them; a bare badge takes
                    the surface's own ink and stays right in both themes. */}
                <Badge variant="soft" size="sm" className="shrink-0">
                  {row.kind}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
