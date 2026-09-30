// A customer's BUSINESS reaches the list they are listed on (issue 883).
//
// There are two ways a customer carries an employer, and they are deliberately
// different facts (docs/144 §11):
//
//   · `company`      the name they TYPED. A guest checkout writes this and
//                    nothing else; a spreadsheet import has it and no record.
//   · `companyId`    a link to a real Company row. This is what a wholesale
//                    buyer has, and usually the ONLY one they have.
//
// The customers list read the typed one and nothing else, so the people with a
// real business showed a dash in the column headed "Company" while a retail
// shopper who had typed the name showed it. The search box said "Search name,
// company or email" and could not find them by their business either.
//
// ── WHY THE RELATION CANNOT SIMPLY BE INCLUDED ──────────────────────────────
//
// `Customer.company` is a Prisma computed field (see @wizeworks/db's client)
// that SHADOWS the relation of the same name: ask for the relation and you get
// the typed string back instead, silently, with no error. That is how two other
// screens lost their business name (issue 751). So the business is fetched by
// id and attached under `b2bAccount`, the name the order screens already use.
//
// ── WHY THE FIXTURE LOOKS LIKE THIS ─────────────────────────────────────────
//
// The business is named so that NO part of it appears in the customer's email
// address. On the development database the real pair are `tamsin@loomandlarder`
// at "Loom and Larder", where searching the business finds them through the
// email domain by luck — a fixture like that passes with the fix removed.
// [[feedback_a_test_that_cannot_go_red]]

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { companyService, customerService } from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('a customer keeps the business they buy for', () => {
  let test: TestContext;
  let businessId: string;
  let linkedId: string;
  let typedId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');

    const business = await companyService.create(test.ctx, {
      companyName: 'Thornbury Haberdashery',
    });
    businessId = business.id;

    // Buys FOR the business. No typed name, and an email that shares not one
    // word with it.
    const linked = await customerService.create(test.ctx, {
      type: 'b2b',
      email: 'buyer@example.test',
      firstName: 'Wholesale',
      lastName: 'Buyer',
      companyId: businessId,
    });
    linkedId = linked.id;

    // Typed an employer, linked to nothing. This one always worked, and is here
    // so a fix that swapped one field for the other goes red.
    const typed = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'shopper@example.test',
      firstName: 'Retail',
      lastName: 'Shopper',
      company: 'Thornbury Haberdashery',
    });
    typedId = typed.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('carries the linked business onto the row the list draws', async () => {
    const { items } = await customerService.list(test.ctx, {});
    const row = items.find((c) => c.id === linkedId);

    expect(row?.b2bAccount?.companyName).toBe('Thornbury Haberdashery');
    expect(row?.b2bAccount?.id).toBe(businessId);
    // The typed field stays empty. The two are different facts and this row
    // genuinely has only one of them — filling `companyName` in would be the
    // platform inventing something the customer never said.
    expect(row?.companyName).toBeNull();
  });

  it('leaves a customer who typed a name exactly as they typed it', async () => {
    const { items } = await customerService.list(test.ctx, {});
    const row = items.find((c) => c.id === typedId);

    expect(row?.companyName).toBe('Thornbury Haberdashery');
    expect(row?.b2bAccount).toBeNull();
  });

  it('says nothing for somebody who buys for themselves', async () => {
    const alone = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'alone@example.test',
      firstName: 'On',
      lastName: 'Their Own',
    });
    const { items } = await customerService.list(test.ctx, {});
    const row = items.find((c) => c.id === alone.id);

    // Not undefined: the key is always present, so a screen reading it never
    // has to tell "no business" apart from "this row was fetched differently".
    expect(row?.b2bAccount).toBeNull();
    expect(row?.companyName).toBeNull();
  });

  it('finds somebody by the business they are linked to', async () => {
    // The whole point. Not one word of "Thornbury" is in `buyer@example.test`,
    // so this can only pass by searching the linked record.
    const { items } = await customerService.list(test.ctx, { q: 'Thornbury' });
    const ids = items.map((c) => c.id);

    expect(ids).toContain(linkedId);
    // And still finds the one who typed it, which is the half that already
    // worked and must not be traded away.
    expect(ids).toContain(typedId);
  });

  it('still finds somebody by their name and their email', async () => {
    const byName = await customerService.list(test.ctx, { q: 'Wholesale' });
    expect(byName.items.map((c) => c.id)).toContain(linkedId);

    const byEmail = await customerService.list(test.ctx, { q: 'shopper@example.test' });
    expect(byEmail.items.map((c) => c.id)).toContain(typedId);
  });
});
