'use client';

// What a mutation can tell the rest of the app about itself.
//
// TanStack carries an untyped `meta` bag on every mutation, and two things in
// this app read it: the status bar's "Saved just now" signal and the failed-write
// net. They must agree on what the words mean, so the words live here rather
// than being re-guessed at each reader.
//
// Read structurally, not through a module augmentation of TanStack's `Register`
// — that would retype `meta` for every app sharing @wizeworks/query in order to
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
  /**
   * This mutation RUNS something rather than saving something of theirs.
   *
   * Re-running the stock check, recomputing a forecast, rebuilding an index,
   * previewing an import. She asked for it, so its failure is hers to hear and
   * `housekeeping` is the wrong flag - but nothing of HERS was written, so two
   * things have to change:
   *
   *   • the status bar's "Saved just now" clock must not move. That clock is
   *     the answer to "did my work make it?", and a check she ran after a save
   *     that silently failed would answer it yes.
   *   • the failure is not "couldn't save". Set this to the verb phrase in her
   *     words - "check your stock" - and the toast reads "Couldn't check your
   *     stock", which is a sentence rather than a category.
   */
  readonly running?: string;
}

export function readWriteMeta(meta: unknown): WriteMeta {
  if (typeof meta !== 'object' || meta === null) return {};
  const record = meta as Record<string, unknown>;
  return {
    ...(typeof record.housekeeping === 'boolean' ? { housekeeping: record.housekeeping } : {}),
    ...(typeof record.writing === 'string' ? { writing: record.writing } : {}),
    ...(typeof record.running === 'string' ? { running: record.running } : {}),
  };
}

/**
 * What a failed write is called, in her words.
 *
 * Three sentences, not one with a hole in it. `running` names an ACTION, so its
 * failure is "Couldn't check your stock"; `writing` names a THING, so its
 * failure is "Couldn't save your invoice". Neither was ever set, which is why
 * every failure in this console said the third one.
 */
export function writeFailureTitle(meta: WriteMeta): string {
  if (meta.running !== undefined) return `Couldn't ${meta.running}`;
  if (meta.writing !== undefined) return `Couldn't save ${meta.writing}`;
  return "That didn't save";
}
