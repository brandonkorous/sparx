// What `GET /v1/b2b/quotes` looks for, given what was asked for.
//
// The Quotes screen had no search and no filters at all, so this whole clause
// was one line and nothing could get it wrong. It now carries four narrowing
// inputs, two of which reach the SAME relation — and a filter that quietly
// stops applying looks exactly like a filter that matched nothing.
// [[feedback_absent_behaves_like_fine]]

import { describe, expect, it } from 'vitest';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';

import { quoteListWhere } from '../../src/routes/v1/b2b/quotes.js';

type Query = Parameters<typeof quoteListWhere>[0];

const ask = (over: Partial<Query> = {}): Query => ({ take: 50, skip: 0, ...over });

describe('quoteListWhere', () => {
  it('always asks for the quotes workflow, and never for deleted rows', () => {
    const where = quoteListWhere(ask());
    expect(where.workflow).toEqual({ slug: B2B_QUOTE_WORKFLOW_SLUG });
    expect(where.deletedAt).toBeNull();
  });

  it('does not require a trade account when none was asked for (issue 763)', () => {
    // Fourteen of the sixteen quotes on the dev machine have no company on
    // them. Requiring one hid almost every quote behind "No quotes yet".
    expect(quoteListWhere(ask())).not.toHaveProperty('companyId');
  });

  it('asks the stage TYPE for a state, so a renamed stage still matches', () => {
    expect(quoteListWhere(ask({ state: 'open' })).stage).toEqual({ stageType: 'draft' });
    expect(quoteListWhere(ask({ state: 'accepted' })).stage).toEqual({ stageType: 'committed' });
    expect(quoteListWhere(ask({ state: 'closed' })).stage).toEqual({ stageType: 'void' });
  });

  it('keeps BOTH stage narrowings when a name and a state are asked for together', () => {
    // The bug this exists for: spreading `{ stage: { name } }` and then
    // `{ stage: { stageType } }` into one object drops the first silently. The
    // caller gets a wider answer than it asked for and nothing says so.
    expect(quoteListWhere(ask({ stage: 'Quoted', state: 'open' })).stage).toEqual({
      name: 'Quoted',
      stageType: 'draft',
    });
  });

  it('leaves the stage alone when neither was asked for', () => {
    expect(quoteListWhere(ask())).not.toHaveProperty('stage');
  });

  it('searches the number, the business, the person and their email', () => {
    const where = quoteListWhere(ask({ q: 'vale' }));
    expect(where.OR).toEqual([
      { number: { contains: 'vale', mode: 'insensitive' } },
      { company: { companyName: { contains: 'vale', mode: 'insensitive' } } },
      { customer: { firstName: { contains: 'vale', mode: 'insensitive' } } },
      { customer: { lastName: { contains: 'vale', mode: 'insensitive' } } },
      { customer: { email: { contains: 'vale', mode: 'insensitive' } } },
    ]);
  });

  it('treats a search of only spaces as no search at all', () => {
    expect(quoteListWhere(ask({ q: '   ' }))).not.toHaveProperty('OR');
  });

  it('trims a search before using it', () => {
    const where = quoteListWhere(ask({ q: '  Loom  ' }));
    expect(where.OR?.[0]).toEqual({ number: { contains: 'Loom', mode: 'insensitive' } });
  });

  it('narrows to one business when an account is asked for', () => {
    expect(quoteListWhere(ask({ account_id: 'a-1' })).companyId).toBe('a-1');
  });
});
