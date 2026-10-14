'use client';

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import type { PlaceInView } from './use-bins-list';

export function BinsListAlerts({
  noDefault,
  emptyNote,
}: {
  noDefault: PlaceInView[];
  emptyNote: string | null;
}) {
  return (
    <>
      {noDefault.length > 0 ? (
        <Alert color="warning" className="shrink-0">
          <AlertContent>
            <AlertTitle>
              {noDefault.length === 1
                ? `Nothing can be booked in at ${noDefault[0]?.name ?? 'this location'}`
                : `${String(noDefault.length)} of your locations cannot have anything booked in`}
            </AlertTitle>
            <AlertDescription>
              {noDefault.length === 1
                ? 'It uses shelves, and none of them is the one things go on when nobody says which. Until one is, every delivery, transfer and return there will be refused. Open a shelf and turn on "Put things here when nobody says which shelf".'
                : 'They use shelves, and none of their shelves is the one things go on when nobody says which. Until one is, every delivery, transfer and return there will be refused. Open a shelf at each and turn on "Put things here when nobody says which shelf".'}
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {/* A zero on every row has two opposite meanings (Juniper Row: five empty shelves,
          491 units at a place with none). Shown only when every shelf on screen is
          empty AND the locations have loaded. */}
      {emptyNote ? (
        <Alert color="info" className="shrink-0">
          <AlertContent>
            <AlertDescription>{emptyNote}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
    </>
  );
}
