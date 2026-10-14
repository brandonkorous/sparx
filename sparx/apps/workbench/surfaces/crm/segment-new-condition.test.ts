import { describe, expect, it } from 'vitest';
import { emptyRoot, newPredicate, serializeNode } from './segment-rules';

/**
 * A NEW CONDITION WAITS FOR ITS VALUE (sparx persona issue 150).
 *
 * It came in as "Relationship is Individual": a new segment matched 31 of 38
 * before anything was chosen, and under "any of" an added condition put 30
 * more people in the audience. A yes/no field filled in "yes" the same way.
 */
describe('a new condition', () => {
  it('starts with no value, for a choice field and a yes/no field', () => {
    expect(newPredicate().value).toBe('');
    expect(newPredicate('customer.doNotContact').value).toBe('');
    expect(newPredicate('b2bAccount.status').value).toBe('');
  });

  it('cannot be saved or previewed until a value is picked', () => {
    const result = serializeNode(emptyRoot());
    expect(result.ok).toBe(false);
  });

  it('never reads an empty yes/no value as "no"', () => {
    const blank = { ...newPredicate('email.subscribed'), value: '' };
    expect(serializeNode(blank).ok).toBe(false);
    const no = { ...newPredicate('email.subscribed'), value: 'false' };
    expect(serializeNode(no)).toEqual({
      ok: true,
      rule: { kind: 'predicate', field: 'email.subscribed', op: 'eq', value: false },
    });
  });
});
