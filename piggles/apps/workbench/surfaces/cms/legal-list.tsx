'use client';

// The legal-pages checklist: a card per group with a row per document (never a
// table), the cookie banner, and the footer links. "Edit text" hands off to the
// one content editor (`cms.content.detail`); this surface owns no prose editor.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, Text } from '@wizeworks/silicaui-react';
import { faScaleBalanced } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { ShippingPolicyNotice } from './shipping-policy-notice';
import { ChecklistGroup, type ChecklistRowsProps } from './legal-checklist-rows';
import { PlacementsSection } from './legal-placements';
import { LegalReadinessAlert, LegalReadinessBadge } from './legal-readiness';
import { useAcknowledgeLegal, useAddLegalPage, useTakeLegalWording } from './legal-actions';
import { CookieBannerSection } from './cookie-banner-section';
import { cookiePolicyNote, useCookieBanner } from './cookie-banner-data';
import { useLegalChecklist, useLegalPlacements, type LegalChecklist } from './legal-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type RowHandlers = Omit<ChecklistRowsProps, 'items'>;

/** Same modifier contract as every other list in the app: Shift alongside, Alt a new window. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function LegalListSurface({ ctx }: { ctx: SurfaceContext }) {
  const checklist = useLegalChecklist();
  const placements = useLegalPlacements();
  const cookieBanner = useCookieBanner();
  const add = useAddLegalPage();
  const takeWording = useTakeLegalWording();
  const acknowledge = useAcknowledgeLegal();

  const rows: RowHandlers = {
    onAdd: add.run,
    onEdit: (item, event) => {
      if (item.entry)
        ctx.open('cms.content.detail', { id: item.entry.id }, { target: targetFor(event) });
    },
    onAcknowledge: acknowledge.run,
    onTakeWording: takeWording.run,
    noteFor: (item) =>
      cookiePolicyNote(item.legalKind, item.entry?.status ?? null, cookieBanner.data),
    addingKind: add.busy,
    acknowledgingId: acknowledge.busy,
    takingWordingId: takeWording.busy,
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Legal pages controls"
        status={
          checklist.data ? <LegalReadinessBadge completeness={checklist.data.completeness} /> : null
        }
        refresh={
          <RefreshButton
            isFetching={checklist.isFetching || placements.isFetching || cookieBanner.isFetching}
            updatedAt={checklist.data ? checklist.dataUpdatedAt : undefined}
            // The whole screen, not only the page list: the footer links and the cookie
            // banner are on it too, and a refresh that skipped them showed a deleted
            // page's link as still there (sparx persona issue 041).
            onRefresh={() => {
              void checklist.refetch();
              void placements.refetch();
              void cookieBanner.refetch();
            }}
          />
        }
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        {checklist.isError ? (
          <PaneLoadError
            icon={<Icon glyph={faScaleBalanced} className="size-6" aria-hidden />}
            title="Could not load your legal pages"
            description="This is a problem reaching the server. None of your pages are affected. Nothing has been lost."
            onRetry={() => {
              void checklist.refetch();
            }}
          />
        ) : checklist.isPending ? (
          <PaneWaiting />
        ) : (
          <LegalBody ctx={ctx} data={checklist.data} placements={placements} rows={rows} />
        )}
      </Card>
    </div>
  );
}

function LegalBody({
  ctx,
  data,
  placements,
  rows,
}: {
  ctx: SurfaceContext;
  data: LegalChecklist;
  placements: ReturnType<typeof useLegalPlacements>;
  rows: RowHandlers;
}) {
  const items = data.items;
  return (
    <div className="p-3 @lg:p-4">
      <div className={COLUMN}>
        <Text>
          The policy pages people expect to find on your site. Add each one from a starter template,
          make the wording fit your business, then publish it.
        </Text>
        <LegalReadinessAlert completeness={data.completeness} items={items} />
        {data.shipping?.missingPolicy ? (
          <ShippingPolicyNotice because={data.shipping.because} />
        ) : null}
        <ChecklistGroup
          title="Pages you should have"
          description="These are the policies a business like yours is normally expected to publish."
          items={items.filter((item) => item.required)}
          {...rows}
        />
        <ChecklistGroup
          title="Optional pages"
          description="Helpful to have, but not required. Add one if it fits how you do business."
          items={items.filter((item) => !item.required)}
          {...rows}
        />
        <CookieBannerSection
          cookiePolicy={items.find((item) => item.legalKind === 'cookie-policy')}
        />
        <PlacementsSection ctx={ctx} items={items} placements={placements} />
      </div>
    </div>
  );
}
