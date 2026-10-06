// What the approvals queue says about who signs, so it never offers an Approve the
// server refuses (sparx persona issue 087).
import { describe, expect, it } from 'vitest';
import { accountOnly, both, day, SAM, signOff, TEODORA, WASATCH } from './fixtures';
import type { SignOff } from './people-words';
import { queueSignOffView } from './queue-words';

describe('queueSignOffView', () => {
  it('offers no Approve when only the account is waited on, and says who and that Reject stays', () => {
    const view = queueSignOffView(accountOnly, WASATCH, day);
    expect(view.canApprove).toBe(false);
    expect(view.badges).toEqual([{ label: 'Waiting for Teodora Vukić-Hale', tone: 'info' }]);
    // The badge names her; the sentence says where, and what happens next.
    expect(view.line).toBe(
      `They approve it on your site, at ${WASATCH}. It goes ahead as soon as they do, and you ` +
        'can still turn it down here.'
    );
  });

  it('offers Approve on an ordinary hold and adds no line', () => {
    const view = queueSignOffView(signOff(), WASATCH, day);
    expect(view.canApprove).toBe(true);
    expect(view.line).toBeNull();
    // Approve says it already; a badge on every row would say nothing.
    expect(view.badges).toEqual([]);
  });

  it('shows who at the account signed, and that the business is next', () => {
    const view = queueSignOffView(
      signOff({
        needs: ['account', 'business'],
        waitingOn: ['business'],
        signed: { account: { name: 'Teodora Vukić-Hale', at: '2026-10-03T15:00:00.000Z' } },
        accountApprovers: [TEODORA],
      }),
      WASATCH,
      day
    );
    expect(view.canApprove).toBe(true);
    expect(view.badges[0]).toEqual({
      label: 'Approved by Teodora Vukić-Hale, day(2026-10-03)',
      tone: 'success',
    });
    expect(view.line).toBe('It goes ahead as soon as you approve it.');
  });
});

describe('queueSignOffView', () => {
  it('says both have to approve when both are waited on', () => {
    const view = queueSignOffView(both, WASATCH, day);
    expect(view.canApprove).toBe(true);
    expect(view.line).toBe(
      'Either of you can go first, and it goes ahead once you both have. They approve on your ' +
        `site, at ${WASATCH}.`
    );
    expect(view.badges.map((badge) => badge.tone)).toEqual(['warning', 'info']);
  });

  it('after the business signs, waits on the account and offers no second Approve', () => {
    const view = queueSignOffView(
      signOff({
        needs: ['account', 'business'],
        waitingOn: ['account'],
        signed: { business: { name: 'Doty Brown', at: '2026-10-03T16:00:00.000Z' } },
        accountApprovers: [TEODORA],
      }),
      WASATCH,
      day
    );
    expect(view.canApprove).toBe(false);
    expect(view.badges[0]?.label).toBe('Approved by Doty Brown, day(2026-10-03)');
    expect(view.badges[1]?.label).toBe('Waiting for Teodora Vukić-Hale');
    expect(view.line).toContain(`They approve it on your site, at ${WASATCH}`);
  });

  it('names several approvers in the sentence, since the badge does not', () => {
    const view = queueSignOffView(
      { ...accountOnly, accountApprovers: [TEODORA, SAM] },
      WASATCH,
      day
    );
    expect(view.badges).toEqual([{ label: 'Waiting for their approvers', tone: 'info' }]);
    expect(view.line).toContain(`Teodora Vukić-Hale or Sam Okafor at ${WASATCH} can approve it`);
  });
});

describe('queueSignOffView', () => {
  it('never says in the sentence what a badge beside it already says', () => {
    // sparx persona issue 087: "Waiting for Teodora Vukić-Hale" sat over
    // "Waiting for Teodora Vukić-Hale at Wasatch ... to approve it".
    const signedByThem = {
      account: { name: 'Teodora Vukić-Hale', at: '2026-10-03T15:00:00.000Z' },
    };
    const signedByUs = { business: { name: 'Doty Brown', at: '2026-10-03T16:00:00.000Z' } };
    const shapes: SignOff[] = [
      accountOnly,
      both,
      { ...accountOnly, needs: ['account', 'business'], signed: signedByUs },
      { ...both, waitingOn: ['business'], signed: signedByThem },
    ];
    for (const shape of shapes) {
      const view = queueSignOffView(shape, WASATCH, day);
      for (const badge of view.badges) {
        const said = badge.label
          .replace(/^Waiting for /, '')
          .replace(/^Approved by /, '')
          .replace(/, day\(.*\)$/, '');
        expect(view.line ?? '', `${badge.label} / ${JSON.stringify(shape)}`).not.toContain(said);
      }
      // "Needs your approval" already says it is the business's turn.
      expect(view.line ?? '').not.toMatch(/sign-off is next/i);
    }
  });

  it('never offers Approve unless the business is waited on', () => {
    const shapes: SignOff[] = [
      accountOnly,
      both,
      signOff(),
      signOff({ needs: ['account', 'business'], waitingOn: ['account'], accountApprovers: [SAM] }),
      signOff({ waitingOn: [] }),
    ];
    for (const shape of shapes) {
      expect(queueSignOffView(shape, WASATCH, day).canApprove, JSON.stringify(shape)).toBe(
        shape.waitingOn.includes('business')
      );
    }
  });
});
