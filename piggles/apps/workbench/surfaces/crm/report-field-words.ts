// THE REPORT BUILDER'S FIELD NAMES, IN THIS CONSOLE'S WORDS.
//
// Every other screen gets its vocabulary from `lib/console/vocabulary.ts`,
// which renames a surface before anybody sees it. The report builder does not:
// its field names arrive from the API, written for the other console's reader,
// and the console draws them straight onto the "Broken down by" picker, the
// rule editor, and every column heading of the answer.
//
// So a person who makes clothes, opening the one screen whose whole job is to
// let her ask her own question, was offered:
//
//     Stage · Lead status · Owner · Probability · Pipeline
//
// Five words out of somebody else's trade, on a pane otherwise written in
// plain English throughout ("What to look at", "What to work out", "How to
// break it down"). The pane was fine. The list inside it was not.
//
// ── WHY A MAP HERE RATHER THAN A CHANGE UPSTREAM ────────────────────────────
//
// "Stage" and "Pipeline" are the right words for sparx: its reader came to run
// a system and those are the terms of art on every screen they use. This is the
// same split `lib/console/channels.ts` makes for where a sale came from, and
// the same one vocabulary.ts makes for screen names. The KEY is the identity
// and it is untouched; only the word changes.
//
// A field with no entry keeps the API's word, which is usually right: "Job
// title", "Last order", "Do not contact" and "Lifetime spend" need nothing.
// Anything listed here is a word this console has already chosen elsewhere, so
// the picker agrees with the screen it came from.

/** Object key → field key → what Piggles calls it. */
const FIELD_WORDS: Record<string, Record<string, string>> = {
  contact: {
    // The pipelines pane calls a pipeline's positions STEPS, and this is not
    // one of them anyway: it is how far along a person is with you, which is
    // what the ready-made "Customers by stage" report spells out in words.
    lifecycleStage: 'How far along',
    // "Lead" is the one piece of sales vocabulary this console removed from the
    // scoring pane (issue 811). It has no business coming back through a picker.
    leadStatus: 'How keen they are',
    assignedRepId: 'Who looks after them',
  },
  company: {
    assignedRepId: 'Who looks after them',
  },
  deal: {
    // `pipeline-detail.tsx` says Steps, "Add a step", "Step name".
    stageId: 'Step',
    // The rail calls the list of these "How things move".
    pipelineId: 'Board',
    // The step editor labels this field Chance, with a % beside the box.
    probability: 'Chance',
    assignedRepId: 'Who looks after it',
  },
  ticket: {
    stageId: 'Step',
    assignedToUserId: 'Who is on it',
  },
  task: {
    assignedToUserId: 'Who it is for',
  },
};

/** What this console calls one field. The API's own word when it has no better
 *  one of its own, never a made-up one. */
export function fieldWord(objectKey: string, fieldKey: string, apiLabel: string): string {
  return FIELD_WORDS[objectKey]?.[fieldKey] ?? apiLabel;
}

/** The keys this console renames, for the test that proves no two fields on one
 *  object end up sharing a name once these are applied. */
export const RENAMED_FIELDS = FIELD_WORDS;
