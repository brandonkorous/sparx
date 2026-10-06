// The trade portal's fleet, from the browser (sparx persona issue 086).
//
// Same-origin through the /api/sparx proxy, so the session cookie travels and
// the API decides whose fleet this is. The account id in the path is checked
// there against the signed-in contact's own accounts.

import type { FleetVehicle } from '@wizeworks/commerce-schemas';

const API_BASE = '/api/sparx';

/** One vehicle on the portal's fleet page. */
export interface PortalFleetVehicle extends FleetVehicle {
  /** "Unit 12, 2019 Ram 3500 6.7L Cummins". */
  displayName: string;
  /** The ids along `nodePath`, top first. */
  nodeIdPath: string[];
  domainName: string | null;
}

export interface PortalFleet {
  vehicles: PortalFleetVehicle[];
  /** Only the account's primary contact may change the fleet. */
  canEdit: boolean;
}

/** What the vehicle form sends. Blank fields clear. */
export interface FleetVehicleForm {
  label: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  notes: string;
  domainId: string;
  nodeId: string;
}

export class FleetError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FleetError';
    this.status = status;
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

/** The first field problem a validation error names, in the API's own words. */
function firstIssue(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  const first = details[0] as { message?: unknown } | undefined;
  return typeof first?.message === 'string' ? first.message : null;
}

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.success === false) {
    const message =
      firstIssue(json?.error?.details) ??
      json?.error?.message ??
      'That did not save. Please try again.';
    throw new FleetError(message, res.status);
  }
  return json.data as T;
}

function fleetUrl(accountId: string, path: string, tenantSlug: string): string {
  return `${API_BASE}/v1/public/b2b/portal/${encodeURIComponent(accountId)}/fleet${path}?tenant=${encodeURIComponent(tenantSlug)}`;
}

export async function getFleet(tenantSlug: string, accountId: string): Promise<PortalFleet> {
  const res = await fetch(fleetUrl(accountId, '', tenantSlug), { cache: 'no-store' });
  return parse<PortalFleet>(res);
}

export async function addFleetVehicle(
  tenantSlug: string,
  accountId: string,
  form: FleetVehicleForm
): Promise<PortalFleetVehicle> {
  const res = await fetch(fleetUrl(accountId, '/vehicles', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(form),
  });
  return (await parse<{ vehicle: PortalFleetVehicle }>(res)).vehicle;
}

export async function updateFleetVehicle(
  tenantSlug: string,
  accountId: string,
  vehicleId: string,
  form: FleetVehicleForm
): Promise<PortalFleetVehicle> {
  const res = await fetch(
    fleetUrl(accountId, `/vehicles/${encodeURIComponent(vehicleId)}`, tenantSlug),
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    }
  );
  return (await parse<{ vehicle: PortalFleetVehicle }>(res)).vehicle;
}

export async function removeFleetVehicle(
  tenantSlug: string,
  accountId: string,
  vehicleId: string
): Promise<void> {
  const res = await fetch(
    fleetUrl(accountId, `/vehicles/${encodeURIComponent(vehicleId)}`, tenantSlug),
    { method: 'DELETE' }
  );
  await parse<unknown>(res);
}

/** The vehicle form, filled from a vehicle (or empty for a new one). */
export function formFromVehicle(v: PortalFleetVehicle | null): FleetVehicleForm {
  return {
    label: v?.label ?? '',
    year: v?.year ? String(v.year) : '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    vin: v?.vin ?? '',
    notes: v?.notes ?? '',
    domainId: v?.domainId ?? '',
    nodeId: v?.nodeId ?? '',
  };
}

// ── The shop's fitment list, for picking the vehicle ─────────────────────────

export interface FitmentListDimension {
  key: string;
  label: string;
  kind: 'level' | 'range';
}

export interface FitmentList {
  id: string;
  displayName: string;
  dimensions: FitmentListDimension[];
}

export interface FitmentEntry {
  id: string;
  name: string;
  childCount: number;
}

export async function getFitmentLists(tenantSlug: string): Promise<FitmentList[]> {
  const res = await fetch(
    `${API_BASE}/v1/public/commerce/fitment/domains?tenant=${encodeURIComponent(tenantSlug)}`
  );
  return parse<FitmentList[]>(res);
}

export async function getFitmentEntries(
  tenantSlug: string,
  domainId: string,
  parentId: string | null
): Promise<FitmentEntry[]> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  if (parentId) qs.set('parentId', parentId);
  const res = await fetch(
    `${API_BASE}/v1/public/commerce/fitment/domains/${encodeURIComponent(domainId)}/nodes?${qs.toString()}`
  );
  return parse<FitmentEntry[]>(res);
}

/** The listing of parts that fit one vehicle. */
export function partsThatFitHref(vehicleId: string): string {
  return `/products?fleetVehicle=${encodeURIComponent(vehicleId)}`;
}
