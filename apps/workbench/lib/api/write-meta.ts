'use client';

// What a mutation can tell the rest of the app about itself.
//
// TanStack carries an untyped `meta` bag on every mutation, and two things in
// this app read it: the status bar's "Saved just now" signal and the failed-write
// net. They must agree on what the words mean, so the words live here rather
// than being re-guessed at each reader.
//
// Read structurally, not through a module augmentation of TanStack's `Register`
// — that would retype `meta` for every app sharing @sparx/query in order to
// serve one app's convention.

export interface WriteMeta {
  /**
   * The operator did not ask for this write.
   *
   * Visit tracking, a preference sync, a background recount — work the app does
   * on its own behalf. Two consequences, and they are the same idea seen from
   * both ends: it does not count as "saved" (announcing it would claim the
   * person's work is safe when nothing of theirs was written), and its failure
   * is not announced (they cannot act on it and never knew it was happening).
   *
   * It is still REPORTED. Housekeeping means invisible to them, never to us.
   */
  readonly housekeeping?: boolean;
  /**
   * What was being saved, in the operator's words — "your invoice", "the
   * product's photos". Names the thing in a failure message, so a toast that
   * arrives while they are three panes away still says what it is about.
   */
  readonly writing?: string;
}

export function readWriteMeta(meta: unknown): WriteMeta {
  if (typeof meta !== 'object' || meta === null) return {};
  const record = meta as Record<string, unknown>;
  return {
    ...(typeof record.housekeeping === 'boolean' ? { housekeeping: record.housekeeping } : {}),
    ...(typeof record.writing === 'string' ? { writing: record.writing } : {}),
  };
}
