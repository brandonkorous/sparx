'use client';

// What committing would do, and the button that does it — together, so the
// control that takes SKUs off sale is attached to the sentences saying which.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import type { Consequence } from './product-options-plan';
import { consequenceLines } from './product-options-words';

export function ConsequenceCard({
  consequence,
  blocked,
  busy,
  onCommit,
  onDiscard,
}: {
  consequence: Consequence;
  blocked: boolean;
  busy: boolean;
  onCommit: () => void;
  onDiscard: () => void;
}) {
  const lines = consequenceLines(consequence);
  const severe = consequence.retire.length > 0 || consequence.loose.length > 0;
  return (
    <Alert color={severe ? 'warning' : 'info'} variant="soft">
      <AlertContent>
        <AlertTitle>What this changes</AlertTitle>
        <AlertDescription>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {blocked ? (
            <Text className="mt-2">Finish the choice marked below before going ahead.</Text>
          ) : null}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Leave it as it is
        </Button>
        <Button
          size="sm"
          color={severe ? 'warning' : 'module'}
          disabled={blocked}
          loading={busy}
          onClick={onCommit}
        >
          Change how it is sold
        </Button>
      </AlertActions>
    </Alert>
  );
}
