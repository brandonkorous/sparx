// Whether anybody has answered a customer's question — the second axis of the
// questions table.
//
// Moderation status ("Waiting", "Shown", "Hidden") says where a question IS.
// It says nothing about whether it has a reply, and those come apart: showing a
// question and answering it are two deliberate acts (see qa-queue.tsx), so
// "Shown" is reachable with silence underneath it. Once shown, the question
// leaves the pending backlog the card queue reads and never comes back, so
// nothing in the console would ever raise it again.
//
// The per-PRODUCT pane already knew this. It counts `answers.length === 0` and
// writes "3 questions have no answer yet" above the list, because the endpoint
// it reads includes the answers. The catalog-wide table read a different
// endpoint that selected none, so the one screen built for triage across every
// product was the one screen that could not see it (issue 734).
//
// Pure and React-free, like moderation-decisions.ts beside it: `tone` is a
// silica color the surface applies, so this can be unit-tested with no renderer.

/** How a row should report its answers. */
export interface AnswerState {
  /** What the cell says. */
  label: string;
  /**
   * The badge color, or null for plain text.
   *
   * ONLY the unanswered one is colored. A badge on every row would make the
   * column a stripe of decoration; the whole job of this column is to pick out
   * the rows still waiting on her, so the color goes on those alone and the
   * settled ones read as quiet text. [[feedback_color_follows_functionality]]
   *
   * `info`, NOT `warning`, because the Status cell beside it already spends
   * amber on "Waiting for you". Two amber pills in one row saying two different
   * things is the failure RULE #4 names, one hue up from grey: whatever each one
   * means, the eye reads them as the same fact twice. Amber is the decision she
   * owes; this is a fact about the question.
   */
  tone: 'info' | null;
}

/** What a row with this many answers should say. */
export function answerState(count: number): AnswerState {
  if (count <= 0) return { label: 'No answer yet', tone: 'info' };
  if (count === 1) return { label: 'Answered', tone: null };
  return { label: `${String(count)} answers`, tone: null };
}

/**
 * The extra line on the toast when showing a question puts it on the page with
 * nothing under it.
 *
 * `undefined` when there is nothing to say, so a caller can spread it straight
 * into the toast. This is the moment she creates that state, and it is the only
 * moment the console can tell her about it without nagging.
 */
export function shownWithoutAnswerNote(unanswered: number): string | undefined {
  if (unanswered <= 0) return undefined;
  if (unanswered === 1) {
    return 'It has no answer yet, so it goes on the page on its own until you answer it.';
  }
  return `${String(unanswered)} of them have no answer yet, so they go on the page on their own until you answer them.`;
}

/**
 * The value the questions table uses for its "No answer yet" chip.
 *
 * It shares the one chip group with the three real statuses, because from her
 * side they are all just "which ones am I looking at" — but it is NOT a stored
 * status, so it must never be sent to the server as one. The list hook sends
 * `unanswered: true` instead and leaves `status` off.
 */
export const UNANSWERED_FILTER = 'unanswered';

/**
 * What the answer box should say, given where the question already SITS.
 *
 * It said one thing: "once you show it, everyone reading the product's page
 * sees your answer under their question." That is right for a question still
 * waiting, and wrong for the two states either side of it. On a question
 * already SHOWN it names a step she has taken and implies her answer stays
 * private until she takes it again; the answer in fact goes live the moment she
 * posts. On a HIDDEN one it promises a page nothing is going on.
 *
 * Reachable before, and now the ordinary route: the "No answer yet" view exists
 * precisely to hand her shown questions with nobody's reply under them (issue
 * 734), so the sentence that was wrong for them is the one she will read most.
 * [[feedback_a_promise_in_copy_is_a_contract]]
 */
export function answerBoxPrompt(status: string): string {
  if (status === 'published') {
    return (
      "Answer this question. It is already on the product's page, so your answer appears " +
      'under it as soon as you post.'
    );
  }
  if (status === 'rejected') {
    return (
      "Answer this question. It is hidden, so nothing appears on the product's page until " +
      'you show it again.'
    );
  }
  return (
    "Answer this question: once you show it, everyone reading the product's page sees your " +
    'answer under their question.'
  );
}
