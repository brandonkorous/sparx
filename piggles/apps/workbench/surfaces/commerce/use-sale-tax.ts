'use client';

// THE SALES TAX on a sale at the counter, asked of checkout's tax engine whenever
// the sale changes (sparx persona issue 230). An answer is used only for the exact
// sale it was asked about, and nothing is written down until it is known.

import { useEffect, useRef, useState } from 'react';

import type { SaleLine } from './sale-data';
import { taxKey, useSaleTax, type SaleTaxQuote } from './sale-tax';

export interface SaleTaxState {
  /** The tax for this exact sale, or null while it is being worked out. */
  quote: SaleTaxQuote | null;
  /** Known, or there is nothing on the sale to tax. */
  ready: boolean;
  /** The server could not be asked about this exact sale. */
  failed: boolean;
  /** Why it could not, so the words name the real cause (persona issue 260). */
  error: unknown;
  retry: () => void;
}

export function useSaleTaxQuote(customerId: string | null, lines: SaleLine[]): SaleTaxState {
  const { mutate: askTax } = useSaleTax();
  const [answer, setAnswer] = useState<{ key: string; quote: SaleTaxQuote } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const asked = useRef('');
  const key = taxKey(customerId, lines);

  useEffect(() => {
    if (lines.length === 0 || asked.current === key) return;
    // A short wait, so typing a price asks once rather than once a keystroke.
    const timer = setTimeout(() => {
      asked.current = key;
      askTax(
        { customerId, lines },
        {
          onSuccess: (quote) => {
            setAnswer({ key, quote });
            setFailedFor(null);
          },
          onError: (cause) => {
            setError(cause);
            setFailedFor(key);
          },
        }
      );
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [key, customerId, lines, askTax, attempt]);

  const quote = answer?.key === key ? answer.quote : null;
  return {
    quote,
    ready: lines.length === 0 || quote !== null,
    failed: failedFor === key,
    error: failedFor === key ? error : null,
    retry: () => {
      asked.current = '';
      setFailedFor(null);
      setAttempt((n) => n + 1);
    },
  };
}
