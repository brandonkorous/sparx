// componentService — tenant-authored components (docs/53).
//
// A tenant component is a DECLARATIVE, versioned node subtree (vs. system
// components, which are in-code). Identity lives in BuilderComponent; the
// editable content lives in immutable BuilderComponentVersion snapshots so a
// page placement can PIN a version and opt into upgrades. Editing the tree /
// propSpec creates a NEW version and bumps `latestVersion`.
//
// Trees are validated against @sparx/builder-schemas on every write. Tenant-
// scoped via withTenant() — a callsite that forgets it sees nothing (FORCE RLS).
// One service, many transports: REST mounts these; MCP / Server Actions reuse
// them unchanged.

import {
  CreateComponentInput,
  UpdateComponentInput,
  collectComponentRefs,
  expandCustomNodes,
  validateComponentTree,
  type BuilderNode,
  type ComponentDto,
  type ComponentSummaryDto,
  type ComponentSurface,
  type ComponentGroup,
  type ComponentUsageDto,
  type ComponentVersionDto,
  type PropSpec,
} from '@sparx/builder-schemas';
import type { BuilderComponent, BuilderComponentVersion, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { BuilderNotFoundError, BuilderValidationError } from '../errors';

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

function surfacesOf(row: BuilderComponent): ComponentSurface[] {
  const s = row.surfaces as unknown;
  return Array.isArray(s) && s.length > 0 ? (s as ComponentSurface[]) : ['page'];
}

function toSummary(row: BuilderComponent): ComponentSummaryDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    group: row.group as ComponentGroup,
    icon: row.icon,
    description: row.description,
    surfaces: surfacesOf(row),
    latestVersion: row.latestVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDto(row: BuilderComponent, version: BuilderComponentVersion): ComponentDto {
  return {
    ...toSummary(row),
    tree: version.tree as unknown as BuilderNode,
    propSpec: (version.propSpec as unknown as PropSpec[]) ?? [],
  };
}

function toVersionDto(v: BuilderComponentVersion): ComponentVersionDto {
  return {
    version: v.version,
    tree: v.tree as unknown as BuilderNode,
    propSpec: (v.propSpec as unknown as PropSpec[]) ?? [],
    createdAt: v.createdAt.toISOString(),
  };
}

/** Validate a tree + propSpec, raising a BuilderValidationError on any issue.
 *  v1 forbids nested custom components (sidesteps cycles); type-resolution is
 *  enforced by the caller's predicates once a server-safe registry mirror lands
 *  (docs/53 §7 / P-B). */
function assertValidTree(tree: BuilderNode, propSpec: PropSpec[]): void {
  const issues = validateComponentTree(tree, propSpec, { forbidNestedCustom: true });
  if (issues.length > 0) {
    throw new BuilderValidationError(
      'This component has validation problems.',
      issues.map((i) => ({ field: i.path, message: i.message }))
    );
  }
}

/** List the tenant's components (no tree) — the catalog rows. Ordered by group
 *  then name so the catalog reads stably. */
export function list(ctx: ServiceContext): Promise<ComponentSummaryDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderComponent.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toSummary);
  });
}

/** Every component WITH its latest version's content — what the Builder editor
 *  needs to expand `custom:*` placements live on the canvas (docs/53 P-B). One
 *  extra query over `list`; the page editor calls this, the catalog uses `list`. */
export function listFull(ctx: ServiceContext): Promise<ComponentDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderComponent.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    if (rows.length === 0) return [];
    const versions = await tx.builderComponentVersion.findMany({
      where: { componentId: { in: rows.map((r) => r.id) } },
    });
    const latest = new Map<string, BuilderComponentVersion>();
    for (const v of versions) {
      const cur = latest.get(v.componentId);
      if (!cur || v.version > cur.version) latest.set(v.componentId, v);
    }
    return rows
      .map((row) => {
        const v = latest.get(row.id);
        return v ? toDto(row, v) : null;
      })
      .filter((d): d is ComponentDto => d !== null);
  });
}

/** One component with its LATEST version's content (what the editor edits). */
export function get(ctx: ServiceContext, key: string): Promise<ComponentDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderComponent.findFirst({ where: { key } });
    if (!row) throw new BuilderNotFoundError('BuilderComponent', key);
    const version = await tx.builderComponentVersion.findFirst({
      where: { componentId: row.id, version: row.latestVersion },
    });
    if (!version)
      throw new BuilderNotFoundError('BuilderComponentVersion', `${key}@${row.latestVersion}`);
    return toDto(row, version);
  });
}

/** All versions of a component, newest first — the version history / upgrade UI. */
export function listVersions(ctx: ServiceContext, key: string): Promise<ComponentVersionDto[]> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderComponent.findFirst({ where: { key }, select: { id: true } });
    if (!row) throw new BuilderNotFoundError('BuilderComponent', key);
    const versions = await tx.builderComponentVersion.findMany({
      where: { componentId: row.id },
      orderBy: { version: 'desc' },
    });
    return versions.map(toVersionDto);
  });
}

/** One specific version of a component — what a pinned placement renders. */
export function getVersion(
  ctx: ServiceContext,
  key: string,
  version: number
): Promise<ComponentVersionDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderComponent.findFirst({ where: { key }, select: { id: true } });
    if (!row) throw new BuilderNotFoundError('BuilderComponent', key);
    const v = await tx.builderComponentVersion.findFirst({
      where: { componentId: row.id, version },
    });
    if (!v) throw new BuilderNotFoundError('BuilderComponentVersion', `${key}@${version}`);
    return toVersionDto(v);
  });
}

/** Create a component + its version 1. The key is unique per tenant. */
export async function create(ctx: ServiceContext, rawInput: unknown): Promise<ComponentDto> {
  const input = CreateComponentInput.parse(rawInput);
  assertValidTree(input.tree, input.propSpec);
  return withTenant(ctx, async (tx) => {
    const collision = await tx.builderComponent.findFirst({
      where: { key: input.key },
      select: { id: true },
    });
    if (collision) {
      throw new BuilderValidationError(`A component with key "${input.key}" already exists.`, [
        { field: 'key', message: 'Choose a different key.' },
      ]);
    }
    const component = await tx.builderComponent.create({
      data: {
        tenantId: ctx.tenantId,
        key: input.key,
        name: input.name,
        group: input.group,
        icon: input.icon,
        description: input.description ?? null,
        surfaces: asJson(input.surfaces),
        latestVersion: 1,
      },
    });
    const version = await tx.builderComponentVersion.create({
      data: {
        tenantId: ctx.tenantId,
        componentId: component.id,
        version: 1,
        tree: asJson(input.tree),
        propSpec: asJson(input.propSpec),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.component.created',
      entityType: 'BuilderComponent',
      entityId: component.id,
      diff: { before: null, after: { key: component.key, name: component.name } },
    });
    return toDto(component, version);
  });
}

/** Update a component. Identity fields (name/group/icon/description/surfaces)
 *  update in place; providing `tree` or `propSpec` creates a NEW version
 *  (carrying forward the unchanged half) and bumps `latestVersion`. */
export async function update(
  ctx: ServiceContext,
  key: string,
  rawInput: unknown
): Promise<ComponentDto> {
  const input = UpdateComponentInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderComponent.findFirst({ where: { key } });
    if (!existing) throw new BuilderNotFoundError('BuilderComponent', key);
    const current = await tx.builderComponentVersion.findFirst({
      where: { componentId: existing.id, version: existing.latestVersion },
    });
    if (!current) {
      throw new BuilderNotFoundError('BuilderComponentVersion', `${key}@${existing.latestVersion}`);
    }

    // Identity patch (in place).
    const identity: Prisma.BuilderComponentUpdateInput = {};
    if (input.name !== undefined) identity.name = input.name;
    if (input.group !== undefined) identity.group = input.group;
    if (input.icon !== undefined) identity.icon = input.icon;
    if (input.description !== undefined) identity.description = input.description ?? null;
    if (input.surfaces !== undefined) identity.surfaces = asJson(input.surfaces);

    // A content change → a new version snapshot. Carry forward the unchanged half.
    const contentChanged = input.tree !== undefined || input.propSpec !== undefined;
    let versionRow = current;
    if (contentChanged) {
      const nextTree = input.tree ?? (current.tree as unknown as BuilderNode);
      const nextPropSpec = input.propSpec ?? (current.propSpec as unknown as PropSpec[]) ?? [];
      assertValidTree(nextTree, nextPropSpec);
      const nextVersion = existing.latestVersion + 1;
      versionRow = await tx.builderComponentVersion.create({
        data: {
          tenantId: ctx.tenantId,
          componentId: existing.id,
          version: nextVersion,
          tree: asJson(nextTree),
          propSpec: asJson(nextPropSpec),
        },
      });
      identity.latestVersion = nextVersion;
    }

    const updated = await tx.builderComponent.update({
      where: { id: existing.id },
      data: identity,
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.component.updated',
      entityType: 'BuilderComponent',
      entityId: existing.id,
      diff: {
        before: { version: existing.latestVersion },
        after: { version: updated.latestVersion, name: updated.name },
      },
    });
    return toDto(updated, versionRow);
  });
}

/** Expand every `custom:<key>` placement in `draft` into concrete primitives for
 *  publish (docs/53 §3): each placement → its PINNED version's tree with instance
 *  slots filled, so the storefront renderer never sees a `custom:*` type. Shared
 *  by pageService.publish + layoutService.publish; runs inside their transaction.
 *  A placement that no longer resolves (deleted component) is dropped. */
export async function expandTreeForPublish(
  tx: Prisma.TransactionClient,
  draft: BuilderNode
): Promise<BuilderNode> {
  const refs = collectComponentRefs(draft);
  if (refs.length === 0) return draft;
  const keys = [...new Set(refs.map((r) => r.key))];
  const comps = await tx.builderComponent.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(comps.map((c) => [c.key, c]));
  const versionRows = await tx.builderComponentVersion.findMany({
    where: { componentId: { in: comps.map((c) => c.id) } },
  });
  const byKeyVer = new Map<string, BuilderComponentVersion>();
  for (const v of versionRows) {
    const comp = comps.find((c) => c.id === v.componentId);
    if (comp) byKeyVer.set(`${comp.key}@${v.version}`, v);
  }
  return expandCustomNodes(draft, (key, version) => {
    const comp = byKey.get(key);
    if (!comp) return null;
    const row = byKeyVer.get(`${key}@${version ?? comp.latestVersion}`);
    if (!row) return null;
    return {
      tree: row.tree as unknown as BuilderNode,
      propSpec: (row.propSpec as unknown as PropSpec[]) ?? [],
    };
  });
}

/** Where a component is placed (docs/53 §6): the pages + layouts whose draft OR
 *  published tree references `custom:<key>`. Powers the delete-impact warning and
 *  the detail page's "Used on" panel. Scans within the caller's transaction so it
 *  shares the publish/delete consistency snapshot. */
async function scanUsages(tx: Prisma.TransactionClient, key: string): Promise<ComponentUsageDto> {
  const usesKey = (tree: unknown): boolean =>
    collectComponentRefs(tree as BuilderNode).some((r) => r.key === key);
  const [pages, layouts] = [
    await tx.builderPage.findMany({
      select: { id: true, name: true, draftTree: true, publishedTree: true },
    }),
    await tx.builderLayout.findMany({
      select: { id: true, name: true, draftTree: true, publishedTree: true },
    }),
  ];
  const pageHits = pages
    .filter((p) => usesKey(p.draftTree) || (p.publishedTree != null && usesKey(p.publishedTree)))
    .map((p) => ({ id: p.id, name: p.name }));
  const layoutHits = layouts
    .filter((l) => usesKey(l.draftTree) || (l.publishedTree != null && usesKey(l.publishedTree)))
    .map((l) => ({ id: l.id, name: l.name }));
  return { pages: pageHits, layouts: layoutHits, total: pageHits.length + layoutHits.length };
}

/** Where-used for one component (its own transaction). 404 if the key is unknown. */
export function usages(ctx: ServiceContext, key: string): Promise<ComponentUsageDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderComponent.findFirst({ where: { key }, select: { id: true } });
    if (!row) throw new BuilderNotFoundError('BuilderComponent', key);
    return scanUsages(tx, key);
  });
}

/** Delete a component and all its versions (cascade). BLOCKS when the component
 *  is still placed on any page/layout (docs/53 §6) — deleting a live placement
 *  would orphan it (publish-expand drops unresolved refs), so the caller must
 *  remove the placements first. The dashboard surfaces where-used before asking. */
export async function remove(ctx: ServiceContext, key: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderComponent.findFirst({ where: { key } });
    if (!existing) throw new BuilderNotFoundError('BuilderComponent', key);
    const used = await scanUsages(tx, key);
    if (used.total > 0) {
      throw new BuilderValidationError(
        'This component is still placed on pages or layouts. Remove those placements before deleting it.',
        [{ field: 'key', message: `In use in ${used.total} place${used.total === 1 ? '' : 's'}.` }]
      );
    }
    await tx.builderComponent.delete({ where: { id: existing.id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.component.deleted',
      entityType: 'BuilderComponent',
      entityId: existing.id,
      diff: { before: { key: existing.key, name: existing.name }, after: null },
    });
  });
}
