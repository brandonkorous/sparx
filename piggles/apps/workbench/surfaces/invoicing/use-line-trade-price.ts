'use client';

// A picked part's price for a business on account, on the line being edited.
//
// Picking the Bosch injector for Wasatch Front, who are on the Fleet group at
// 12% off, seeded the line at the $600.00 list price (sparx persona issue 077).
// This asks `/v1/b2b/resolve-price` for what they pay, puts it in the price box,
// and keeps the sentence saying why ("Fleet price: 12% off $600.00").
//
// The sentence is only ever beside the price it explains. Typing over that price
// drops it, because a typed $500.00 is not the Fleet price, and a line that says
// it is would be wrong in front of the customer. A changed quantity asks again,
// because a bulk price can start at ten. Reopening a saved line does NOT ask
// again: the quoted price stays what was quoted until somebody changes it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTradePrice, tradePriceMissing, type TradeAccount } from './trade-price';

/** The price the lookup put on the line, and at what quantity. */
interface Priced {
  variantId: string;
  unitPrice: number;
  quantity: number;
}

export function useLineTradePrice({
  tradeAccount,
  quantity,
  unitPrice,
  setUnitPrice,
}: {
  tradeAccount: TradeAccount | null;
  /** The quantity box, as typed. */
  quantity: string;
  /** Dollars, as the price box holds it now. */
  unitPrice: number;
  setUnitPrice: (dollars: number) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [priced, setPriced] = useState<Priced | null>(null);
  // Every lookup takes a number; an answer to an older question is dropped, so
  // a slow reply for the part picked first cannot overwrite the part picked
  // second.
  const asked = useRef(0);

  const lookUp = useCallback(
    (variantId: string, qty: number) => {
      if (!tradeAccount) return;
      const mine = (asked.current += 1);
      setLooking(true);
      setWarning(null);
      fetchTradePrice({ variantId, accountId: tradeAccount.id, quantity: qty })
        .then((price) => {
          if (mine !== asked.current) return;
          const dollars = price.effectivePriceCents / 100;
          setUnitPrice(dollars);
          setPriced({ variantId, unitPrice: dollars, quantity: qty });
          setNote(price.words);
        })
        .catch(() => {
          if (mine !== asked.current) return;
          setPriced(null);
          setNote(null);
          setWarning(tradePriceMissing(tradeAccount));
        })
        .finally(() => {
          if (mine === asked.current) setLooking(false);
        });
    },
    [tradeAccount, setUnitPrice]
  );

  /** Forget everything in flight; nothing on the line came from a lookup. */
  const clear = useCallback(() => {
    asked.current += 1;
    setNote(null);
    setWarning(null);
    setLooking(false);
    setPriced(null);
  }, []);

  /** A line opened in the editor: its stored note stands for its stored price. */
  const reset = useCallback(
    (seed: {
      variantId: string | null;
      unitPrice: number;
      quantity: number;
      priceNote: string | null;
    }) => {
      clear();
      setNote(seed.priceNote);
      if (seed.priceNote && seed.variantId) {
        setPriced({
          variantId: seed.variantId,
          unitPrice: seed.unitPrice,
          quantity: seed.quantity,
        });
      }
    },
    [clear]
  );

  /** The owner typed a price. If it is not the looked-up one, nor is the note. */
  const typed = useCallback(
    (dollars: number) => {
      setWarning(null);
      if (priced && dollars !== priced.unitPrice) clear();
    },
    [priced, clear]
  );

  // A new quantity asks again, but only while the price is still the one the
  // lookup set: a typed price is the owner's, at any quantity.
  const qty = Number(quantity);
  useEffect(() => {
    if (!priced || !tradeAccount || !(qty > 0) || qty === priced.quantity) return;
    if (unitPrice !== priced.unitPrice) return;
    const timer = setTimeout(() => {
      lookUp(priced.variantId, qty);
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [qty, priced, tradeAccount, unitPrice, lookUp]);

  return { note, warning, looking, lookUp, clear, reset, typed };
}
