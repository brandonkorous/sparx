'use client';

// How far along something is.
//
// Progress is where a theme's meaning colors get used at LENGTH rather than in a
// chip, so a hue that was fine on a badge can turn out to be exhausting here.

import { Loading, Meter, Progress, RadialProgress, Step, Steps } from '@wizeworks/silicaui-react';
import { BoardTile, Specimen } from './tile';

export function ProgressTile() {
  return (
    <BoardTile title="How far along" hint="Checkout, uploads, stock levels and anything counting.">
      <Steps>
        <Step color="primary" data-content="✓">
          Basket
        </Step>
        <Step color="primary" data-content="✓">
          Address
        </Step>
        <Step color="primary">Payment</Step>
        <Step>Done</Step>
      </Steps>

      <div className="flex flex-col gap-2">
        <Progress color="primary" value={72} />
        <Progress color="success" value={48} />
        <Progress color="warning" value={26} />
        <Progress color="error" value={12} />
        <Progress color="primary" />
      </div>

      <Meter color="success" value={64} label="Stock on hand" showValue />

      <Specimen label="Round, and waiting">
        <RadialProgress value={72} diameter="4rem" />
        <Loading size="md" />
        <Loading size="lg" />
      </Specimen>
    </BoardTile>
  );
}
