'use client';

// Retiring a supplier is rare and hard to reverse: a quiet row under a divider,
// never a card competing with the details above. A retired one says so instead.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import { faBoxArchive } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

export function SupplierRetireRow({
  isActive,
  archiving,
  onArchive,
}: {
  isActive: boolean;
  archiving: boolean;
  onArchive: () => Promise<void>;
}) {
  if (!isActive) {
    return (
      <Alert color="neutral" variant="soft">
        <AlertContent>
          <AlertTitle>This supplier is retired</AlertTitle>
          <AlertDescription>
            You can no longer raise new orders to them. Their details above stay editable, and all
            past orders are kept.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="flex min-w-0 flex-col">
        <Text className="font-medium">Retire this supplier</Text>
        <Text className="text-sm">Stop ordering from them without losing any history.</Text>
      </div>
      <Button
        size="sm"
        variant="outline"
        color="danger"
        loading={archiving}
        onClick={() => {
          void onArchive();
        }}
      >
        <Icon glyph={faBoxArchive} className="size-4" aria-hidden />
        Retire
      </Button>
    </div>
  );
}
