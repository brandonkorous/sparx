'use client';

// Paper, edges and corners — the properties nobody names and everybody feels.
//
// The three corner samples carry `rounded-box`, `rounded-field` and
// `rounded-selector` at the size each tier is really drawn at, so this tile is the
// answer to "what did that slider just do".
//
// The surfaces are drawn NESTED because that is what they are: base-100 is the
// highest layer — the page and its cards — with 200 and 300 behind it in order.

import { Button, Card, CardBody, Checkbox, Input } from '@wizeworks/silicaui-react';
import { BoardTile, Specimen } from './tile';

export function SurfacesTile() {
  return (
    <BoardTile
      title="Layers, edges and corners"
      hint="How your site is stacked, and how sharp its corners are."
    >
      {/* Nested, not side by side — the three surfaces are DEPTHS, and a row of
          swatches says nothing about which one sits behind which. */}
      <div className="bg-base-300 rounded-box p-3">
        <p className="text-base-content mb-2 text-sm">Background · base-300</p>
        <div className="bg-base-200 rounded-box p-3">
          <p className="text-base-content mb-2 text-sm">Second layer · base-200</p>
          <div className="bg-base-100 rounded-box border-base-300 border p-3">
            <p className="text-base-content text-sm">Main surface · base-100</p>
            <p className="text-base-content text-base">The page and the cards on it.</p>
          </div>
        </div>
      </div>

      <Specimen label="Corners, at the size each one is really drawn">
        <Corner shape="rounded-box" label="Cards" />
        <Corner shape="rounded-field" label="Buttons" />
        <Corner shape="rounded-selector" label="Checkboxes" />
      </Specimen>

      <Specimen label="The same three, as the real thing">
        <Card className="w-32">
          <CardBody className="py-3">
            <p className="text-sm">A card</p>
          </CardBody>
        </Card>
        <Input className="w-32" placeholder="A box" readOnly />
        <Checkbox color="primary" defaultChecked aria-label="A checkbox" />
        <Button color="primary" size="sm">
          A button
        </Button>
      </Specimen>
    </BoardTile>
  );
}

function Corner({ shape, label }: { shape: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`${shape} bg-primary block size-12`} aria-hidden />
      <span className="text-base-content text-sm">{label}</span>
    </div>
  );
}
