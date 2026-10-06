// A trade account's statement, read from the bills already on it.
//
// The sparx B2B page promises a buyer that the purchase-order number they type
// at checkout "rides onto the invoice and every statement, so AP can reconcile
// without a phone call." The invoice half was built (issue 077); there was no
// statement anywhere. This is the read the statement is made from: the account,
// every bill issued to it, every payment against those bills, and the
// arithmetic in `b2b-statement.ts`.
//
// ── WHAT COUNTS AS A BILL ──────────────────────────────────────────────────
//
// `ISSUED_BILL_WHERE`, the same rule the buyer's invoice list and the receivables
// screens use. A quote or an estimate is a price nobody owes yet, a draft has not
// been sent, and a document moved to a void stage was never a bill, so none of
// them appear. A bill the shop WROTE OFF stays: it was on last month's statement,
// so this month's has to show it being taken off, or the two do not add up.
//
// ── WHICH ACCOUNT ──────────────────────────────────────────────────────────
//
// Bills whose `companyId` is the account, matching the buyer's invoice list, the
// aging report and the account's credit-used figure. Three screens that already
// agree about what this account owes; a fourth that counted differently would
// be the one nobody could reconcile.
//
// No schema change: everything a statement says is already in the rows.

import { poNumberOf } from '@wizeworks/crm-schemas';
import { withTenant, type Prisma } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import {
  computeStatement,
  paymentTermsWords,
  statementPeriod,
  type StatementBillInput,
  type StatementFigures,
} from './b2b-statement';
import { ISSUED_BILL_WHERE } from './billing-document-service';
import { partyFromJson } from './billing-render-parts';
import { businessTimeZone } from './business-clock';

export interface AccountStatementAccount {
  id: string;
  companyName: string;
  /** Printed under the name. Empty when nothing on record says where they are. */
  billingAddress: string[];
  /** As stored: `prepay`, `netN`, or null. */
  paymentTerms: string | null;
  /** The same, in words, or null when nothing was agreed. */
  paymentTermsWords: string | null;
  creditLimitCents: number;
  status: string;
}

export interface AccountStatement extends StatementFigures {
  account: AccountStatementAccount;
  period: { from: string; to: string };
  currency: string;
  generatedAt: string;
  /** The site that issued the account's most recent bill: whose name the
   *  statement email goes out under and whose address its link points at.
   *  Null when the account has never been billed. */
  issuerPropertyId: string | null;
}

export interface StatementRequest {
  accountId: string;
  /** `YYYY-MM-DD`; blank means the first of the month `to` falls in. */
  from?: string | null;
  /** `YYYY-MM-DD`; blank means today, on the business's calendar. */
  to?: string | null;
}

const BILL_SELECT = {
  id: true,
  number: true,
  currency: true,
  propertyId: true,
  createdAt: true,
  finalizedAt: true,
  dueAt: true,
  voidedAt: true,
  total: true,
  metadata: true,
  billTo: true,
  payments: {
    select: {
      id: true,
      kind: true,
      method: true,
      reference: true,
      amount: true,
      receivedAt: true,
    },
  },
} satisfies Prisma.BillingDocumentSelect;

type BillRow = Prisma.BillingDocumentGetPayload<{ select: typeof BILL_SELECT }>;

function cents(value: Prisma.Decimal | number): number {
  return Math.round(Number(value) * 100);
}

/** When the bill was issued: the day it was finalized, or the day it was made
 *  when it never went through a finalizing stage. */
function issuedAtOf(bill: Pick<BillRow, 'finalizedAt' | 'createdAt'>): Date {
  return bill.finalizedAt ?? bill.createdAt;
}

function toBillInput(bill: BillRow): StatementBillInput {
  return {
    id: bill.id,
    number: bill.number,
    poNumber: poNumberOf(bill.metadata),
    issuedAt: issuedAtOf(bill),
    dueAt: bill.dueAt,
    totalCents: cents(bill.total),
    voidedAt: bill.voidedAt,
    payments: bill.payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      method: p.method,
      reference: p.reference,
      amountCents: cents(p.amount),
      receivedAt: p.receivedAt,
    })),
  };
}

/** The address lines from a frozen bill-to, without the name (the statement
 *  prints the account's name itself) and without the email and phone, which
 *  are not part of where a letter goes. */
function addressFromBillTo(billTo: unknown): string[] {
  const party = partyFromJson(billTo, 'Bill to');
  if (!party) return [];
  return party.lines.filter((line) => !line.includes('@') && !/^\+?[\d\s().-]{7,}$/.test(line));
}

/**
 * Where the statement is addressed.
 *
 * The account record has no address of its own. The most faithful answer is the
 * address the shop most recently BILLED them at, frozen on that bill, because
 * that is the address their accounts department already has on file against
 * this supplier. When no bill carries one, the default billing address of the
 * account's main contact, then of anyone who orders for it.
 */
async function billingAddressOf(
  tx: Prisma.TransactionClient,
  accountId: string,
  bills: readonly BillRow[]
): Promise<string[]> {
  const newestFirst = [...bills].sort((a, b) => issuedAtOf(b).getTime() - issuedAtOf(a).getTime());
  for (const bill of newestFirst) {
    const lines = addressFromBillTo(bill.billTo);
    if (lines.length > 0) return lines;
  }

  const contacts = await tx.b2bAccountContact.findMany({
    where: { accountId, isActive: true, customer: { deletedAt: null } },
    select: {
      role: true,
      customer: {
        select: {
          addresses: {
            where: { type: { in: ['billing', 'both'] } },
            select: {
              isDefault: true,
              line1: true,
              line2: true,
              city: true,
              region: true,
              postalCode: true,
              country: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const ordered = [
    ...contacts.filter((c) => c.role === 'primary_contact'),
    ...contacts.filter((c) => c.role !== 'primary_contact'),
  ];
  for (const contact of ordered) {
    const addresses = [...contact.customer.addresses].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault)
    );
    const address = addresses[0];
    if (!address) continue;
    const party = partyFromJson(
      {
        line1: address.line1,
        line2: address.line2 ?? '',
        city: address.city,
        region: address.region ?? '',
        postalCode: address.postalCode ?? '',
        country: address.country,
      },
      'Bill to'
    );
    if (party && party.lines.length > 0) return party.lines;
  }
  return [];
}

/**
 * Build one account's statement for a period.
 *
 * Reads every bill issued to the account before the period ends, because the
 * opening balance is everything that happened before the first day, and an old
 * invoice paid this month is a row this month.
 */
export async function buildAccountStatement(
  ctx: ServiceContext,
  request: StatementRequest
): Promise<AccountStatement> {
  return withTenant(ctx, async (tx) => {
    const account = await tx.company.findFirst({
      where: { id: request.accountId, deletedAt: null },
      select: {
        id: true,
        companyName: true,
        paymentTerms: true,
        creditLimit: true,
        status: true,
      },
    });
    if (!account) throw new CrmNotFoundError('Company', request.accountId);

    const timeZone = await businessTimeZone(tx, ctx.tenantId);
    const now = new Date();
    const period = statementPeriod({ from: request.from, to: request.to }, now, timeZone);

    const rows = await tx.billingDocument.findMany({
      where: {
        companyId: account.id,
        deletedAt: null,
        ...ISSUED_BILL_WHERE,
        // Issued before the period ends. `finalizedAt` is never earlier than
        // `createdAt`, so this bounds the read and the exact cut is made on the
        // issue date in `computeStatement`.
        createdAt: { lt: period.endExclusive },
      },
      select: BILL_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    const figures = computeStatement(rows.map(toBillInput), period);
    const billingAddress = await billingAddressOf(tx, account.id, rows);
    const newest = [...rows].sort((a, b) => issuedAtOf(b).getTime() - issuedAtOf(a).getTime())[0];

    return {
      ...figures,
      account: {
        id: account.id,
        companyName: account.companyName,
        billingAddress,
        paymentTerms: account.paymentTerms,
        paymentTermsWords: paymentTermsWords(account.paymentTerms),
        creditLimitCents: cents(account.creditLimit),
        status: account.status,
      },
      period: { from: period.from, to: period.to },
      currency: newest?.currency ?? 'USD',
      generatedAt: now.toISOString(),
      issuerPropertyId: newest?.propertyId ?? null,
    };
  });
}

export interface StatementRecipient {
  email: string;
  name: string | null;
  /** Why this address: the account's main contact, the address its latest
   *  invoice went to, or (when neither exists) someone who orders for it. */
  reason: 'main_contact' | 'invoice_address' | 'contact';
}

function personName(c: { firstName: string | null; lastName: string | null }): string | null {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name === '' ? null : name;
}

/**
 * Who a statement is emailed to.
 *
 * The account's main contact, and the address its most recent invoice was sent
 * to, because that is usually the accounts-payable inbox and the statement is
 * for them. Only when neither exists does it fall back to everyone set up to
 * act for the account, so a statement is never sent to nobody when somebody is
 * there to receive it. Each address once, however many reasons it has.
 */
export async function statementRecipients(
  ctx: ServiceContext,
  accountId: string
): Promise<StatementRecipient[]> {
  return withTenant(ctx, async (tx) => {
    const [contacts, latest] = await Promise.all([
      tx.b2bAccountContact.findMany({
        where: { accountId, isActive: true, customer: { deletedAt: null } },
        select: {
          role: true,
          customer: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      tx.billingDocument.findFirst({
        where: { companyId: accountId, deletedAt: null, ...ISSUED_BILL_WHERE },
        select: { billTo: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const out: StatementRecipient[] = [];
    const seen = new Set<string>();
    const add = (
      email: string | null | undefined,
      name: string | null,
      reason: StatementRecipient['reason']
    ) => {
      const trimmed = email?.trim() ?? '';
      if (trimmed === '' || !trimmed.includes('@')) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ email: trimmed, name, reason });
    };

    for (const c of contacts) {
      if (c.role === 'primary_contact')
        add(c.customer.email, personName(c.customer), 'main_contact');
    }
    const billTo = (latest?.billTo ?? null) as { email?: unknown; name?: unknown } | null;
    if (billTo && typeof billTo.email === 'string') {
      add(billTo.email, typeof billTo.name === 'string' ? billTo.name : null, 'invoice_address');
    }
    if (out.length === 0) {
      for (const c of contacts) add(c.customer.email, personName(c.customer), 'contact');
    }
    return out;
  });
}
