'use client';

// Tax — where you collect it, and how much.
//
// The list is the set of places you are registered to collect tax ("zones").
// Each opens its own create-and-manage pane, where its rates live. Above the
// list, one honest line about who is in charge of the maths: if an automatic-tax
// service is connected it works tax out for you and these settings become a
// backup; otherwise the rates you set here are what shoppers are charged.
//
// Exemptions (a customer who does not pay tax) are deliberately not listed here —
// they belong to a customer or a wholesale account, and are managed from that
// record, so inventing a list of them here would be a place you could never
// actually add one.

import { Badge, Button, EmptyState, Heading, Text } from '@wizeworks/silicaui-react';
import { Banknote, Plus, ServerCrash } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { countryName, regionName } from './geo';
import {
  nexusLabel,
  taxErrorMessage,
  useAutomaticTaxProvider,
  useTaxZones,
  type TaxZone,
} from './tax-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function zonePlace(zone: TaxZone): { title: string; sub: string } {
  if (zone.region) {
    return { title: regionName(zone.region), sub: countryName(zone.country) };
  }
  return { title: countryName(zone.country), sub: 'The whole country' };
}

function ZoneRow({
  zone,
  onOpen,
}: {
  zone: TaxZone;
  onOpen: (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const place = zonePlace(zone);
  return (
    <button
      type="button"
      className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-2 py-2 text-left"
      onClick={(event) => {
        onOpen(zone.id, event);
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{place.title}</span>
        <Text as="span" className="text-sm">
          {place.sub} · {nexusLabel(zone.nexusType)}
        </Text>
      </span>
      {zone.rateCount === 0 ? (
        <Badge color="warning" variant="soft" size="sm">
          No rate set
        </Badge>
      ) : (
        <Badge color="neutral" variant="soft" size="sm">
          {zone.rateCount === 1 ? '1 rate' : `${String(zone.rateCount)} rates`}
        </Badge>
      )}
      <Badge color={zone.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
        {zone.isActive ? 'Collecting' : 'Off'}
      </Badge>
    </button>
  );
}

export function TaxSurface({ ctx }: { ctx: SurfaceContext }) {
  const zones = useTaxZones();
  const auto = useAutomaticTaxProvider();

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.tax.zone.detail', { id }, { target: targetFor(event) });
  };

  const rows = zones.data?.items ?? [];
  const automatic = auto.data ?? null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Tax controls">
        <Banknote className="size-4 shrink-0" aria-hidden />
        <Heading level={2} className="min-w-0 truncate text-base font-semibold">
          Tax
        </Heading>
        {automatic ? (
          <Badge color="info" variant="soft" size="sm">
            Automatic
          </Badge>
        ) : null}
        <RefreshButton
          className="ml-auto"
          isFetching={zones.isFetching}
          updatedAt={zones.data ? zones.dataUpdatedAt : undefined}
          onRefresh={() => {
            void zones.refetch();
            void auto.refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {zones.isError ? (
            <EmptyState
              icon={<ServerCrash className="size-6" aria-hidden />}
              title="Could not load your tax settings"
              description={taxErrorMessage(
                zones.error,
                'This is a problem reaching the server. Your tax settings are unaffected.'
              )}
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    void zones.refetch();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Heading level={1} className="text-2xl font-semibold">
                  Tax you collect
                </Heading>
                <Text className="text-sm">
                  {automatic
                    ? `Tax is worked out automatically by ${automatic.label ?? automatic.providerSlug}. The places and rates below are a backup used only if that service is ever unavailable.`
                    : 'Add a place for each country or state where you have to collect tax, then set the rate. A shopper is only charged tax in a place that is switched on. If you are not sure where you owe tax, check with an accountant.'}
                </Text>
              </div>

              <FormSection
                title="Places you collect tax"
                description="A place is somewhere you are registered to collect tax — usually because you have a shop, an office, staff, or enough sales there."
                action={
                  <Button
                    size="sm"
                    color="module"
                    onClick={(event) => {
                      open('new', event);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add a place
                  </Button>
                }
              >
                {zones.isPending ? (
                  <Text className="text-sm" role="status">
                    Loading…
                  </Text>
                ) : rows.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={<Banknote className="size-6" aria-hidden />}
                    title="No places set up yet"
                    description="Add the first place you collect tax — usually your own country or state — then set its rate and switch it on."
                  />
                ) : (
                  <div className="flex flex-col">
                    {rows.map((zone) => (
                      <ZoneRow key={zone.id} zone={zone} onOpen={open} />
                    ))}
                  </div>
                )}
              </FormSection>

              <Text className="px-1 text-sm">
                Customers who don&apos;t pay tax — resellers, charities, wholesale accounts — are
                handled on their own customer record, not here, so their certificate stays with
                them.
              </Text>

              <p className="px-1 text-xs">
                Click to open · Shift-click to open alongside · Alt-click for a new window
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
