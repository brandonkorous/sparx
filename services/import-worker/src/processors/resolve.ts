// Resolvers — turning a name in a spreadsheet into an id in the database.
//
// This is where most of the real work of a migration lives, and it is the part every
// generic CSV importer skips. A Shopify inventory file says the stock is at "Main
// Warehouse"; a HubSpot deal says it belongs to "Acme Diesel"; a WordPress post says
// its author is "sam". None of those are ids, and a tenant should never be asked to
// go and find one.
//
// Two rules hold throughout:
//
//   Resolution is CACHED per run. A 9,000-row inventory file names the same three
//   warehouses 3,000 times each, and looking each one up is 8,997 wasted queries.
//
//   Creating-on-demand is explicit and reported. A warehouse invented because a file
//   mentioned it is a real thing that appears in the tenant's UI forever, so the row
//   result says so rather than letting it appear silently.

import { prisma, withTenant } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';
import type { ProcessorContext } from './types';

/** Per-run memo. Built fresh for each job so a rename between runs is picked up. */
export class Resolver {
  private readonly warehouses = new Map<string, string>();
  private readonly variants = new Map<string, { id: string; productId: string } | null>();
  private readonly customers = new Map<string, string | null>();
  private readonly companies = new Map<string, string | null>();
  private readonly users = new Map<string, string | null>();
  private readonly categories = new Map<string, string | null>();

  /** Names of things this run had to invent, for the run summary. */
  readonly created: { kind: string; name: string }[] = [];

  constructor(private readonly ctx: ProcessorContext) {}

  private key(value: string): string {
    return value.trim().toLowerCase();
  }

  /** A variant by SKU. The natural key of every commerce and inventory import. */
  async variantBySku(sku: string): Promise<{ id: string; productId: string } | null> {
    const key = this.key(sku);
    if (key === '') return null;
    const cached = this.variants.get(key);
    if (cached !== undefined) return cached;

    const found = await withTenant(this.ctx, (tx) =>
      tx.productVariant.findFirst({
        where: { tenantId: this.ctx.tenantId, sku, deletedAt: null },
        select: { id: true, productId: true },
      })
    );
    const value = found ?? null;
    this.variants.set(key, value);
    return value;
  }

  /** Remember a variant we have just created, so later rows in the same file that
   *  reference it do not miss and create a duplicate. */
  rememberVariant(sku: string, variant: { id: string; productId: string }): void {
    this.variants.set(this.key(sku), variant);
  }

  /**
   * A warehouse by the name the old platform used, creating it if it is new.
   *
   * This is the single most important resolver in the package. Stock is meaningless
   * without a location, every commerce platform names locations differently, and the
   * alternative — asking the tenant to pre-create warehouses whose names must match
   * their export exactly — is the step at which an inventory migration gets abandoned.
   */
  async warehouseByName(name: string): Promise<{ id: string; created: boolean }> {
    const wanted = name.trim() === '' ? 'Main' : name.trim();
    const key = this.key(wanted);
    const cached = this.warehouses.get(key);
    if (cached !== undefined) return { id: cached, created: false };

    const existing = await withTenant(this.ctx, (tx) =>
      tx.warehouse.findFirst({
        where: {
          tenantId: this.ctx.tenantId,
          deletedAt: null,
          OR: [
            { name: { equals: wanted, mode: 'insensitive' } },
            { code: { equals: codeFor(wanted), mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      })
    );
    if (existing) {
      this.warehouses.set(key, existing.id);
      return { id: existing.id, created: false };
    }

    const created = await inventoryService.createWarehouse(this.ctx, {
      name: wanted.slice(0, 127),
      code: await this.freeWarehouseCode(wanted),
      type: 'owned',
      // A location imported from a stock file has no address in that file — every
      // platform keeps addresses somewhere else entirely. `country` is required, so
      // the row is created as a placeholder the tenant completes later rather than
      // being rejected for lacking a street the export never had.
      address: { line1: '—', city: '—', country: 'US' },
      defaultForChannel: [],
      isActive: true,
    });
    this.warehouses.set(key, created.id);
    this.created.push({ kind: 'location', name: wanted });
    return { id: created.id, created: true };
  }

  /** Warehouse codes are unique and capped at 15 characters, so a collision has to
   *  be resolved rather than thrown at the tenant mid-import. */
  private async freeWarehouseCode(name: string): Promise<string> {
    const base = codeFor(name);
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? base : `${base.slice(0, 12)}-${attempt + 1}`;
      const taken = await withTenant(this.ctx, (tx) =>
        tx.warehouse.findFirst({
          where: { tenantId: this.ctx.tenantId, code: candidate },
          select: { id: true },
        })
      );
      if (!taken) return candidate;
    }
    return `LOC-${Date.now().toString(36).toUpperCase().slice(-10)}`;
  }

  /** A customer by email. */
  async customerByEmail(email: string): Promise<string | null> {
    const key = this.key(email);
    if (key === '') return null;
    const cached = this.customers.get(key);
    if (cached !== undefined) return cached;
    const found = await withTenant(this.ctx, (tx) =>
      tx.customer.findFirst({
        where: { tenantId: this.ctx.tenantId, email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })
    );
    const value = found?.id ?? null;
    this.customers.set(key, value);
    return value;
  }

  rememberCustomer(email: string, id: string): void {
    this.customers.set(this.key(email), id);
  }

  /** A company by name. */
  async companyByName(name: string): Promise<string | null> {
    const key = this.key(name);
    if (key === '') return null;
    const cached = this.companies.get(key);
    if (cached !== undefined) return cached;
    const found = await withTenant(this.ctx, (tx) =>
      tx.company.findFirst({
        where: { tenantId: this.ctx.tenantId, companyName: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })
    );
    const value = found?.id ?? null;
    this.companies.set(key, value);
    return value;
  }

  rememberCompany(name: string, id: string): void {
    this.companies.set(this.key(name), id);
  }

  /**
   * A team member by email — the "owner" column every CRM export carries.
   *
   * Never creates one. An imported deal owned by someone who does not have an account
   * here yet lands unassigned, which is visible and fixable; inviting people into a
   * tenant as a side effect of a file upload is not something an import gets to do.
   */
  async userByEmail(email: string): Promise<string | null> {
    const key = this.key(email);
    if (key === '') return null;
    const cached = this.users.get(key);
    if (cached !== undefined) return cached;
    const found = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    const value = found?.id ?? null;
    this.users.set(key, value);
    return value;
  }

  /** A product category by name, within this tenant. */
  async categoryByName(name: string): Promise<string | null> {
    const key = this.key(name);
    if (key === '') return null;
    const cached = this.categories.get(key);
    if (cached !== undefined) return cached;
    const found = await withTenant(this.ctx, (tx) =>
      tx.productCategory.findFirst({
        where: { tenantId: this.ctx.tenantId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })
    );
    const value = found?.id ?? null;
    this.categories.set(key, value);
    return value;
  }

  rememberCategory(name: string, id: string): void {
    this.categories.set(this.key(name), id);
  }
}

/** `Main Warehouse` → `MAIN-WAREHOU`. Uppercase, 15 chars, `[A-Z0-9_-]` only —
 *  the shape `CreateWarehouseInput` requires. */
export function codeFor(name: string): string {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned === '' ? 'LOC' : cleaned).slice(0, 15).replace(/-+$/, '');
}
