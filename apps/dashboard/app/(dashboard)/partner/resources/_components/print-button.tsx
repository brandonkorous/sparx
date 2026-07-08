'use client';

import { Button } from 'silicaui-react';
import { Printer } from 'lucide-react';

// A print / save-as-PDF trigger for the presentable resources (pitch, one-pager,
// proposal). Client-only — `window.print()` hands off to the browser's own
// print-to-PDF, so there's no server rendering pipeline to maintain.
export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => window.print()}
      iconStart={<Printer className="h-4 w-4" />}
    >
      {label}
    </Button>
  );
}
