// What this screen says about a sequence that cannot reach anybody.
//
// A sequence sends nothing by itself. Something has to ENROLL a person, and there
// are exactly two somethings: an automation carrying the action "Add to an email
// sequence", and a hand enrollment from the Enrolled people screen. That fact was
// written down in three places in the code and on exactly one screen — the
// Enrolled people EMPTY STATE, which says it perfectly:
//
//   "People are added automatically by any automation that starts this sequence,
//    or you can add someone by hand."
//
// Its neighbour, the editor with the Turn on button in its header, said nothing
// at all, and after turning it on reported "People enrolled from now on will
// start receiving the emails." Measured 2026-09-18: 2,411 automations on this
// platform and NOT ONE of them enrolling; 15 sequences, every one a draft, zero
// enrollments ever recorded. So that sentence was true of nobody.
// [[feedback_a_fix_leaves_its_neighbour_behind]] [[feedback_never_present_absence_as_measurement]]
//
// Pure functions, no React, so each sentence is a test rather than a screenshot.

/** How many automations carry "Add to an email sequence" pointed at this one. */
export interface Enrollers {
  total: number;
  /** Of those, the ones switched on — the only ones that can add anybody today. */
  live: number;
}

export type SequenceLifecycle = 'draft' | 'active' | 'archived';

/** Pluralise a count of automations without saying "automation(s)". */
function rules(n: number): string {
  return n === 1 ? '1 automation' : `${String(n)} automations`;
}

/**
 * The count AND a verb that agrees with it.
 *
 * `rules()` on its own produced "1 automation add people to it" in five
 * sentences on this screen, and ONE is the commonest number there is — it is
 * what the first rule somebody builds looks like. A helper that pluralises the
 * noun and leaves the verb behind is the same defect as no helper.
 *
 * Caught on screen, not by the tests: the assertion read `toContain('1
 * automation ')` and stopped on the space before the broken word.
 * [[feedback_a_test_that_cannot_go_red]]
 */
function rulesDo(n: number, singular: string, plural: string): string {
  return `${rules(n)} ${n === 1 ? singular : plural}`;
}

/**
 * True when no automation can put a person in today.
 *
 * Deliberately reads `live`, not `total`: an automation that is switched off adds
 * nobody, so a sequence wired to three paused rules is in exactly the same
 * position as one wired to none. What differs is the REMEDY, which is why the
 * sentences below still tell the two apart.
 */
export function nothingAddsAnyone(enrollers: Enrollers): boolean {
  return enrollers.live === 0;
}

/** The two ways in, named the way the Enrolled people screen already names them. */
export const WAYS_IN =
  'An automation using the action “Add to an email sequence” adds people for you, ' +
  'or you can add someone by hand from Enrolled people.';

/**
 * Whether the notice should carry a button that BUILDS the automation it names.
 *
 * Naming the remedy and not offering it is the shape this whole file exists to
 * fix. `WAYS_IN` tells her the answer is an automation carrying one specific
 * action pointed at one specific sequence — every part of which this screen
 * already knows. Making her leave, find Automations, start a new rule, find that
 * action in a list of dozens and pick this sequence out of a menu is asking her
 * to reassemble a sentence the screen just said.
 *
 * Only when nothing is feeding it. A sequence with a live enroller does not need
 * a second one, and a stopped sequence does not need one at all.
 */
export function offersToBuildEnroller(status: SequenceLifecycle, enrollers: Enrollers): boolean {
  if (status === 'archived') return false;
  return nothingAddsAnyone(enrollers);
}

/** The button on the notice, and the name the rule it builds starts life with. */
export function buildEnrollerWords(sequenceName: string): { action: string; ruleName: string } {
  const named = sequenceName.trim();
  return {
    action: 'Build the automation that adds people',
    // The rule arrives already named after the job it does, because an
    // automations list full of "Untitled automation" is its own defect. An
    // unnamed sequence cannot lend its name, so the rule waits for one rather
    // than shipping the word "Untitled" into a second screen.
    ruleName: named === '' ? '' : `Add people to ${named}`,
  };
}

export interface SequenceNotice {
  color: 'info' | 'warning';
  title: string;
  body: string;
}

/**
 * The one statement at the top of the editor: what this sequence is doing, and
 * whether anything can reach it.
 *
 * Always present. A screen that only speaks up when it is on leaves the draft —
 * the state every sequence on this platform is actually in — with nothing said.
 */
export function sequenceNotice(status: SequenceLifecycle, enrollers: Enrollers): SequenceNotice {
  if (status === 'archived') {
    return {
      color: 'info',
      title: 'This sequence is stopped',
      body: 'It sends nothing and nobody new is added. Emails that already went out are not affected.',
    };
  }

  if (status === 'draft') {
    if (enrollers.total === 0) {
      return {
        color: 'info',
        title: 'This is a draft, so nothing is sending',
        body: `Nothing adds anyone to this yet. ${WAYS_IN}`,
      };
    }
    return {
      color: 'info',
      title: 'This is a draft, so nothing is sending',
      body:
        enrollers.live === 0
          ? `${rulesDo(enrollers.total, 'points', 'point')} at this sequence, and none of them is switched on either. Turn both on and people start arriving.`
          : `${rulesDo(enrollers.live, 'already adds', 'already add')} people to it. They start arriving as soon as you turn this on.`,
    };
  }

  if (enrollers.total === 0) {
    return {
      color: 'warning',
      title: 'This sequence is on, and nothing adds anyone',
      body: `A sequence only emails the people something puts into it, and nothing does yet, so these emails will not reach anybody. ${WAYS_IN}`,
    };
  }
  if (enrollers.live === 0) {
    return {
      color: 'warning',
      title: 'This sequence is on, but the automation that adds people is off',
      body: `${rulesDo(enrollers.total, 'points', 'point')} at this sequence and none of them is switched on, so nobody is being added. You can still add someone by hand from Enrolled people.`,
    };
  }
  return {
    color: 'info',
    title: 'This sequence is on',
    body: `${rulesDo(enrollers.live, 'adds', 'add')} people to it, and each person gets the emails on their own clock. Changes you save apply to people added from then on.`,
  };
}

/** What the badge on a row says. A sequence that is on and cannot reach anybody
 *  is not the same thing as one that is working, so it does not get the same
 *  green. */
export function sequenceRowState(
  status: SequenceLifecycle,
  enrollers: Enrollers
): { tone: 'success' | 'warning' | 'info'; label: string } {
  if (status === 'active' && nothingAddsAnyone(enrollers)) {
    return { tone: 'warning', label: 'On, adds nobody' };
  }
  if (status === 'active') return { tone: 'success', label: 'On' };
  if (status === 'archived') return { tone: 'info', label: 'Stopped' };
  return { tone: 'info', label: 'Draft' };
}

/** What the toast says the moment she turns it on. The old one promised delivery
 *  to "people enrolled from now on" without knowing whether anybody ever would
 *  be. [[feedback_a_promise_in_copy_is_a_contract]] */
export function turnOnWords(
  name: string,
  enrollers: Enrollers
): { title: string; description: string; type: 'success' | 'warning' } {
  if (nothingAddsAnyone(enrollers)) {
    return {
      title: `${name} is on, but nothing adds anyone`,
      description: `It will send nothing until somebody is in it. ${WAYS_IN}`,
      type: 'warning',
    };
  }
  return {
    title: `${name} is on`,
    description: `${rulesDo(enrollers.live, 'adds', 'add')} people to it, and they start receiving the emails from now on.`,
    type: 'success',
  };
}
