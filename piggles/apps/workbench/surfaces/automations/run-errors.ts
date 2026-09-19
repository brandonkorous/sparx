// WHAT A FAILED RUN SAYS TO THE PERSON WHO OWNS THE SHOP.
//
// Devi opened a rule that had failed eight times and read this, twice on the
// same screen — once in the banner at the top, once inside the step card:
//
//     Failed
//     no executor registered for action "email.send_campaign"
//
// She runs a clothing boutique. She has never met an executor. The sentence
// names a thing she cannot see, in a shape she cannot act on, and it reads like
// she built the rule wrong. She did not: an unregistered action is a fault in
// OUR boot, which is exactly what issue 540 measured and repaired. 71 of the
// platform's 73 failed runs said it.
//
// 540 fixed the cause and left the sentence, so the next failure of any kind
// prints the next engine string verbatim.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// The engine writes two kinds of error, and they want different handling:
//
//   1. Errors the engine raises ABOUT itself — `UnregisteredActionError` is the
//      only one that reaches a run record. Nothing she changes can fix it, and
//      saying so is more useful than any remedy we could invent.
//      [[feedback_one_outcome_two_causes]]
//
//   2. Errors an action raises about ITS OWN work. Those are already written in
//      English ("nobody to assign to, the rotation is empty") but carry a
//      machine prefix — `crm.create_task: ` — because the same string goes to a
//      log. The prefix is the action's id; the console already holds its real
//      name, so it can show "Create a task" and drop the id.
//
// A leaf module, importing nothing, so the sentences can be tested.

export interface RunError {
  /** What did not happen, naming the step the way the console names it. */
  headline: string;
  /** Why, in the plainest words available. */
  detail: string;
  /**
   * Is there anything she could change that would fix it?
   *
   * False means the fault is ours. The screen must say so rather than leave her
   * re-reading a rule that was never the problem.
   */
  yours: boolean;
  /**
   * The engine's exact words, for a support conversation. Equal to `detail`
   * when there was nothing to translate, so a caller can compare the two and
   * avoid printing the same sentence twice — which is what the run screen did.
   */
  reported: string;
}

/** `no executor registered for action "email.send_campaign"` */
const UNREGISTERED = /^no executor registered for action "(.+)"$/;

/**
 * `crm.create_task: ` — an action id, which always carries a dot, followed by a
 * colon and a space. Anchored and dot-bearing so an ordinary sentence with a
 * colon in it ("Stopped: nothing matched") is never mistaken for a prefix.
 */
const ACTION_PREFIX = /^([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+):\s+(.*)$/s;

function quoted(name: string): string {
  return `“${name}”`;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Turn one engine error into something a shop owner can read and act on.
 *
 * `actionName` is the console's own name for the step that failed ("Send a
 * marketing email"), or null when the caller cannot say which step it was.
 */
export function explainRunError(raw: string, actionName: string | null): RunError {
  const reported = raw.trim();
  const named = actionName !== null && actionName.trim() !== '' ? quoted(actionName.trim()) : null;

  if (UNREGISTERED.test(reported)) {
    return {
      headline:
        named === null
          ? 'We could not carry out one of the steps in this rule.'
          : `We could not carry out ${named}.`,
      detail:
        'This is a fault on our side, not something you set up wrong. Nothing you ' +
        'change in this rule will fix it, and no step after this one ran. If you ' +
        'keep seeing it, send us the wording below.',
      yours: false,
      reported,
    };
  }

  const prefixed = ACTION_PREFIX.exec(reported);
  if (prefixed?.[2] !== undefined && prefixed[2].trim() !== '') {
    return {
      headline: named === null ? 'A step could not finish.' : `${named} could not finish.`,
      detail: sentence(prefixed[2]),
      yours: true,
      reported,
    };
  }

  return {
    headline: named === null ? 'This run could not finish.' : `${named} could not finish.`,
    detail: sentence(reported),
    yours: true,
    reported,
  };
}

/**
 * True when the exact engine wording adds something the translated sentence
 * does not. The run screen printed the same string in the banner AND in the
 * step card; showing it once, labeled, is the whole of the improvement for a
 * message that was already in English.
 */
export function showsReported(error: RunError): boolean {
  return error.reported !== error.detail;
}
