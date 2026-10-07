'use client';

// Whether online orders ship from this place, and what a courier still needs
// from it (issue 929).
//
// Devi's Main Warehouse was where every parcel left from. Postage was priced
// from its address and labels printed with it, and its address was "US". The
// pane said "Used on paperwork, and by couriers" over a postal code marked
// optional, and nothing said this was THE place, or that a courier could not
// price a parcel from it. Nor could she choose another place to ship from: the
// setting existed on the server and had no control anywhere.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Checkbox,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { useReachableModules } from '../../lib/surfaces/use-visible-nav';
import { useStockLocations } from './data';
import type { Location } from './locations-data';
import {
  canShipFrom,
  courierGaps,
  listOf,
  type ShipFromAddress as AddressDraft,
} from './location-ship-from';

/** What this section reads and writes on the location form's draft. */
interface Draft extends AddressDraft {
  isActive: boolean;
  shipsOnline: boolean;
}

function CourierGap({ draft }: { draft: Draft }) {
  const gaps = courierGaps(draft);
  if (gaps.length === 0) return null;
  return (
    <Alert color="warning" variant="soft">
      <AlertContent>
        <AlertTitle>Couriers cannot price postage from here yet</AlertTitle>
        <AlertDescription>
          It still needs {listOf(gaps)}. Until it has them, your shop charges only the delivery
          prices you set yourself, and no postage label can be printed. Add them under Where it is.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

/** The place online orders ship from now, other than this one. */
function useCurrentShipFrom(id: string | null): string | null {
  const locations = useStockLocations();
  const current = locations.data?.items.find(
    (location) => location.shipsOnline === true && location.id !== id
  );
  return current?.name ?? null;
}

export function LocationOnlineOrders({
  draft,
  set,
  existing,
}: {
  draft: Draft;
  set: (key: 'shipsOnline', value: boolean) => void;
  existing: Location | null;
}) {
  const shipsNow = existing?.shipsOnline === true;
  const current = useCurrentShipFrom(existing?.id ?? null);
  const reachable = useReachableModules();
  // A business that does not sell has no online orders to ship. `null` while
  // the module list loads, which reads as "on", as everywhere else.
  const selling = reachable === null || reachable.has('commerce');

  if (!selling) return null;
  if (!shipsNow && !canShipFrom(draft.type)) return null;

  return (
    <FormSection title="Online orders">
      {shipsNow ? (
        <Text>
          Your online orders ship from here. Couriers price postage from this address, and postage
          labels are printed with it. To ship from another place, open that location and choose it
          there.
        </Text>
      ) : (
        <label className="flex items-start gap-3">
          <Checkbox
            color="module"
            checked={draft.shipsOnline && draft.isActive}
            disabled={!draft.isActive}
            aria-label="Ship online orders from here"
            onChange={(event) => {
              set('shipsOnline', event.target.checked);
            }}
          />
          <span className="flex flex-col gap-0.5">
            <Text as="span" className="font-medium">
              Ship online orders from here
            </Text>
            <Text as="span" className="text-sm">
              {!draft.isActive
                ? 'Only a location in use can ship orders.'
                : current
                  ? `Couriers then price postage from this address, and labels are printed with it. ${current} stops being the place they ship from.`
                  : 'Couriers then price postage from this address, and labels are printed with it.'}
            </Text>
          </span>
        </label>
      )}

      {shipsNow && !draft.isActive ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>Your online orders will ship from somewhere else</AlertTitle>
            <AlertDescription>
              A closed location cannot ship. When you save, they move to another location that is in
              use, and the Locations list shows which one.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {(shipsNow && draft.isActive) || (draft.shipsOnline && draft.isActive) ? (
        <CourierGap draft={draft} />
      ) : null}
    </FormSection>
  );
}
