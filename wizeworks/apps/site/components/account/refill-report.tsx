'use client';

// What Order again or a saved cart's Add to cart did (sparx persona issue 086):
// what went into the cart, what did not and why, and a way to the cart. The
// words are `refillReport` in lib/buying-again-words.

import Link from 'next/link';

import { Alert, Button } from '@wizeworks/silicaui-react';

import { refillReport } from '@/lib/buying-again-words';
import type { RefillResult } from '@/lib/customer-client';

export function RefillReport({
  result,
  onDismiss,
}: {
  result: RefillResult;
  onDismiss: () => void;
}) {
  const report = refillReport(result);
  return (
    <Alert color={report.tone} role="status">
      <div className="flex min-w-0 flex-col gap-2">
        <strong>{report.headline}</strong>
        {report.added.length > 0 && (
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
            {report.added.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {report.skipped.length > 0 && (
          <>
            <span>Not added:</span>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
              {report.skipped.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {result.added.length > 0 && (
            <Button render={<Link href="/cart" />} color="primary" size="sm">
              Go to your cart
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Close
          </Button>
        </div>
      </div>
    </Alert>
  );
}
