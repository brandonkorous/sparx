'use client';

// The line editor's cost box: the text it holds, and what a picked product put
// there, so the words under it can say whether the product had a cost (086).

import { useState } from 'react';
import { costHelp } from './cost-help';

export function useLineCost() {
  const [cost, setCost] = useState('');
  const [productCost, setProductCost] = useState<string | null>(null);

  /** A picked product's cost fills the box; none empties it rather than keep a
   *  cost typed for another part (sparx persona issue 086). */
  function fromProduct(costCents: number | null) {
    const brought = costCents == null ? '' : String(costCents / 100);
    setCost(brought);
    setProductCost(brought);
  }

  /** What the editor hands its fields: the box as money that can be blank. */
  function fields(markupMode: boolean, productId: string | null) {
    return {
      costValue: cost.trim() === '' ? null : Number(cost),
      setCostValue: (value: number | null) => {
        setCost(value === null ? '' : String(value));
      },
      costHelp: costHelp({ markupMode, productId, cost, productCost }),
    };
  }

  return { cost, setCost, fromProduct, forget: () => setProductCost(null), fields };
}
