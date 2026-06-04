// Tenant components — the persisted contract for user-authored components
// (docs/53). A tenant component is a DECLARATIVE, versioned, parameterized node
// subtree (vs. system components, which are in-code and carry a renderLeaf
// function). It renders by EXPANSION through the trusted registry renderers, so
// it can be stored, validated, and versioned as plain data — never user code.
//
// Zod-only (no DB, no React), like the rest of @sparx/builder-schemas: safe to
// import from the editor's client components AND the server service layer.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';

// ── Group + surfaces (mirror the dashboard registry's PaletteGroup / EditorSurface) ──

export const ComponentGroup = z.enum(['layout', 'content', 'data']);
export type ComponentGroup = z.infer<typeof ComponentGroup>;

export const ComponentSurface = z.enum(['page', 'site', 'email']);
export type ComponentSurface = z.infer<typeof ComponentSurface>;

// ── Component key + the `custom:` placement namespace ─────────────────────────

/** The placement type for a tenant component is `custom:<key>`. The node `type`
 *  column caps at 63 chars, and `custom:` is 7, so the key caps at 56. */
export const CUSTOM_PREFIX = 'custom:';
export const COMPONENT_KEY_MAX = 56;

export const ComponentKey = z
  .string()
  .min(1)
  .max(COMPONENT_KEY_MAX)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.');
export type ComponentKey = z.infer<typeof ComponentKey>;

/** The placement `type` for a tenant component (`custom:<key>`). */
export function customType(key: string): string {
  return `${CUSTOM_PREFIX}${key}`;
}
export function isCustomType(type: string): boolean {
  return type.startsWith(CUSTOM_PREFIX);
}
/** The component key behind a `custom:<key>` placement type, or null. */
export function customKeyOf(type: string): string | null {
  return isCustomType(type) ? type.slice(CUSTOM_PREFIX.length) : null;
}

// ── PropSpec — the instance-fillable slots (docs/53 §5) ───────────────────────

export const PropKind = z.enum(['text', 'richtext', 'url', 'image', 'number', 'boolean']);
export type PropKind = z.infer<typeof PropKind>;

export const PropSpecSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Prop keys are camelCase starting with a lowercase letter.'),
  label: z.string().min(1).max(120),
  kind: PropKind,
  /** A default value used when an instance leaves the slot empty. */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export type PropSpec = z.infer<typeof PropSpecSchema>;

export const PropSpecListSchema = z.array(PropSpecSchema).max(50);

// ── The `{ $prop: key }` slot sentinel ────────────────────────────────────────
// A node prop value inside a component tree may be a slot reference instead of a
// literal; the expander replaces it with the instance's value for that prop.

export const PROP_SLOT_KEY = '$prop';
export interface PropSlot {
  $prop: string;
}
export function isPropSlot(v: unknown): v is PropSlot {
  return (
    typeof v === 'object' && v !== null && typeof (v as { $prop?: unknown }).$prop === 'string'
  );
}

// ── The instance `$ref` (carried on a placement node's props) ─────────────────
// A `custom:<key>` placement stores its pinned version + instance prop values
// under `props.$ref`; the rest of `props` are the instance's slot values.

export const REF_KEY = '$ref';
export const ComponentRefSchema = z.object({
  /** The pinned component version this placement renders. */
  version: z.number().int().min(1),
});
export type ComponentRef = z.infer<typeof ComponentRefSchema>;

/** Read the `$ref` off a placement node's props, or null if absent/malformed. */
export function readComponentRef(props: Record<string, unknown>): ComponentRef | null {
  const parsed = ComponentRefSchema.safeParse(props[REF_KEY]);
  return parsed.success ? parsed.data : null;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** A single immutable version of a component. */
export interface ComponentVersionDto {
  version: number;
  tree: BuilderNode;
  propSpec: PropSpec[];
  createdAt: string;
}

/** One component, including its LATEST version's content (what the editor edits).
 *  Older versions are fetched on demand for the version history / upgrade UI. */
export interface ComponentDto {
  id: string;
  key: string;
  name: string;
  group: ComponentGroup;
  icon: string;
  description: string | null;
  surfaces: ComponentSurface[];
  latestVersion: number;
  tree: BuilderNode;
  propSpec: PropSpec[];
  createdAt: string;
  updatedAt: string;
}

/** A component without its tree — the list/catalog row. */
export interface ComponentSummaryDto {
  id: string;
  key: string;
  name: string;
  group: ComponentGroup;
  icon: string;
  description: string | null;
  surfaces: ComponentSurface[];
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ──────────

export const CreateComponentInput = z.object({
  key: ComponentKey,
  name: z.string().min(1).max(120),
  group: ComponentGroup.default('content'),
  icon: z.string().max(64).default('box'),
  description: z.string().max(500).nullish(),
  surfaces: z.array(ComponentSurface).min(1).default(['page']),
  tree: BuilderNodeSchema,
  propSpec: PropSpecListSchema.default([]),
});
export type CreateComponentInput = z.infer<typeof CreateComponentInput>;

/** Patch a component. Providing `tree` or `propSpec` creates a NEW version
 *  (the service bumps `latestVersion`); the identity fields update in place. */
export const UpdateComponentInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    group: ComponentGroup.optional(),
    icon: z.string().max(64).optional(),
    description: z.string().max(500).nullish(),
    surfaces: z.array(ComponentSurface).min(1).optional(),
    tree: BuilderNodeSchema.optional(),
    propSpec: PropSpecListSchema.optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdateComponentInput = z.infer<typeof UpdateComponentInput>;

// ── Tree validation (docs/53 §7) ──────────────────────────────────────────────
// Structural validation beyond the BuilderNodeSchema parse: type resolution,
// nesting, no nested custom (v1), and prop-slot resolution. The system/tenant
// type predicates are injected by the caller — @sparx/builder-schemas is
// React-free and can't import the dashboard registry, so the service supplies a
// server-safe known-type set + acceptsChildren map.

export interface ComponentValidationOptions {
  /** True if a node `type` is renderable (a system type or an existing tenant
   *  component). When omitted, type existence is not checked. */
  isKnownType?: (type: string) => boolean;
  /** True if a node `type` may hold children. When omitted, nesting isn't checked. */
  acceptsChildren?: (type: string) => boolean;
  /** Forbid `custom:*` nodes inside a component tree — v1 has no nesting, which
   *  sidesteps the cycle problem entirely (docs/53 §7). Default true. */
  forbidNestedCustom?: boolean;
}

export interface ComponentValidationIssue {
  path: string;
  message: string;
}

/** Validate a component's tree + propSpec. Returns [] when valid. */
export function validateComponentTree(
  tree: BuilderNode,
  propSpec: PropSpec[],
  opts: ComponentValidationOptions = {}
): ComponentValidationIssue[] {
  const { isKnownType, acceptsChildren, forbidNestedCustom = true } = opts;
  const propKeys = new Set(propSpec.map((p) => p.key));
  const issues: ComponentValidationIssue[] = [];

  const walk = (node: BuilderNode, path: string): void => {
    if (forbidNestedCustom && isCustomType(node.type)) {
      issues.push({
        path,
        message: `Components can't contain other components yet ("${node.type}").`,
      });
    } else if (isKnownType && !isKnownType(node.type)) {
      issues.push({ path, message: `Unknown component type "${node.type}".` });
    }

    if (acceptsChildren && (node.children?.length ?? 0) > 0 && !acceptsChildren(node.type)) {
      issues.push({ path, message: `"${node.type}" can't contain children.` });
    }

    // Prop slots must name a declared propSpec entry.
    for (const [key, value] of Object.entries(node.props)) {
      if (isPropSlot(value) && !propKeys.has(value.$prop)) {
        issues.push({
          path: `${path}.props.${key}`,
          message: `Slot references undeclared prop "${value.$prop}".`,
        });
      }
    }

    (node.children ?? []).forEach((child, i) => walk(child, `${path}.children[${i}]`));
  };

  walk(tree, 'root');
  return issues;
}

/** Every `custom:<key>` placement found in a tree (with its pinned version) —
 *  powers where-used analysis (delete impact) and publish-time expansion. */
export function collectComponentRefs(
  tree: BuilderNode
): { type: string; key: string; version: number | null }[] {
  const out: { type: string; key: string; version: number | null }[] = [];
  const walk = (node: BuilderNode): void => {
    const key = customKeyOf(node.type);
    if (key) {
      out.push({ type: node.type, key, version: readComponentRef(node.props)?.version ?? null });
    }
    (node.children ?? []).forEach(walk);
  };
  walk(tree);
  return out;
}
