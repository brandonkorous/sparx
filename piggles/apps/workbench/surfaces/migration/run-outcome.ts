// WHAT A RUN ACTUALLY DID, IN WORDS.
//
// Split from the panes because both of them tell the same story and must not tell
// it differently: the progress pane while you watch, the history list afterwards.
//
// It exists because `imported + updated` was the only number either screen showed,
// and that one number cannot tell 25 new customers from 25 overwritten ones. Devi
// re-imported the mailing list she had already imported: nothing arrived, twenty
// five records were replaced, and both screens said "25 of 25 brought over" — the
// same sentence a run that added twenty five people would have produced.

/** The two halves of a landed run, summed across every kind of record in it. */
export interface Landed {
  imported: number;
  updated: number;
}

export function landedTotals(entities: { imported: number; updated: number }[]): Landed {
  return entities.reduce<Landed>(
    (sum, entity) => ({
      imported: sum.imported + entity.imported,
      updated: sum.updated + entity.updated,
    }),
    { imported: 0, updated: 0 }
  );
}

/** Nothing arrived; everything in the file landed on somebody already here. */
export function nothingIsNew({ imported, updated }: Landed): boolean {
  return imported === 0 && updated > 0;
}

/**
 * The breakdown line under a count, or null when there is nothing to break down.
 *
 * A file of all-new people needs no second sentence — the count already says it.
 * Anything else does, and the all-updates case says so in words rather than
 * leaving a person to work it out from two numbers.
 */
export function landedBreakdown(landed: Landed, dryRun: boolean): string | null {
  if (landed.updated === 0) return null;
  if (landed.imported === 0) {
    return dryRun
      ? 'none of them new — every one is somebody you already have'
      : 'none of them new — every one was somebody you already had';
  }
  return `${landed.imported.toLocaleString()} new · ${landed.updated.toLocaleString()} already here`;
}

export interface RunHeadline {
  tone: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
}

/**
 * The banner at the top of a run.
 *
 * "Nobody in this file is new" is a warning rather than a success on purpose. Nothing
 * failed, but a bulk overwrite of records she already has is not the thing she pressed
 * the button for, and on a practice run it is the moment to stop.
 */
export function runHeadline(run: { status: string; dryRun: boolean }, landed: Landed): RunHeadline {
  if (run.status === 'running') {
    // A practice run must not claim to be moving anything WHILE it runs — that is
    // the one sentence a nervous person is watching for, and it was not true.
    return run.dryRun
      ? {
          tone: 'info',
          title: 'Trying it out — nothing is being saved…',
          description:
            'We are checking every row against what you already have. Nothing is being written to your business.',
        }
      : {
          tone: 'info',
          title: 'Bringing your business over…',
          description: 'You can close this and come back — it keeps going without you.',
        };
  }

  if (run.status === 'failed') {
    return {
      tone: 'danger',
      title: 'Some of this did not land',
      description:
        'The rest did come across. Nothing below has to be done again — bringing the same file in a second time updates what is here rather than duplicating it.',
    };
  }

  if (nothingIsNew(landed)) {
    const count = landed.updated.toLocaleString();
    return run.dryRun
      ? {
          tone: 'warning',
          title: 'Nobody in this file is new',
          description: `All ${count} are people you already have. Doing this for real replaces their name, phone, tags and address with whatever this file says — including anything you have changed here since the file was made. Anyone who has been taken off marketing stays off it.`,
        }
      : {
          tone: 'warning',
          title: 'Nobody in this file was new',
          description: `All ${count} were people you already had, and their details now match this file. Anyone who had been taken off marketing stayed off it.`,
        };
  }

  return run.dryRun
    ? {
        tone: 'success',
        title: 'Practice run finished — nothing was saved',
        description:
          'This is exactly what a real import would do. Run it for real when you are ready.',
      }
    : {
        tone: 'success',
        title: 'Your business is here',
        description: 'Everything below is now in your account.',
      };
}
