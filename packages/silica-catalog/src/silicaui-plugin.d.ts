// Types for `@wizeworks/silicaui` — the Tailwind v4 plugin. It ships as plain ESM
// (`exports: { '.': './src/index.js' }`) with no declarations, because its only
// intended consumer is a CSS file: `@plugin '@wizeworks/silicaui' { colors: … }`.
//
// `custom-colors.ts` calls it from TypeScript instead, to recover the rules a
// tenant-authored color would have produced had it been in that build-time list.
// Only the surface that call touches is declared: `plugin.withOptions` returns an
// options function whose result carries Tailwind's `handler`, and silicaui's handler
// uses just `addBase` / `addUtilities` / `theme`. Anything broader would be a guess
// about a package that doesn't publish types.

declare module '@wizeworks/silicaui' {
  type RuleMap = Record<string, unknown>;

  interface SilicaPluginApi {
    addBase(rules: RuleMap): void;
    addUtilities(rules: RuleMap): void;
    theme(path?: string): unknown;
  }

  interface SilicaPluginOptions {
    /** The color names to generate component variants + utilities for. */
    colors?: string[];
    /** Prepended verbatim to every silica class (e.g. `sx-` → `.sx-btn`). */
    prefix?: string;
  }

  const plugin: (options?: SilicaPluginOptions) => {
    handler: (api: SilicaPluginApi) => void;
    config: unknown;
  };

  export default plugin;
}
