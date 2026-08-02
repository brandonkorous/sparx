// @sparx/ui — public barrel.
//
// This package is NOT a component library. It is the small set of sparx-specific
// compositions that silicaui does not provide. Everything silica ships has been
// deleted from here — reach for `@wizeworks/silicaui-react` first, always, and
// check `list_components` before adding anything below. A name that exists on
// both sides is drift by construction.
//
// The reference consumer is `apps/workbench`, which depends on this package NOT
// AT ALL: it imports silicaui directly. The remaining consumers are `apps/admin`
// (the staff console), `apps/web`, `apps/site` and `@sparx/cms-editor`.
//
// See docs/23-frontend-component-architecture.md §9 and packages/ui/CLAUDE.md.

// ── Utilities ──────────────────────────────────────────────
export { cn } from './utils/cn';
export { cva, type VariantProps } from './utils/cva';

// ── Variant system (docs/35) ───────────────────────────────
export {
  COLOR_KEYS,
  MODULE_COLOR_KEYS,
  ALL_COLOR_KEYS,
  TREATMENT_KEYS,
  type ColorKey,
  type SemanticColorKey,
  type ModuleColorKey,
  type TreatmentKey,
} from './components/_recipes/variants';

// ── Providers / context ───────────────────────────────────
// `useModule` is gone with ModuleProvider's React context. It had no caller
// anywhere in the repo outside its own test, and dropping it is what let the
// provider stop being a client component — every consumer was crossing a client
// boundary to set one attribute. Nothing here needs to know the active module in
// JS; the hue arrives through CSS.
export { ModuleProvider, type SparxModule } from './providers/module-provider';

// ── Hooks ─────────────────────────────────────────────────
export { useTheme, THEME_INIT_SCRIPT, type Theme } from './hooks/use-theme';
export { useMediaQuery } from './hooks/use-media-query';

// ── Brand ────────────────────────────────────────────────
// The MARKS themselves live in `@sparx/brand` (geometry + `BRAND` constants in
// marks.ts, React components at `@sparx/brand/react`). These are the sparx-app
// wrappers over them — never re-inline the SVG paths or the wordmark's "x" hex.
export { Wordmark, type WordmarkProps } from './components/brand/wordmark';
export {
  Spark,
  SparxMark,
  AppIcon,
  type SparkProps,
  type SparxMarkProps,
  type AppIconProps,
} from './components/brand/sparx-mark';
export { MadeWithSparx, type MadeWithSparxProps } from './components/brand/made-with-sparx';

// ── Primitives kept for API stability ─────────────────────
// These four wear the sparx four-axis API and resolve it to silicaui's plugin
// classes (`btn btn-<color> btn-<variant> btn-<size>`). They paint nothing of
// their own — silica owns padding, height, radius, focus ring, disabled state.
// Everything else that was here — Input, Select, Textarea, Checkbox, Switch,
// Avatar, Skeleton, Tabs, Accordion, Alert, Kbd, Stat, Timeline, Popover,
// Drawer, AlertDialog, Breadcrumb, Pagination, Steps, … — is silicaui's.
export { Spinner, type SpinnerProps } from './components/primitives/spinner';
export {
  Button,
  buttonClasses,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type ButtonShape,
} from './components/primitives/button';
export {
  Badge,
  statusTone,
  statusLabel,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type StatusTone,
} from './components/primitives/badge';
export { Heading, headingVariants, type HeadingProps } from './components/primitives/heading';
export { Text, textVariants, type TextProps } from './components/primitives/text';

// ── Layout ────────────────────────────────────────────────
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
  type CardProps,
} from './components/layout/card';
export { Stack, type StackProps } from './components/layout/stack';
export { PageHeader, type PageHeaderProps } from './components/layout/page-header';
export {
  SidebarAppShell,
  useRailExpanded,
  usePanelCollapsed,
  type SidebarAppShellProps,
} from './components/layout/sidebar-app-shell';

// ── Overlay ───────────────────────────────────────────────
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './components/overlay/tooltip';
// `useConfirm` is a composition over silica's imperative alert dialog, not a
// dialog: it defers the caller's continuation out of silica's close commit (a
// flushSync React would otherwise reject) and defaults a confirm to `danger`.
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
  type ConfirmFn,
} from './components/overlay/confirm-provider';
export { Toaster, toast } from './components/overlay/toast';

// ── Navigation ────────────────────────────────────────────
export {
  TopProgress,
  type TopProgressProps,
  type TopProgressTone,
} from './components/navigation/top-progress';
export {
  topProgress,
  withTopProgress,
  ROUTE_ID,
  type TopProgressState,
  type TopProgressHandle,
  type StartOptions,
} from './components/navigation/top-progress-controller';
export { resolveRouteModule } from './components/navigation/top-progress-nav';

// ── Data display ──────────────────────────────────────────
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './components/data/table';

// ── System / runtime ──────────────────────────────────────
// ChunkReloadGuard moved to `@sparx/app-kit`. It never belonged here: it has no
// appearance, no variant and no token — it is framework glue, and living in the
// design library is what let three more copies of it grow in apps that don't
// depend on @sparx/ui. Import it (and `isChunkLoadError`) from '@sparx/app-kit'.
