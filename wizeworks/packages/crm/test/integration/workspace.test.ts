// Phase 7 of docs/144 — companies, settings, saved views, booking links and
// e-sign, plus the rules that came out of driving all of it in a browser.
//
// Most of what is here is not "does the function work". It is the set of things
// that were WRONG and would be silently wrong again, because every one of them
// typechecked, linted and looked fine on screen:
//
//   • Duplicate detection ran across the whole tenant, so two unrelated
//     businesses under one owner had their shared customers scored 100 and
//     offered to `bulkMerge`, which would have handed each business the other's
//     order history.
//   • A merge dropped `doNotContact`, silently re-opening somebody who had asked
//     not to be contacted, and demoted a paying customer back to a lead.
//   • The domain-suggestion setting was written per SITE and read at TENANT
//     scope, so turning it on changed nothing at all.
//   • Adding a contact who already existed raised a 500 instead of saying so.
//
// Each of those gets a test that fails if it comes back.

import crypto from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@wizeworks/db';
import {
  companyService,
  crmSettingsService,
  customerService,
  meetingLinkService,
  mergeService,
  savedViewService,
} from '../../src/services/index.js';
import { CrmConflictError, CrmValidationError } from '../../src/errors.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** A second site under the same tenant — the "one owner, two businesses" case
 *  that every cross-site rule below is about. */
async function makeSecondSite(tenantId: string, name: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const site = await tx.property.create({
      data: {
        tenantId,
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
        isPrimary: false,
      },
    });
    return site.id;
  });
}

describe('phase 7 — companies, settings, views and duplicates', () => {
  let test: TestContext;

  // A FRESH TENANT PER TEST, not per file. Several of these assert on a
  // tenant-WIDE scan — how many duplicate groups exist, how many rows a bulk
  // merge touched — so a fixture left behind by an earlier test is a false
  // positive in a later one. That is not hypothetical: it failed two correct
  // assertions on the first run.
  beforeEach(async () => {
    test = await makeTestContext();
  });

  afterEach(async () => {
    await disposeTestContext(test);
  });

  describe('company domains and the association offer', () => {
    it('never guesses an employer from a personal mailbox', async () => {
      await crmSettingsService.update(test.ctx, { domainAssociation: true }, test.propertyId);
      await companyService.create(test.ctx, {
        companyName: 'Brightleaf Catering',
        domains: ['gmail.com'],
      });

      const match = await companyService.matchByEmailDomain(
        test.ctx,
        'someone@gmail.com',
        test.propertyId
      );

      // The blocklist wins even when a company has (wrongly) claimed the domain.
      // Half a tenant's contacts share a personal provider, and filing them all
      // under one company is worse than filing none of them.
      expect(match.company).toBeNull();
      expect(match.reason).toBe('public-domain');
    });

    it('matches a company that claimed the domain', async () => {
      await crmSettingsService.update(test.ctx, { domainAssociation: true }, test.propertyId);
      const company = await companyService.create(test.ctx, {
        companyName: 'Northgate Dental Group',
        domains: ['northgatedental.com'],
      });

      const match = await companyService.matchByEmailDomain(
        test.ctx,
        'Priya@NorthgateDental.com',
        test.propertyId
      );

      expect(match.company?.id).toBe(company.id);
    });

    it('reads the setting from the SITE it was saved on, not the tenant', async () => {
      await crmSettingsService.update(test.ctx, { domainAssociation: true }, test.propertyId);
      await companyService.create(test.ctx, {
        companyName: 'Harborview Inn',
        domains: ['harborviewinn.com'],
      });

      const otherSite = await makeSecondSite(test.tenant.tenantId, 'Ironleaf Tattoo');

      // Saved on the primary site only. The second site never opted in, so it
      // must not inherit the suggestion — this is the bug that made the switch
      // look broken, in reverse.
      const onPrimary = await companyService.matchByEmailDomain(
        test.ctx,
        'elena@harborviewinn.com',
        test.propertyId
      );
      const onOther = await companyService.matchByEmailDomain(
        test.ctx,
        'elena@harborviewinn.com',
        otherSite
      );

      expect(onPrimary.company).not.toBeNull();
      expect(onOther.reason).toBe('disabled');
    });

    it('answers "off" when nobody has turned it on', async () => {
      await crmSettingsService.update(test.ctx, { domainAssociation: false }, test.propertyId);
      await companyService.create(test.ctx, {
        companyName: 'Kestrel Software',
        domains: ['kestrel.io'],
      });

      const match = await companyService.matchByEmailDomain(
        test.ctx,
        'aisha@kestrel.io',
        test.propertyId
      );
      expect(match.reason).toBe('disabled');
    });
  });

  describe('adding somebody who is already on file', () => {
    it('says who has the address instead of failing', async () => {
      await customerService.create(test.ctx, {
        firstName: 'Dana',
        lastName: 'Whitfield',
        email: 'dana@brightleafcatering.com',
        propertyId: test.propertyId,
      });

      // The whole point: a business owner typing in a contact they met at a
      // trade show gets a sentence naming the person, not "an internal error
      // occurred" — which is what sends them back to type a variant address and
      // create the duplicate this refuses.
      await expect(
        customerService.create(test.ctx, {
          firstName: 'Dana',
          lastName: 'Whitfield',
          email: 'dana@brightleafcatering.com',
          propertyId: test.propertyId,
        })
      ).rejects.toBeInstanceOf(CrmConflictError);
    });

    // The gap this closes: `(tenant, site, email)` never fired for TENANT-WIDE
    // contacts, because Postgres counts NULLs as DISTINCT and a tenant-wide
    // contact has no site. Two records could hold one address indefinitely with
    // nothing raising. `customers_tenant_global_email_unique` is the partial
    // index that covers exactly those rows.
    it('holds for contacts that belong to the whole business, not one site', async () => {
      await customerService.create(test.ctx, {
        firstName: 'Priya',
        lastName: 'Raman',
        email: 'priya@northgatedental.com',
      });

      await expect(
        customerService.create(test.ctx, {
          firstName: 'Priya',
          lastName: 'Raman',
          email: 'priya@northgatedental.com',
        })
      ).rejects.toBeInstanceOf(CrmConflictError);
    });

    // Both indexes compare raw text, so `Jane@x.com` and `jane@x.com` were two
    // contacts to the database and one person to everybody else — the same bug
    // the indexes exist to prevent, walking in through a door they do not watch.
    // Normalising in the schema rather than the service is what makes REST, MCP,
    // GraphQL, the importer and the storefront signup all agree.
    it('treats an address typed in a different case as the same person', async () => {
      const typedOneWay = await customerService.create(test.ctx, {
        firstName: 'Meredith',
        lastName: 'Okonjo',
        email: '  Meredith.Okonjo@MeridianArchitects.com ',
        propertyId: test.propertyId,
      });

      // Stored the way it will be compared — not the way it was typed.
      expect(typedOneWay.email).toBe('meredith.okonjo@meridianarchitects.com');

      await expect(
        customerService.create(test.ctx, {
          firstName: 'Meredith',
          lastName: 'Okonjo',
          email: 'meredith.okonjo@meridianarchitects.com',
          propertyId: test.propertyId,
        })
      ).rejects.toBeInstanceOf(CrmConflictError);
    });

    // Why that index is PARTIAL rather than `NULLS NOT DISTINCT`: the keyword
    // applies to the whole index, so it would also collapse every contact with
    // no email into one row and stop a business keeping two phone-only
    // customers. A CRM where the second walk-in cannot be saved would be a far
    // worse bug than the one being fixed.
    it('still lets a business keep two contacts with no email at all', async () => {
      const first = await customerService.create(test.ctx, {
        firstName: 'Walk-in',
        lastName: 'Tuesday',
        phone: '555-0101',
      });
      const second = await customerService.create(test.ctx, {
        firstName: 'Walk-in',
        lastName: 'Thursday',
        phone: '555-0102',
      });

      expect(first.id).not.toBe(second.id);
    });
  });

  describe('a merge carries the whole person across', () => {
    // A merge used to relink four tables out of the thirty-seven that carry a
    // customer. Everything else — orders, invoices, bookings, consent — stayed
    // pointed at the record that had just been retired, while the survivor's
    // totals were rolled up from it in the same transaction. The contact then
    // read "3 orders, $2,400" above an empty list.
    //
    // Consent is the one tested here because it is the one with a legal edge:
    // a person's recorded "no" attaching to a record in the bin, while the
    // record they now are has nothing on file, is how somebody gets emailed
    // after asking not to be.
    it('does not leave a consent record on the retired contact', async () => {
      const keep = await customerService.create(test.ctx, {
        firstName: 'Owen',
        lastName: 'Marsh',
        email: 'owen@harborviewinn.com',
        propertyId: test.propertyId,
      });
      const alsoOwen = await customerService.create(test.ctx, {
        firstName: 'Owen',
        lastName: 'Marsh',
        email: 'o.marsh@harborviewinn.com',
        propertyId: test.propertyId,
      });

      const consentId = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.tenant.tenantId}'`);
        const record = await tx.consentRecord.create({
          data: {
            tenantId: test.tenant.tenantId,
            propertyId: test.propertyId,
            visitorId: crypto.randomUUID(),
            customerId: alsoOwen.id,
            mode: 'gdpr',
            categories: { strictly_necessary: true, marketing: false },
            action: 'reject_all',
            policyVersion: '2026-01',
          },
        });
        return record.id;
      });

      const result = await mergeService.merge(test.ctx, {
        primaryCustomerId: keep.id,
        duplicateCustomerIds: [alsoOwen.id],
      });

      const moved = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.tenant.tenantId}'`);
        return tx.consentRecord.findUnique({
          where: { id: consentId },
          select: { customerId: true },
        });
      });

      expect(moved?.customerId).toBe(keep.id);
      expect(result.reattached.everythingElse).toBeGreaterThan(0);
    });
  });

  describe('duplicates never cross a site boundary', () => {
    it('does not group the same person on two different sites', async () => {
      const otherSite = await makeSecondSite(test.tenant.tenantId, 'Wildflower Bakery');

      await customerService.create(test.ctx, {
        firstName: 'Jo',
        lastName: 'Nkemelu',
        email: 'jo@meridianarch.com',
        propertyId: test.propertyId,
      });
      await customerService.create(test.ctx, {
        firstName: 'Jo',
        lastName: 'Nkemelu',
        email: 'jo@meridianarch.com',
        propertyId: otherSite,
      });

      const groups = await mergeService.findLikelyDuplicates(test.ctx, {});
      const emailGroups = groups.filter((group) => group.reason === 'email');

      // A site is a whole business. One person dealing with two of them is two
      // customers, and the customers table says so — its unique key is
      // (tenant, site, email), so this pair is not a collision at all.
      expect(emailGroups).toHaveLength(0);
    });

    it('refuses a merge across sites even when asked directly', async () => {
      const otherSite = await makeSecondSite(test.tenant.tenantId, 'Meridian Studio');

      const here = await customerService.create(test.ctx, {
        firstName: 'Sam',
        lastName: 'Osei',
        email: 'sam@example.test',
        propertyId: test.propertyId,
      });
      const there = await customerService.create(test.ctx, {
        firstName: 'Sam',
        lastName: 'Osei',
        email: 'sam@example.test',
        propertyId: otherSite,
      });

      // The detector is not the only caller — MCP and the REST route reach
      // `merge` directly, so the rule lives in the service, not the scan.
      await expect(
        mergeService.merge(test.ctx, {
          primaryCustomerId: here.id,
          duplicateCustomerIds: [there.id],
        })
      ).rejects.toBeInstanceOf(CrmValidationError);
    });
  });

  describe('what survives a merge', () => {
    it('keeps a do-not-contact even when the surviving record allowed contact', async () => {
      const keeper = await customerService.create(test.ctx, {
        firstName: 'Rosa',
        lastName: 'Lindqvist',
        email: 'rosa@example.test',
        propertyId: test.propertyId,
        doNotContact: false,
      });
      const optedOut = await customerService.create(test.ctx, {
        firstName: 'Rosa',
        lastName: 'Lindqvist',
        email: 'rosa.l@example.test',
        propertyId: test.propertyId,
        doNotContact: true,
      });

      const result = await mergeService.merge(test.ctx, {
        primaryCustomerId: keeper.id,
        duplicateCustomerIds: [optedOut.id],
      });

      // `false` is not `null`, so the fill-what-is-missing rule never looked at
      // this field: merging silently re-opened somebody who had asked not to be
      // contacted, and nothing anywhere said so.
      expect(result.primary.doNotContact).toBe(true);
    });

    it('does not demote a paying customer to a lead', async () => {
      const lead = await customerService.create(test.ctx, {
        firstName: 'Tam',
        lastName: 'Boateng',
        email: 'tam@example.test',
        propertyId: test.propertyId,
        lifecycleStage: 'lead',
      });
      const buyer = await customerService.create(test.ctx, {
        firstName: 'Tam',
        lastName: 'Boateng',
        email: 't.boateng@example.test',
        propertyId: test.propertyId,
        lifecycleStage: 'customer',
      });

      // Keeping the LEAD deliberately — the record somebody happens to choose is
      // often the newer stub, and the person's history should not be graded by
      // that choice.
      const result = await mergeService.merge(test.ctx, {
        primaryCustomerId: lead.id,
        duplicateCustomerIds: [buyer.id],
      });

      expect(result.primary.lifecycleStage).toBe('customer');
    });

    it('carries the company across when the survivor has none', async () => {
      const company = await companyService.create(test.ctx, {
        companyName: 'Brightleaf Catering',
      });
      const unfiled = await customerService.create(test.ctx, {
        firstName: 'Ada',
        lastName: 'Silva',
        email: 'ada@example.test',
        propertyId: test.propertyId,
      });
      const filed = await customerService.create(test.ctx, {
        firstName: 'Ada',
        lastName: 'Silva',
        email: 'a.silva@example.test',
        propertyId: test.propertyId,
        companyId: company.id,
      });

      const result = await mergeService.merge(test.ctx, {
        primaryCustomerId: unfiled.id,
        duplicateCustomerIds: [filed.id],
      });

      expect(result.primary.companyId).toBe(company.id);
    });
  });

  describe('bulk merge', () => {
    it('refuses to sweep up anything below the confidence asked for', async () => {
      // Same surname and employer, nothing else — 60, which is every "worth a
      // look" pair and is exactly how two brothers at one firm look.
      await customerService.create(test.ctx, {
        firstName: 'Marcus',
        lastName: 'Lien',
        email: 'marcus@meridianarch.com',
        company: 'Meridian Architects',
        propertyId: test.propertyId,
      });
      await customerService.create(test.ctx, {
        firstName: 'Peter',
        lastName: 'Lien',
        email: 'peter@meridianarch.com',
        company: 'Meridian Architects',
        propertyId: test.propertyId,
      });

      const result = await mergeService.bulkMerge(test.ctx, {
        minConfidence: 100,
        propertyId: test.propertyId,
      });

      expect(result.merged).toBe(0);
    });
  });

  describe('saved views', () => {
    it('keeps a private view out of a colleague’s list', async () => {
      const mine = await savedViewService.create(test.ctx, {
        objectKey: 'contact',
        name: 'Leads I am working',
        filters: { lifecycleStage: 'lead' },
      });

      const colleague = { tenantId: test.tenant.tenantId, userId: crypto.randomUUID() };
      const theirs = await savedViewService.list(colleague, { objectKey: 'contact' });

      expect(theirs.map((view) => view.id)).not.toContain(mine.id);
    });

    it('shows a shared view to everyone on the team', async () => {
      const shared = await savedViewService.create(test.ctx, {
        objectKey: 'contact',
        name: 'Everything open',
        filters: {},
        isShared: true,
      });

      const colleague = { tenantId: test.tenant.tenantId, userId: crypto.randomUUID() };
      const theirs = await savedViewService.list(colleague, { objectKey: 'contact' });

      expect(theirs.map((view) => view.id)).toContain(shared.id);
    });
  });

  describe('booking links', () => {
    it('resolves a retired link rather than losing it', async () => {
      const service = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.tenant.tenantId}'`);
        return tx.schedulingService.create({
          data: {
            tenantId: test.tenant.tenantId,
            name: 'Discovery call',
            bookingType: 'appointment',
            durationMinutes: 30,
          },
        });
      });

      const link = await meetingLinkService.create(test.ctx, {
        name: 'Discovery call',
        slug: 'discovery-call',
        serviceId: service.id,
      });
      await meetingLinkService.archive(test.ctx, link.id);

      const resolved = await meetingLinkService.bySlug(test.ctx, 'discovery-call');

      // Deliberately NOT null. The address is in email signatures that cannot be
      // recalled, and "no longer in use" is something the reader can act on
      // where a not-found page is not.
      expect(resolved).not.toBeNull();
      expect(resolved?.active).toBe(false);
    });
  });
});
