// Per-test fixtures for @sparx/inventory integration tests.
//
// Every test gets a fresh tenant; ON DELETE CASCADE on tenant_id tears the whole
// graph down via one tenant delete. `createInventoryFixture` provisions the
// minimum the ledger needs to move stock: a product → variant → warehouse.
// Mirrors packages/crm/test/helpers.ts so the two surfaces stay predictable.

import crypto from 'node:crypto';

import { prisma, withTenant } from '@sparx/db';

export interface TestTenant {
  tenantId: string;
  userId: string;
}

/** A tenant + staff user, with commerce + inventory enabled in settings. */
export async function createTestTenant(): Promise<TestTenant> {
  const slug = `inv-test-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Inventory Test ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: { modules: { commerce: { enabled: true }, inventory: { enabled: true } } },
    },
  });

  // users has FORCE RLS — write through a tenant-scoped transaction.
  const user = await withTenant({ tenantId: tenant.id }, (tx) =>
    tx.user.create({ data: { tenantId: tenant.id, email, name: `Test ${slug}`, role: 'owner' } })
  );

  return { tenantId: tenant.id, userId: user.id };
}

export async function dropTestTenant(tenantId: string): Promise<void> {
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export interface InventoryFixture {
  productId: string;
  variantId: string;
  warehouseId: string;
  /** The generated SKU and location code. Exposed because the import tests
   *  build a CSV a person would upload, and a file that names ids rather than
   *  codes is not the file anybody has. */
  sku: string;
  warehouseCode: string;
}

/** Create a product + one variant + an active warehouse the ledger can move
 *  stock between. A fresh fixture per test keeps the (variant, warehouse) level
 *  isolated, so movement sums assert cleanly. */
export async function createInventoryFixture(tenantId: string): Promise<InventoryFixture> {
  return withTenant({ tenantId }, async (tx) => {
    const warehouse = await tx.warehouse.create({
      data: {
        tenantId,
        name: 'Test Warehouse',
        code: `WH-${crypto.randomBytes(3).toString('hex')}`,
      },
    });
    const product = await tx.product.create({
      data: {
        tenantId,
        title: 'Test Part',
        handle: `test-part-${crypto.randomBytes(3).toString('hex')}`,
        status: 'active',
      },
    });
    const variant = await tx.productVariant.create({
      data: {
        tenantId,
        productId: product.id,
        sku: `SKU-${crypto.randomBytes(3).toString('hex')}`,
        priceCents: 1000,
        costCents: 500,
        currency: 'USD',
        isDefault: true,
      },
    });
    return {
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      sku: variant.sku,
      warehouseCode: warehouse.code,
    };
  });
}
