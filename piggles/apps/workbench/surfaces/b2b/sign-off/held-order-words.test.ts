// What a held order says about who it waits on (sparx persona issue 087).
import { describe, expect, it } from 'vitest';
import { accountOnly, both, day, SAM, signOff, TEODORA, WASATCH } from './fixtures';
import { heldOrderNotice } from './held-order-words';
import type { SignOff } from './people-words';

describe('heldOrderNotice', () => {
  it('names who the order waits on when only the account is asked', () => {
    const notice = heldOrderNotice(accountOnly, WASATCH, day);
    expect(notice.tone).toBe('info');
    expect(notice.title).toBe('Waiting for Teodora Vukić-Hale');
    expect(notice.detail).toContain('goes ahead as soon as they do');
  });

  it('says what is certain when the queue could not say', () => {
    const notice = heldOrderNotice(null, WASATCH, day);
    expect(notice.title).toBe('Waiting for sign-off');
    expect(notice.detail).toContain('Approvals');
  });

  it('never repeats in the detail the names its title gives', () => {
    const shapes: SignOff[] = [
      accountOnly,
      both,
      { ...accountOnly, accountApprovers: [TEODORA, SAM] },
      { ...both, accountApprovers: [TEODORA, SAM] },
    ];
    for (const shape of shapes) {
      const notice = heldOrderNotice(shape, WASATCH, day);
      for (const approver of shape.accountApprovers) {
        expect(notice.title).toContain(approver.name);
        expect(notice.detail, JSON.stringify(shape)).not.toContain(approver.name);
      }
      expect(notice.detail).toContain(`on your site, at ${WASATCH}`);
    }
  });

  it('asks the team when the team is waited on', () => {
    expect(heldOrderNotice(signOff(), WASATCH, day).title).toBe('Waiting for your team');
    expect(heldOrderNotice(both, WASATCH, day).title).toBe(
      'Waiting for your team and Teodora Vukić-Hale'
    );
  });
});
