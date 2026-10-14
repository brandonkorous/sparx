// Which tools a connection is offered in tools/list (sparx persona issue 212).
//
// A tool is registered only when this connection can run it: the tenant has not
// switched it off (docs/07 §9), the credential holds its scope, and its module is
// on for the tenant. The call-time gates in `dispatch` stay as the backstop, but a
// client should never be offered a tool it can only be refused: a read-only key's
// AI client was offered every write tool, tried them, and got "forbidden" back.

export interface ListingContext {
  scopes: ReadonlySet<string>;
  /** Tools the tenant switched off. */
  disabled: ReadonlySet<string>;
  /** The modules on for the tenant. */
  activeModules: ReadonlySet<string>;
  /** The module a scope belongs to, or undefined when it needs none. */
  moduleOf: (scope: string) => string | undefined;
}

export function toolsToList<T extends { name: string; scope: string }>(
  tools: readonly T[],
  ctx: ListingContext
): T[] {
  return tools.filter((tool) => {
    if (ctx.disabled.has(tool.name)) return false;
    if (!ctx.scopes.has(tool.scope)) return false;
    const module = ctx.moduleOf(tool.scope);
    return module === undefined || ctx.activeModules.has(module);
  });
}
