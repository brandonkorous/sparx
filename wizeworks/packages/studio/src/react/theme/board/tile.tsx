'use client';

// One panel on the brand board.
//
// A real `<Card>`, so the tile's own corner, border and lift are the theme's —
// the frame around a specimen is a specimen too.

import type { ReactNode } from 'react';
import { Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';

export function BoardTile({
  title,
  hint,
  wide,
  children,
}: {
  /** Omit it where the specimen speaks for itself. Labelling the page vignette
   *  "Your page" put a caption on the one panel that is meant to read as a site
   *  rather than as an exhibit. */
  title?: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={wide ? 'col-span-full' : undefined}>
      <CardBody className="flex flex-col gap-4">
        {title ? (
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {hint ? <p className="text-base-content mt-0.5 text-sm">{hint}</p> : null}
          </div>
        ) : null}
        {children}
      </CardBody>
    </Card>
  );
}

/** A labelled strip inside a tile — several specimens of one idea. */
export function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-base-content mb-2 text-sm">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
