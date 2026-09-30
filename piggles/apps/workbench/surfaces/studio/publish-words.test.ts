// THE PUBLISH PANE TALKS ABOUT VISITORS. A DARK SITE HAS NONE.
//
// Four sentences on one screen, all true and all well written, all false the
// moment the public site is serving the "Temporarily unavailable" overlay
// instead of its pages:
//
//     2 pages have changes that visitors are not seeing yet.
//     Everything you have saved is live.
//     This is what visitors see.
//     Visitors will see the site exactly as it was on Saturday, straight away.
//
// Measured when this was found: 32 of the 113 tenants on the platform are past
// their grace window. Publishing still WORKS for all of them — the version
// changes and it is the version the site comes back with — so the actions are
// untouched and only the sentences move.

import { describe, expect, it } from 'vitest';
import {
  currentReleaseLabel,
  restoreConfirmDetail,
  waitingLine,
  type PublishState,
} from './publish-words';

function state(over: Partial<PublishState> = {}): PublishState {
  return {
    neverPublished: false,
    hasUnpublished: false,
    unpublishedPages: 0,
    frameUnpublished: false,
    ...over,
  };
}

describe('waitingLine', () => {
  it('says everything is live while the site is served', () => {
    expect(waitingLine(state(), false)).toBe('Everything you have saved is live.');
  });

  it('does not call it live while nothing is being served', () => {
    const line = waitingLine(state(), true);
    expect(line).not.toContain('is live');
    expect(line).toContain('comes back with');
  });

  it('names the pages waiting, in the singular and the plural', () => {
    expect(waitingLine(state({ hasUnpublished: true, unpublishedPages: 1 }), false)).toContain(
      '1 page has changes'
    );
    expect(waitingLine(state({ hasUnpublished: true, unpublishedPages: 2 }), false)).toContain(
      '2 pages have changes'
    );
  });

  it('stops saying visitors are not seeing them, when nobody is seeing anything', () => {
    const line = waitingLine(state({ hasUnpublished: true, unpublishedPages: 2 }), true);
    expect(line).toContain('2 pages have changes');
    expect(line).not.toContain('visitors');
  });

  it('does not tell her nobody can see a site that is answering the public', () => {
    // The assertion here used to be the whole defect, written down as a rule:
    // it pinned "Nobody can see it yet" under a comment claiming that sentence
    // was "already true whether the lights are on or off". An unpublished site
    // is served the code starter, so a visitor gets a working website with her
    // products on it (issue 851).
    const line = waitingLine(state({ neverPublished: true }), false);
    expect(line).toContain('never been published');
    expect(line).not.toContain('Nobody');
    expect(line).toContain('starter page');
  });

  it('does say nobody is seeing anything once the site is offline', () => {
    // The one case where "nobody" is true: suspension serves the Back soon
    // overlay instead of any page, starter or hers.
    const line = waitingLine(state({ neverPublished: true }), true);
    expect(line).toContain('never been published');
    expect(line).toContain('nobody is seeing anything');
    expect(line).not.toContain('starter page');
  });
});

describe('currentReleaseLabel', () => {
  it('says what visitors see while there are visitors', () => {
    expect(currentReleaseLabel(false)).toBe('This is what visitors see');
  });

  it('says what the site comes back with while it is offline', () => {
    expect(currentReleaseLabel(true)).not.toContain('visitors');
    expect(currentReleaseLabel(true)).toContain('comes back with');
  });
});

describe('restoreConfirmDetail', () => {
  it('keeps the part that is true either way', () => {
    // The restore IS immediate whatever the billing says, so the warning that
    // there is no publish step after it must survive both branches.
    for (const dark of [false, true]) {
      const detail = restoreConfirmDetail('Saturday at 7:58 AM', dark);
      expect(detail, String(dark)).toContain('There is no publish step after this');
      expect(detail, String(dark)).toContain('Saturday at 7:58 AM');
      expect(detail, String(dark)).toContain('stays where it is, unpublished');
    }
  });

  it('stops promising a visitor will see it straight away', () => {
    const detail = restoreConfirmDetail('Saturday at 7:58 AM', true);
    expect(detail).not.toContain('Visitors will see');
    expect(detail).toContain('offline right now');
  });
});

describe('the property all three share', () => {
  it('never speaks of visitors while the site shows nobody anything', () => {
    // Whatever the shape of the input, the promise and the state must agree.
    const shapes = [
      state(),
      // The never-published shape belongs in here too. It was the one branch
      // that returned the same string either way, so the property never reached
      // it and the branch was free to be wrong (issue 851).
      state({ neverPublished: true }),
      state({ hasUnpublished: true, unpublishedPages: 1 }),
      state({ hasUnpublished: true, unpublishedPages: 4, frameUnpublished: true }),
      state({ hasUnpublished: true, frameUnpublished: true }),
    ];
    for (const shape of shapes) {
      expect(/visitor/i.test(waitingLine(shape, true)), JSON.stringify(shape)).toBe(false);
    }
    expect(/visitor/i.test(currentReleaseLabel(true))).toBe(false);
    expect(/visitor/i.test(restoreConfirmDetail('Saturday', true))).toBe(false);
  });
});
