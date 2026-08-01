// @sparx/ui — public barrel.
//
// New components are added below as they're built.
// See docs/23-frontend-component-architecture.md §9 for the full inventory.

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
export { ModuleProvider, useModule, type SparxModule } from './providers/module-provider';

// ── Hooks ─────────────────────────────────────────────────
export { useTheme, THEME_INIT_SCRIPT, type Theme } from './hooks/use-theme';
export { useMediaQuery } from './hooks/use-media-query';
export { useDebouncedValue } from './hooks/use-debounced-value';

// ── Brand ────────────────────────────────────────────────
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
export {
  BrandRail,
  RailWordmark,
  RAIL_BG,
  type BrandRailProps,
} from './components/brand/brand-rail';

// ── Primitives ────────────────────────────────────────────
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
// `Avatar` / `Skeleton` / `ButtonGroup` are silicaui's — import `Avatar`,
// `Skeleton` and `Join` from `@wizeworks/silicaui-react`. Ours were CVA
// re-skins of controls silica already ships, and nothing consumed them.
// Switch / Checkbox / RadioGroup / Slider / Progress are NOT re-exported here.
// silicaui ships all five natively (`switch-<color>`, `checkbox-<color>`, …), so
// import them straight from `@wizeworks/silicaui-react` — a wrapper here would be
// a second name for one control, which is the drift RULE #1 exists to prevent.
export { Heading, headingVariants, type HeadingProps } from './components/primitives/heading';
export { Text, textVariants, type TextProps } from './components/primitives/text';
// `Label` joins them — silica's takes the same `required` prop and renders the
// same asterisk. Inside a form row prefer `FieldLabel`, which also wires the
// control's id and validity for you.

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
// `Accordion`, `Divider` and `ScrollArea` are silicaui's — import them from
// `@wizeworks/silicaui-react`.
export { Stack, type StackProps } from './components/layout/stack';
export { Grid, type GridProps } from './components/layout/grid';
export { Container, containerVariants, type ContainerProps } from './components/layout/container';
export { PageHeader, type PageHeaderProps } from './components/layout/page-header';
export { AuthFrame, type AuthFrameProps } from './components/layout/auth-frame';
export {
  SidebarAppShell,
  useRailExpanded,
  usePanelCollapsed,
  type SidebarAppShellProps,
} from './components/layout/sidebar-app-shell';

// ── Form ──────────────────────────────────────────────────
// The CONTROLS are silicaui's, not ours. `Input` / `Textarea` / `NativeSelect` /
// `Select` / `PasswordInput` / `Combobox` / `MultiSelect` / `Calendar` /
// `DatePicker` / `ColorPicker` / `FileUpload` / `Label` are all shipped by
// `@wizeworks/silicaui-react` — import them from there. Each of those once had a
// hand-rolled twin here that rebuilt the same chassis (border, radius, hover,
// focus, `sm/md/lg` heights, error/success states) out of utilities; silica's
// own `.input` / `.select` / `.textarea` already carry every one of them, driven
// by `--input-accent` so a color prop recolors border AND focus ring together.
// The twins are deleted. Workbench never used them — it imports silica's
// directly, and is the reference.
//
// VALIDATION is silica's `Field` too. `<Field status="error" statusMessage="…">`
// resolves the accent, the trailing icon, and the message panel from one place;
// `FieldLabel` / `FieldDescription` / `FieldStatus` complete the row and Base UI
// wires the ids + aria between them. The old shadcn-shaped react-hook-form
// adapter here (`Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/
// `FormDescription`/`FormMessage`/`useFormField`) reimplemented exactly that
// wiring and is gone; pair RHF's own `<Controller>` with `<Field>` instead.
//
// What stays below is what silica does NOT ship: a sparx action bar, a TipTap
// editor, and the schema-driven renderer (itself now built on `Field`).
export { FormActionBar, type FormActionBarProps } from './components/form/form-action-bar';
export { RichTextEditor, type RichTextEditorProps } from './components/form/rich-text-editor';
export {
  SchemaFieldRenderer,
  type SchemaFieldRendererProps,
  type SimpleField,
  type SimpleFieldType,
} from './components/form/schema-field-renderer';

// ── Overlay ───────────────────────────────────────────────
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './components/overlay/tooltip';
export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalPortal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  modalContentVariants,
  type ModalContentProps,
} from './components/overlay/modal';
// `Drawer` and `AlertDialog` are silicaui's — import their parts from
// `@wizeworks/silicaui-react`. `ConfirmProvider` / `useConfirm` below stay,
// but are now a thin composition over silica's imperative alert dialog rather
// than a second dialog implementation.
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
  type ConfirmFn,
} from './components/overlay/confirm-provider';
export {
  ProductTour,
  useProductTour,
  type ProductTourStep,
  type ProductTourOptions,
  type ProductTourProps,
} from './components/overlay/product-tour';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
} from './components/overlay/dropdown-menu';
// `ContextMenu`, `Popover` and `CommandPalette` are silicaui's — import them
// from `@wizeworks/silicaui-react`. Ours were Radix (and cmdk) re-skins that
// duplicated Base UI components silica already ships, and left the two popup
// systems unable to coordinate when nested (the same defect documented on
// `Modal` below). No consumer ever imported them.
export { Toaster, toast } from './components/overlay/toast';

// ── System / runtime ──────────────────────────────────────
// ChunkReloadGuard moved to `@sparx/app-kit`. It never belonged here: it has no
// appearance, no variant and no token — it is framework glue, and living in the
// design library is what let three more copies of it grow in apps that don't
// depend on @sparx/ui. Import it (and `isChunkLoadError`) from '@sparx/app-kit'.

// ── Navigation ────────────────────────────────────────────
// `Tabs`, `Sidebar`, `Breadcrumb`, `Pagination` and `Stepper` are silicaui's —
// import `Tabs` / `Sidebar` / `Breadcrumb` / `Pagination` / `Steps` from
// `@wizeworks/silicaui-react`. Note silica names the stepper `Steps`, and its
// tabs take `variant="pills"` for the filled selection DESIGN.md §5 requires —
// our `tabsListVariants` hand-built that from utilities.
export {
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryRow,
  SurfaceSummaryDivider,
  AdaptiveLabel,
  type SurfaceFrameProps,
  type SurfaceStepProps,
  type SurfaceStepActions,
  type SurfaceStepDef,
  type SurfaceVariant,
  type ResponsiveLabel,
} from './components/navigation/surface-frame';
// `NavigationMenu` is silicaui's too.
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
export { Code, codeVariants, type CodeProps } from './components/data/code';
// `Kbd`, `Alert`, `Stat` and `Timeline` are silicaui's — import them from
// `@wizeworks/silicaui-react`. Apps were already doing exactly that (176 live
// `<Alert>` call sites resolve to silica's, none to ours).
export { StatusDot, type StatusDotProps } from './components/data/status-dot';
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
export { DataTable, type DataTableProps } from './components/data/data-table';
export {
  ActionTile,
  ActionQueue,
  type ActionTileProps,
  type ActionQueueProps,
} from './components/data/action-tile';
export { BarList, type BarListProps, type BarListItem } from './components/data/bar-list';
export { EmptyState, type EmptyStateProps } from './components/data/empty-state';
export { FilterBar, type FilterBarProps } from './components/data/filter-bar';
export {
  ListToolbar,
  type ListToolbarProps,
  type ListToolbarFilter,
  type ListToolbarOption,
  type ListToolbarSort,
  type ListToolbarView,
} from './components/data/list-toolbar';
export { Tag, type TagProps } from './components/data/tag';
export {
  BulkActionBar,
  type BulkActionBarProps,
  type BulkAction,
} from './components/data/bulk-action-bar';
export {
  SelectionList,
  type SelectionListProps,
  type SelectionColumn,
  type SelectionCard,
  type SelectionCardContext,
} from './components/data/selection-list';
export { Pager, type PagerProps } from './components/data/pager';
export { ListPageShell, type ListPageShellProps } from './components/data/list-page-shell';
export {
  ImportDialog,
  type ImportDialogProps,
  type ImportJobResult,
  type ImportJobRow,
  type ImportJobStatus,
} from './components/data/import-dialog';
export { ExportButton, type ExportButtonProps } from './components/data/export-button';
export {
  LineChart,
  BarChart,
  AreaChart,
  Sparkline,
  DonutChart,
  type ChartSeries,
  type ValueFormat,
  type BaseChartProps,
  type LineChartProps,
  type BarChartProps,
  type AreaChartProps,
  type SparklineProps,
  type DonutChartProps,
  type DonutDatum,
} from './components/data/chart';
