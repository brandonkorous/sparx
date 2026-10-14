// The local draft of one order, the baseline it is compared against, and the seed
// that fills it from the server.

import { useEffect, useMemo, useState } from 'react';
import type {
  PurchaseOrderDetail,
  PurchaseOrderHeaderDraft,
  PurchaseOrderLine,
  PurchaseOrderLineDraft,
} from './purchase-orders-data';
import {
  draftFromDetail,
  emptyDraft,
  withHeader,
  withLine,
  withoutLine,
  type PurchaseOrderDraft,
} from './purchase-order-draft';

export function usePurchaseOrderDraft(
  isNew: boolean,
  presetSupplier: string,
  detail: PurchaseOrderDetail | null
) {
  const [draft, setDraft] = useState<PurchaseOrderDraft>(() => emptyDraft(presetSupplier));
  const [original, setOriginal] = useState<PurchaseOrderLine[]>([]);
  const [baseline, setBaseline] = useState<string>(() =>
    JSON.stringify(emptyDraft(presetSupplier))
  );
  const [loaded, setLoaded] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);

  // Re-seeds whenever the server changes a CLEAN form: placing fills in the
  // expected date, and a one-way latch hid it (issue 493). Dirty edits are kept.
  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (!detail) return;
    const next = draftFromDetail(detail);
    const serialized = JSON.stringify(next);
    if (loaded && (dirty || serialized === baseline)) return;
    setDraft(next);
    setOriginal(detail.lines);
    setBaseline(serialized);
    setLoaded(true);
  }, [isNew, detail, loaded, dirty, baseline]);

  /** Rebased on every save, because a `replace` swap never re-runs the seed (issue 483). */
  const rebase = (saved: PurchaseOrderDetail) => {
    const next = draftFromDetail(saved);
    setDraft(next);
    setOriginal(saved.lines);
    setBaseline(JSON.stringify(next));
  };

  return { draft, setDraft, original, loaded, dirty, rebase };
}

type SetDraft = (update: (current: PurchaseOrderDraft) => PurchaseOrderDraft) => void;

/** The three edits the pane makes to its draft. */
export function draftEditors(setDraft: SetDraft) {
  const setHeader = <K extends keyof PurchaseOrderHeaderDraft>(
    key: K,
    value: PurchaseOrderHeaderDraft[K]
  ) => {
    setDraft((current) => withHeader(current, key, value));
  };
  const upsertLine = (line: PurchaseOrderLineDraft) => {
    setDraft((current) => withLine(current, line));
  };
  const removeLine = (line: PurchaseOrderLineDraft) => {
    setDraft((current) => withoutLine(current, line));
  };
  return { setHeader, upsertLine, removeLine };
}
