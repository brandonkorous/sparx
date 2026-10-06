// A trade account's fleet: the vehicles a business runs, kept on the account so
// the shop can show its buyers which parts fit them (sparx persona issue 086).
//
// Stored as a JSON array on the account (`companies.engine_profiles`). Each
// vehicle is a name or unit number, a year, the entry it was picked from in the
// shop's own fitment list (Make, Model, Engine), an optional VIN and notes.
// Picking from the list is what makes parts match: a product's fitment rows name
// a list entry plus a window per range (a year span), and a vehicle fits when
// its entry sits under the row's entry and its year falls inside the window.
//
// Every vehicle carries a STABLE `id`. Service bookings and history are linked
// to it, so an edit keeps it, and an older entry saved before ids existed gets
// one worked out from what it holds until the next save writes it down.
//
// The words a vehicle is called by (`vehicleLabel`) live in
// @wizeworks/commerce-schemas, which every app can read; this file is the half
// that needs the database.

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withTenant, type Prisma } from '@wizeworks/db';
import { notFound, validationError } from '@wizeworks/api-core/errors';

// ── Schemas ──────────────────────────────────────────────────────────────────

/** Blank and null both mean "not given", so a cleared form field clears it. */
function blankToUndefined(v: unknown): unknown {
  if (v === null) return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  return v;
}

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const THIS_YEAR = new Date().getFullYear();

// A fleet vehicle entry. A vehicle names what it is in the shop's fitment list
// (`domainId` + `nodeId`, the deepest entry picked) plus a number per range axis
// (`rangeValues`, filled from `year` when the list has a Year range). `make` and
// `model` are typed by hand only for a vehicle the list does not hold.
export const FleetVehicleEntry = z.object({
  id: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  label: z.string().trim().min(1, 'Give the vehicle a name or unit number.').max(127),
  year: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1900, 'Enter the model year, like 2019.')
      .max(THIS_YEAR + 2, 'Enter the model year, like 2019.')
      .optional()
  ),
  make: optionalText(60),
  model: optionalText(60),
  vin: z.preprocess(
    (v) => {
      const b = blankToUndefined(v);
      return typeof b === 'string' ? b.trim().toUpperCase() : b;
    },
    z
      .string()
      .regex(
        /^[A-HJ-NPR-Z0-9]{17}$/,
        'A VIN is 17 letters and numbers, and never uses the letters I, O or Q.'
      )
      .optional()
  ),
  domainId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  nodeId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  rangeValues: z
    .array(z.object({ dimensionKey: z.string().min(1), value: z.number() }))
    .max(16)
    .optional(),
  mileage: z.preprocess(blankToUndefined, z.coerce.number().int().nonnegative().optional()),
  notes: optionalText(2000),
  count: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).default(1)),
});

export const FleetVehiclesBody = z.object({
  vehicles: z.array(FleetVehicleEntry).max(100),
  fleetSize: z.number().int().min(0).optional(),
});

export const CompatibleProductsQuery = z.object({
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export type FleetVehicleInput = z.infer<typeof FleetVehicleEntry>;
export type FleetVehiclesInput = z.infer<typeof FleetVehiclesBody>;

// ── Stored shape + reading it ────────────────────────────────────────────────

/** One vehicle as it sits in `engine_profiles`. Older rows may lack `id` and the
 *  newer fields. */
export interface StoredFleetVehicle {
  id?: string;
  label?: string;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  domainId?: string | null;
  nodeId?: string | null;
  rangeValues?: { dimensionKey: string; value: number }[];
  mileage?: number;
  notes?: string;
  count?: number;
}

/** A stored vehicle once it is known to have an id. */
export type IdentifiedFleetVehicle = StoredFleetVehicle & { id: string };

/**
 * The id an older vehicle, saved before vehicles had ids, is known by until the
 * next save writes one down. Worked out from the account, its place in the list
 * and what it holds, so every read of the same row gives the same id: a booking
 * made against it the moment after it was read still finds it.
 */
export function legacyVehicleId(accountId: string, index: number, v: StoredFleetVehicle): string {
  const hex = createHash('sha256')
    .update(
      JSON.stringify([
        accountId,
        index,
        v.label ?? '',
        v.vin ?? '',
        v.domainId ?? '',
        v.nodeId ?? '',
      ])
    )
    .digest('hex');
  // Shaped like a uuid (version 5, RFC variant) so it validates wherever an id is
  // checked as one.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

/** The account's stored fleet, every vehicle with an id. */
export function readFleet(accountId: string, value: unknown): IdentifiedFleetVehicle[] {
  if (!Array.isArray(value)) return [];
  return (value as StoredFleetVehicle[])
    .filter((v): v is StoredFleetVehicle => Boolean(v) && typeof v === 'object')
    .map((v, i) => ({ ...v, id: v.id ?? legacyVehicleId(accountId, i, v) }));
}

// ── The view every reader gets ───────────────────────────────────────────────

interface StoredDimension {
  key: string;
  label: string;
  kind: 'level' | 'range';
  unit?: string;
}

/** A fleet vehicle ready to show. Structurally the `FleetVehicle` of
 *  @wizeworks/commerce-schemas (which this package cannot import), plus what the
 *  console prints beside it: the fitment list's name and the range values. */
export interface FleetVehicleView {
  id: string;
  label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  notes: string | null;
  mileage: number | null;
  count: number;
  domainId: string | null;
  nodeId: string | null;
  nodePath: string[];
  /** The ids along `nodePath`, top first, so a form can show the picked entry. */
  nodeIdPath: string[];
  domainName: string | null;
  nodeName: string | null;
  ranges: { dimensionKey: string; label: string; unit: string | null; value: number }[];
}

/** Enrich stored fleet vehicles with display data (domain name, node path, and a
 *  labelled range list) by reading the referenced domains' `dimensions` and the
 *  referenced nodes' names. Generic over any domain's dimensions. */
export async function resolveFleetVehicles(
  ctx: { tenantId: string },
  vehicles: IdentifiedFleetVehicle[]
): Promise<FleetVehicleView[]> {
  const domainIds = [...new Set(vehicles.map((v) => v.domainId).filter(Boolean) as string[])];
  const nodeIds = [...new Set(vehicles.map((v) => v.nodeId).filter(Boolean) as string[])];

  const [domains, nodes] = await withTenant(ctx, (tx) =>
    Promise.all([
      domainIds.length > 0
        ? tx.fitmentDomain.findMany({
            where: { id: { in: domainIds }, deletedAt: null },
            select: { id: true, displayName: true, dimensions: true },
          })
        : Promise.resolve([]),
      nodeIds.length > 0
        ? tx.fitmentNode.findMany({
            where: { id: { in: nodeIds }, deletedAt: null },
            select: { id: true, name: true, pathNames: true, path: true },
          })
        : Promise.resolve([]),
    ])
  );

  const domainById = new Map(domains.map((d) => [d.id, d]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return vehicles.map((v) => {
    const domain = v.domainId ? domainById.get(v.domainId) : undefined;
    const dims: StoredDimension[] = Array.isArray(domain?.dimensions)
      ? (domain.dimensions as unknown as StoredDimension[])
      : [];
    const dimByKey = new Map(dims.map((d) => [d.key, d]));
    const node = v.nodeId ? nodeById.get(v.nodeId) : undefined;
    return {
      id: v.id,
      label: v.label ?? '',
      year: v.year ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      vin: v.vin ?? null,
      notes: v.notes ?? null,
      mileage: v.mileage ?? null,
      count: v.count ?? 1,
      domainId: v.domainId ?? null,
      nodeId: v.nodeId ?? null,
      nodePath: node?.pathNames ?? [],
      nodeIdPath: node?.path ?? [],
      domainName: domain?.displayName ?? null,
      nodeName: node?.name ?? null,
      ranges: (v.rangeValues ?? []).map((rv) => {
        const dim = dimByKey.get(rv.dimensionKey);
        return {
          dimensionKey: rv.dimensionKey,
          label: dim?.label ?? rv.dimensionKey,
          unit: dim?.unit ?? null,
          value: rv.value,
        };
      }),
    };
  });
}

async function loadAccountFleet(
  ctx: { tenantId: string },
  accountId: string
): Promise<{ vehicles: IdentifiedFleetVehicle[]; fleetSize: number | null }> {
  const account = await withTenant(ctx, (tx) =>
    tx.company.findFirst({
      where: { id: accountId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, engineProfiles: true, fleetSize: true },
    })
  );
  if (!account) throw notFound('b2b account');
  return { vehicles: readFleet(account.id, account.engineProfiles), fleetSize: account.fleetSize };
}

/** The account's fleet, ready to show. */
export async function getAccountFleet(
  ctx: { tenantId: string },
  accountId: string
): Promise<FleetVehicleView[]> {
  const { vehicles } = await loadAccountFleet(ctx, accountId);
  return resolveFleetVehicles(ctx, vehicles);
}

/** One vehicle on the account, or null when the account has no vehicle by that
 *  id. For linking a service booking to a vehicle. */
export async function findFleetVehicle(
  ctx: { tenantId: string },
  accountId: string,
  vehicleId: string
): Promise<FleetVehicleView | null> {
  const fleet = await getAccountFleet(ctx, accountId);
  return fleet.find((v) => v.id === vehicleId) ?? null;
}

// ── Writing it ───────────────────────────────────────────────────────────────

/** True for a range dimension that holds a model year. */
function isYearDimension(d: StoredDimension): boolean {
  return d.kind === 'range' && (d.key.toLowerCase() === 'year' || /^years?$/i.test(d.label.trim()));
}

/**
 * Turn validated input into what is stored, keeping every id: an entry that came
 * back with its id keeps it, a new one gets a fresh one, and the same id twice is
 * refused rather than letting one vehicle's bookings follow another.
 */
export function toStoredFleet(
  input: FleetVehicleInput[],
  yearKeyByDomain: Map<string, string>,
  mintId: () => string = randomUUID
): IdentifiedFleetVehicle[] {
  const seen = new Set<string>();
  return input.map((v) => {
    const id = v.id ?? mintId();
    if (seen.has(id)) throw validationError('Two vehicles in this fleet have the same id.');
    seen.add(id);

    // The year is what parts match on, through the list's Year range.
    const yearKey = v.domainId ? yearKeyByDomain.get(v.domainId) : undefined;
    let rangeValues = v.rangeValues ?? [];
    if (yearKey) {
      rangeValues = rangeValues.filter((rv) => rv.dimensionKey !== yearKey);
      if (v.year !== undefined) rangeValues.push({ dimensionKey: yearKey, value: v.year });
    }

    const stored: IdentifiedFleetVehicle = { id, label: v.label, count: v.count };
    if (v.year !== undefined) stored.year = v.year;
    if (v.make !== undefined) stored.make = v.make;
    if (v.model !== undefined) stored.model = v.model;
    if (v.vin !== undefined) stored.vin = v.vin;
    if (v.domainId !== undefined) stored.domainId = v.domainId;
    if (v.nodeId !== undefined) stored.nodeId = v.nodeId;
    if (rangeValues.length > 0) stored.rangeValues = rangeValues;
    if (v.mileage !== undefined) stored.mileage = v.mileage;
    if (v.notes !== undefined) stored.notes = v.notes;
    return stored;
  });
}

/** Validate every picked list entry against this tenant's fitment list, fill in a
 *  missing list from the entry, and store the fleet. */
async function writeFleet(
  ctx: { tenantId: string },
  accountId: string,
  input: FleetVehicleInput[],
  fleetSize?: number
): Promise<{ id: string; fleetSize: number | null; fleetVehicles: FleetVehicleView[] }> {
  const nodeIds = [...new Set(input.map((v) => v.nodeId).filter(Boolean) as string[])];
  const nodes =
    nodeIds.length > 0
      ? await withTenant(ctx, (tx) =>
          tx.fitmentNode.findMany({
            where: { id: { in: nodeIds }, deletedAt: null },
            select: { id: true, domainId: true },
          })
        )
      : [];
  const nodeDomain = new Map(nodes.map((n) => [n.id, n.domainId]));

  // An entry picked without its list: the entry says which list it is in.
  const withDomains = input.map((v) => {
    if (!v.nodeId) return v;
    const domainId = nodeDomain.get(v.nodeId);
    if (!domainId) throw notFound('fitment node');
    if (v.domainId && v.domainId !== domainId) throw notFound('fitment node');
    return { ...v, domainId };
  });

  const domainIds = [...new Set(withDomains.map((v) => v.domainId).filter(Boolean) as string[])];
  const domains =
    domainIds.length > 0
      ? await withTenant(ctx, (tx) =>
          tx.fitmentDomain.findMany({
            where: { id: { in: domainIds }, deletedAt: null },
            select: { id: true, dimensions: true },
          })
        )
      : [];
  const known = new Set(domains.map((d) => d.id));
  for (const id of domainIds) if (!known.has(id)) throw notFound('fitment domain');

  const yearKeyByDomain = new Map<string, string>();
  for (const d of domains) {
    const dims = Array.isArray(d.dimensions) ? (d.dimensions as unknown as StoredDimension[]) : [];
    const yearDim = dims.find(isYearDimension);
    if (yearDim) yearKeyByDomain.set(d.id, yearDim.key);
  }

  const stored = toStoredFleet(withDomains, yearKeyByDomain);

  const updated = await withTenant(ctx, (tx) =>
    tx.company.update({
      where: { id: accountId },
      data: {
        engineProfiles: stored as unknown as Prisma.InputJsonValue,
        ...(fleetSize !== undefined ? { fleetSize } : {}),
        updatedAt: new Date(),
      },
      select: { id: true, engineProfiles: true, fleetSize: true },
    })
  );

  const fleetVehicles = await resolveFleetVehicles(
    ctx,
    readFleet(updated.id, updated.engineProfiles)
  );
  return { id: updated.id, fleetSize: updated.fleetSize, fleetVehicles };
}

/** Replace the account's fleet. Each picked list entry is validated to belong to
 *  this tenant. Ids sent back are kept; entries without one get a new one. */
export async function setFleet(ctx: { tenantId: string }, accountId: string, rawInput: unknown) {
  const body = FleetVehiclesBody.parse(rawInput);
  await loadAccountFleet(ctx, accountId);
  return writeFleet(ctx, accountId, body.vehicles, body.fleetSize);
}

/** Add one vehicle to the fleet, leaving the others exactly as stored. */
export async function addFleetVehicle(
  ctx: { tenantId: string },
  accountId: string,
  rawInput: unknown
) {
  const vehicle = FleetVehicleEntry.omit({ id: true }).parse(rawInput);
  const { vehicles } = await loadAccountFleet(ctx, accountId);
  if (vehicles.length >= 100) throw validationError('A fleet can hold up to 100 vehicles.');
  const result = await writeFleet(ctx, accountId, [...asInput(vehicles), vehicle]);
  return { ...result, vehicle: result.fleetVehicles[result.fleetVehicles.length - 1]! };
}

/** Change one vehicle. Its id stays the same, so its service history stays with it. */
export async function updateFleetVehicle(
  ctx: { tenantId: string },
  accountId: string,
  vehicleId: string,
  rawInput: unknown
) {
  const patch = FleetVehicleEntry.omit({ id: true }).parse(rawInput);
  const { vehicles } = await loadAccountFleet(ctx, accountId);
  const at = vehicles.findIndex((v) => v.id === vehicleId);
  if (at < 0) throw notFound('vehicle');
  const next = asInput(vehicles);
  // The whole form is sent, so a field left blank is cleared. The range values a
  // form does not show (anything other than the year) are kept.
  next[at] = { ...patch, id: vehicleId, rangeValues: vehicles[at]!.rangeValues };
  const result = await writeFleet(ctx, accountId, next);
  return { ...result, vehicle: result.fleetVehicles[at]! };
}

/** Take one vehicle off the fleet. */
export async function removeFleetVehicle(
  ctx: { tenantId: string },
  accountId: string,
  vehicleId: string
) {
  const { vehicles } = await loadAccountFleet(ctx, accountId);
  if (!vehicles.some((v) => v.id === vehicleId)) throw notFound('vehicle');
  return writeFleet(ctx, accountId, asInput(vehicles.filter((v) => v.id !== vehicleId)));
}

/** Stored vehicles back into input form, ids and all, for a rewrite. */
function asInput(vehicles: IdentifiedFleetVehicle[]): FleetVehicleInput[] {
  return vehicles.map((v) => ({
    id: v.id,
    label: v.label && v.label.trim() !== '' ? v.label.trim() : 'Vehicle',
    year: v.year,
    make: v.make,
    model: v.model,
    vin: v.vin,
    domainId: v.domainId ?? undefined,
    nodeId: v.nodeId ?? undefined,
    rangeValues: v.rangeValues,
    mileage: v.mileage,
    notes: v.notes,
    count: v.count ?? 1,
  }));
}

// ── Which parts fit ──────────────────────────────────────────────────────────

/** One product fitment row, as the matcher reads it. */
export interface FitRule {
  productId: string;
  domainId: string;
  nodeId: string | null;
  ranges: { dimensionKey: string; min: number | null; max: number | null }[];
}

/**
 * Does this vehicle fit this fitment row? Same rule as the catalog's own
 * fitment lookup: the row's list entry is the vehicle's entry or one above it (a
 * row on "Ram" fits every Ram), a row with no entry fits the whole list, and for
 * every range the vehicle has a number for, a row that limits that range must
 * include it. `ancestry` is the vehicle's entry and everything above it.
 */
export function vehicleFitsRule(
  vehicle: StoredFleetVehicle,
  ancestry: readonly string[] | undefined,
  rule: Omit<FitRule, 'productId'>
): boolean {
  if (!vehicle.domainId || rule.domainId !== vehicle.domainId) return false;
  if (rule.nodeId && vehicle.nodeId) {
    const above = ancestry && ancestry.length > 0 ? ancestry : [vehicle.nodeId];
    if (!above.includes(rule.nodeId)) return false;
  }
  for (const rv of vehicle.rangeValues ?? []) {
    const windows = rule.ranges.filter((r) => r.dimensionKey === rv.dimensionKey);
    if (windows.length === 0) continue;
    const inside = windows.some(
      (w) => (w.min === null || w.min <= rv.value) && (w.max === null || w.max >= rv.value)
    );
    if (!inside) return false;
  }
  return true;
}

/**
 * For each product, which of the fleet's vehicles it fits. A product appears
 * ONLY when it has fitment rows for a kind of vehicle the fleet holds: a product
 * with no fitment data is absent, never "fits none" (no data is not a no). A
 * product that appears with an empty list does not fit any of the vehicles.
 */
export function fitByProduct(
  vehicles: IdentifiedFleetVehicle[],
  ancestryByNodeId: ReadonlyMap<string, readonly string[]>,
  rules: FitRule[]
): Map<string, string[]> {
  const fleetDomains = new Set(vehicles.map((v) => v.domainId).filter(Boolean) as string[]);
  const out = new Map<string, string[]>();
  for (const rule of rules) {
    if (!fleetDomains.has(rule.domainId)) continue;
    const fitting = out.get(rule.productId) ?? [];
    out.set(rule.productId, fitting);
    for (const v of vehicles) {
      if (fitting.includes(v.id)) continue;
      const ancestry = v.nodeId ? ancestryByNodeId.get(v.nodeId) : undefined;
      if (vehicleFitsRule(v, ancestry, rule)) fitting.push(v.id);
    }
  }
  return out;
}

/** The fleet with the list ancestry of each picked entry, or null when no
 *  vehicle was picked from a fitment list (nothing can be matched). */
async function matchableFleet(
  ctx: { tenantId: string },
  accountId: string
): Promise<{
  vehicles: IdentifiedFleetVehicle[];
  ancestry: Map<string, string[]>;
} | null> {
  const { vehicles } = await loadAccountFleet(ctx, accountId);
  const matchable = vehicles.filter((v) => v.domainId);
  if (matchable.length === 0) return null;
  const nodeIds = [...new Set(matchable.map((v) => v.nodeId).filter(Boolean) as string[])];
  const nodes =
    nodeIds.length > 0
      ? await withTenant(ctx, (tx) =>
          tx.fitmentNode.findMany({
            where: { id: { in: nodeIds }, deletedAt: null },
            select: { id: true, path: true },
          })
        )
      : [];
  return { vehicles: matchable, ancestry: new Map(nodes.map((n) => [n.id, n.path])) };
}

function toRule(row: {
  productId: string;
  domainId: string;
  nodeId: string | null;
  ranges: { dimensionKey: string; min: unknown; max: unknown }[];
}): FitRule {
  return {
    productId: row.productId,
    domainId: row.domainId,
    nodeId: row.nodeId,
    ranges: row.ranges.map((r) => ({
      dimensionKey: r.dimensionKey,
      min: r.min === null || r.min === undefined ? null : Number(r.min),
      max: r.max === null || r.max === undefined ? null : Number(r.max),
    })),
  };
}

const RULE_SELECT = {
  productId: true,
  domainId: true,
  nodeId: true,
  ranges: { select: { dimensionKey: true, min: true, max: true } },
} as const;

/** What one signed-in trade buyer needs to see about a page of products. */
export interface FleetFitResult {
  vehicles: FleetVehicleView[];
  /** productId → the ids of the vehicles it fits. Absent = no fitment data for
   *  this kind of vehicle, so nothing should be said. */
  fits: Map<string, string[]>;
}

/** Which of the account's vehicles each of these products fits. Null when the
 *  account has no vehicle picked from a fitment list. */
export async function fleetFitForProducts(
  ctx: { tenantId: string },
  accountId: string,
  productIds: string[]
): Promise<FleetFitResult | null> {
  const fleet = await matchableFleet(ctx, accountId);
  if (!fleet) return null;
  const domainIds = [...new Set(fleet.vehicles.map((v) => v.domainId!))];
  const rows =
    productIds.length > 0
      ? await withTenant(ctx, (tx) =>
          tx.productFitment.findMany({
            where: { productId: { in: productIds }, domainId: { in: domainIds } },
            select: RULE_SELECT,
          })
        )
      : [];
  const fits = fitByProduct(fleet.vehicles, fleet.ancestry, rows.map(toRule));
  return { vehicles: await resolveFleetVehicles(ctx, fleet.vehicles), fits };
}

/**
 * Every product that fits at least one of the account's vehicles (or the one
 * named), for putting fitted parts first and for "parts that fit Unit 12". The
 * database narrows to rows that could fit; the matcher above decides, so this
 * and the per-product answer can never disagree. Null when nothing in the fleet
 * can be matched.
 */
export async function fleetFittedProductIds(
  ctx: { tenantId: string },
  accountId: string,
  opts: { vehicleId?: string } = {}
): Promise<string[] | null> {
  const fleet = await matchableFleet(ctx, accountId);
  if (!fleet) return null;
  let vehicles = fleet.vehicles;
  if (opts.vehicleId) {
    vehicles = vehicles.filter((v) => v.id === opts.vehicleId);
    if (vehicles.length === 0) return [];
  }

  const clauses = vehicles.map((v) => {
    const above = v.nodeId ? (fleet.ancestry.get(v.nodeId) ?? [v.nodeId]) : null;
    return {
      domainId: v.domainId!,
      ...(above ? { OR: [{ nodeId: { in: above } }, { nodeId: null }] } : {}),
    };
  });
  const rows = await withTenant(ctx, (tx) =>
    tx.productFitment.findMany({
      where: { OR: clauses, product: { deletedAt: null } },
      select: RULE_SELECT,
    })
  );
  const fits = fitByProduct(vehicles, fleet.ancestry, rows.map(toRule));
  return [...fits].filter(([, ids]) => ids.length > 0).map(([productId]) => productId);
}

/** Catalog filtered to what the account's fleet fits (the console's
 *  compatible-products read). */
export async function listCompatibleProducts(
  ctx: { tenantId: string },
  id: string,
  input: z.infer<typeof CompatibleProductsQuery>
) {
  const productIds = (await fleetFittedProductIds(ctx, id)) ?? [];
  if (productIds.length === 0) return { data: [], meta: { total: 0 } };

  const [products, total] = await withTenant(ctx, (tx) =>
    Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds }, tenantId: ctx.tenantId, deletedAt: null },
        include: {
          variants: {
            where: { deletedAt: null },
            select: { id: true, sku: true, priceCents: true, title: true },
            take: 1,
          },
        },
        orderBy: { title: 'asc' },
        take: input.take,
        skip: input.skip,
      }),
      tx.product.count({
        where: { id: { in: productIds }, tenantId: ctx.tenantId, deletedAt: null },
      }),
    ])
  );

  return { data: products, meta: { total, take: input.take, skip: input.skip } };
}
