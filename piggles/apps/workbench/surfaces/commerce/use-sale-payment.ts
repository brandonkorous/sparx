'use client';

// What was handed over at the counter: how much, how, and a note. Moved out of
// sale-detail.tsx (sparx persona issue 230); the rule is unchanged.

import { useEffect, useState } from 'react';

export interface SalePaymentState {
  paid: string;
  setPaid: (value: string) => void;
  paidWith: string;
  setPaidWith: (value: string) => void;
  paidNote: string;
  setPaidNote: (value: string) => void;
}

/** `asking` is what the till offers to take (`whatToOffer`). Until she touches
 *  the amount it tracks that, so adding a second thing to the sale does not
 *  leave the till short; once she types, her number stands. */
export function useSalePayment(asking: string): SalePaymentState {
  const [paid, setPaid] = useState('');
  const [paidWith, setPaidWith] = useState('manual');
  const [paidNote, setPaidNote] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);

  useEffect(() => {
    if (!amountTouched) setPaid(asking);
  }, [asking, amountTouched]);

  return {
    paid,
    setPaid: (value) => {
      setAmountTouched(true);
      setPaid(value);
    },
    paidWith,
    setPaidWith,
    paidNote,
    setPaidNote,
  };
}
