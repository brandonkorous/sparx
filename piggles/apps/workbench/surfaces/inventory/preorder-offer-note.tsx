'use client';

// What "Take pre-orders for it" needs before it means anything (persona issue 928).
//
// A product version's "When you run out of this one" has offered "Take pre-orders
// for it" since the first commerce migration, and on its own it does what "Keep
// selling it and owe it" does: sells past zero and says nothing. The product page
// shows no ship date and there is no limit on how many are owed. What makes it a
// preorder is an OFFER in Preorders, and nothing on the product said so or
// led there. The Preorders screen could only be found by somebody who already knew
// it existed.
//
// So, under the choice: whether this version has an offer running, and the button
// that opens Preorders on it, either way.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { useWorkbench } from '@/lib/workbench/context';
import { useReachableModules } from '../../lib/surfaces/use-visible-nav';
import { usePreorderWindows } from './demand-data';
import { formatDay } from './purchase-orders-data';
import { productModuleLabel } from '../../lib/product';

export function PreorderOfferNote({
  variantId,
  productId,
}: {
  variantId: string;
  productId: string;
}) {
  const { controller } = useWorkbench();
  const reachable = useReachableModules();
  // `null` while the module list loads, which reads as "on", as everywhere else.
  const stockOn = reachable === null || reachable.has('inventory');
  // "Stock" in Piggles, "Inventory" in sparx: the name on the app rail.
  const stockApp = productModuleLabel('inventory') ?? 'Inventory';
  const windows = usePreorderWindows({ variantId }, { enabled: stockOn });

  if (!stockOn) {
    return (
      <Alert color="warning" variant="soft">
        <AlertContent>
          <AlertTitle>Not a preorder yet</AlertTitle>
          <AlertDescription>
            On its own this works like “Keep selling it and owe it”: your product page gives no ship
            date, and there is no limit on how many you owe. A preorder with a date and a limit is
            set up in {stockApp}, which is switched off.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  if (!windows.isSuccess) return null;

  const running = windows.data.items.find(
    (w) => w.effectiveStatus === 'open' || w.effectiveStatus === 'scheduled'
  );
  const openIt = () => {
    controller.open('inventory.preorders', { variant: variantId, product: productId });
  };

  if (running) {
    const ships = running.availableAt
      ? `Ships ${formatDay(running.availableAt)}`
      : 'Ship date to be confirmed';
    const left = running.remaining !== null ? ` · ${String(running.remaining)} left` : '';
    return (
      <Alert color="info" variant="soft">
        <AlertContent>
          <AlertTitle>
            {running.effectiveStatus === 'scheduled' && running.startsAt
              ? `Preorders open ${formatDay(running.startsAt)}`
              : 'Taking preorders'}
          </AlertTitle>
          <AlertDescription>
            {ships}
            {left}.
          </AlertDescription>
        </AlertContent>
        <Button size="sm" color="module-inventory" onClick={openIt}>
          Open the preorder
        </Button>
      </Alert>
    );
  }

  return (
    <Alert color="warning" variant="soft">
      <AlertContent>
        <AlertTitle>Not a preorder yet</AlertTitle>
        <AlertDescription>
          Until you set one up, this works like “Keep selling it and owe it”: your product page
          gives no ship date, and there is no limit on how many you owe.
        </AlertDescription>
      </AlertContent>
      <Button size="sm" color="module-inventory" onClick={openIt}>
        Set up the preorder
      </Button>
    </Alert>
  );
}
