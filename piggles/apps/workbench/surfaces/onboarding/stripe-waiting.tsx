'use client';

// Shown while the Stripe window is open. Closing that window without finishing left
// Connect Stripe spinning for good, with no way back short of a reload (sparx persona
// issue 018). Watching `popup.closed` is not reliable once Stripe's page isolates
// itself from its opener, so the owner is handed the way out instead.

import { Button, Text } from '@wizeworks/silicaui-react';

export function StripeWaiting({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Text className="text-sm">Finish connecting in the Stripe window. Closed it by mistake?</Text>
      <Button variant="link" color="module" size="sm" onClick={onCancel}>
        Start again
      </Button>
    </div>
  );
}
