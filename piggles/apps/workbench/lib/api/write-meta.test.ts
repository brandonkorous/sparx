import { describe, expect, it } from 'vitest';
import { readWriteMeta, writeFailureTitle } from './write-meta';

/**
 * "THAT DIDN'T SAVE" - EVERY FAILED WRITE IN THE CONSOLE, FOREVER.
 *
 * `WriteMeta.writing` was built to name the thing that failed, documented down
 * to why it matters when the toast arrives three panes away, read by
 * write-failure-reporter.tsx - and set by NONE of the 712 mutations in this app,
 * so the named branch had never once run. The generic sentence looked like the
 * design rather than the fallback, which is what kept it invisible.
 *
 * `running` is the half that was missing. 14 of those mutations RUN something
 * instead of saving something of hers, and telling her a check "didn't save"
 * sends her looking for lost work that was never at risk.
 */
describe('writeFailureTitle', () => {
  it('names an action by what it was doing', () => {
    expect(writeFailureTitle({ running: 'check your stock' })).toBe("Couldn't check your stock");
  });

  it('names a save by what was being saved', () => {
    expect(writeFailureTitle({ writing: 'your invoice' })).toBe("Couldn't save your invoice");
  });

  it('never says "save" about something that saved nothing of hers', () => {
    expect(writeFailureTitle({ running: 'read that file' })).not.toContain('save');
  });

  it('falls back only when the mutation said nothing about itself', () => {
    expect(writeFailureTitle({})).toBe("That didn't save");
  });

  it('prefers the action when a mutation somehow claims both', () => {
    expect(writeFailureTitle({ running: 'open checkout', writing: 'your bill' })).toBe(
      "Couldn't open checkout"
    );
  });
});

describe('readWriteMeta', () => {
  it('reads the running phrase off the bag', () => {
    expect(readWriteMeta({ running: 'check your stock' })).toEqual({
      running: 'check your stock',
    });
  });

  it('ignores a non-string, so a bad meta cannot produce "Couldn\'t true"', () => {
    expect(readWriteMeta({ running: true })).toEqual({});
  });

  it('survives a mutation with no meta at all', () => {
    expect(readWriteMeta(undefined)).toEqual({});
    expect(readWriteMeta(null)).toEqual({});
  });
});
