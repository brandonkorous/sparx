// @wizeworks/ui — public barrel.
//
// This package is NOT a component library. It is the small set of sparx-specific
// compositions that silicaui does not provide. Everything silica ships has been
// deleted from here — reach for `@wizeworks/silicaui-react` first, always, and
// check `list_components` before adding anything below. A name that exists on
// both sides is drift by construction.
//
// The reference consumer is `sparx/apps/workbench`, which depends on this package NOT
// AT ALL: it imports silicaui directly. The remaining consumers are `wizeworks/apps/admin`
// (the staff console), `sparx/apps/web`, `wizeworks/apps/site` and `@wizeworks/cms-editor`.
//
// See docs/23-frontend-component-architecture.md §9 and sparx/packages/ui/CLAUDE.md.

// ── Utilities ──────────────────────────────────────────────
// Re-exported, not defined here. `cn` corrects tailwind-merge's misreading of
// silica's `soft` classes — a platform fix with no sparx in it — so it lives in
// @wizeworks/silica-corrections. It stays on this barrel because six admin
// screens import it from here and there is no reason to make them care.
export { cn } from '@wizeworks/silica-corrections';
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

// ── No brand here, deliberately ───────────────────────────
// This package used to re-export `Wordmark`, `SparxMark`, `AppIcon` and
// `MadeWithSparx` as convenience shims, which quietly made a composition library
// a carrier for one brand's marks — and that is what stopped `wizeworks/apps/admin`
// (the WizeWorks STAFF console, which serves both brands) from being able to
// depend on it without importing sparx.
//
// The marks live where they always did: `@sparx/brand/react`. Import from there.

export { PlatformCredit, type PlatformCreditProps } from './components/brand/platform-credit';

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
// ChunkReloadGuard moved to `@wizeworks/app-kit`. It never belonged here: it has no
// appearance, no variant and no token — it is framework glue, and living in the
// design library is what let three more copies of it grow in apps that don't
// depend on @wizeworks/ui. Import it (and `isChunkLoadError`) from '@wizeworks/app-kit'.
