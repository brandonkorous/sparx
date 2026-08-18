# WizeWorks Platform — Frontend Architecture

**Version:** 1.1.1  
**Author:** Brandon Korous  
**Last Updated:** 2026-07-08

---

## 1. Overview

WizeWorks has three frontend applications sharing a common design system and component library:

1. **Tenant Dashboard** — Admin interface for managing the tenant's modules (Next.js)
2. **Site** — Customer-facing website (Next.js, multi-tenant, theme-driven)
3. **B2B Portal** — Wholesale/fleet account portal (Next.js)

All three consume the WizeWorks REST/GraphQL API and share the `@wizeworks/ui` component library.

---

## 2. Technology Stack

| Concern         | Technology                      | Rationale                                                |
| --------------- | ------------------------------- | -------------------------------------------------------- |
| Framework       | Next.js 15 (App Router)         | SSR/SSG, edge rendering, streaming, image optimization   |
| Language        | TypeScript (strict)             | Type safety, better DX, fewer runtime errors             |
| Styling         | Tailwind CSS 4                  | Utility-first, design tokens, no runtime overhead        |
| State (server)  | React Query (TanStack)          | Cache management, background refetch, optimistic updates |
| State (client)  | Zustand                         | Lightweight, no boilerplate, works with SSR              |
| Forms           | React Hook Form + Zod           | Performant, type-safe validation                         |
| Components      | Radix UI primitives             | Accessible, unstyled, composable                         |
| Icons           | Lucide React                    | Consistent, tree-shakeable                               |
| Rich text       | TipTap                          | ProseMirror-based, extensible                            |
| Charts          | Recharts                        | React-native, composable                                 |
| Tables          | TanStack Table                  | Headless, powerful, flexible                             |
| Drag & drop     | dnd-kit                         | Accessible, touch support                                |
| Email templates | React Email                     | Component-based, preview in browser                      |
| Testing         | Playwright (E2E), Vitest (unit) | Fast, modern, excellent TS support                       |

---

## 3. Monorepo Structure

```
apps/
├── dashboard/              # Tenant admin (Next.js)
├── site/             # Customer site (Next.js, multi-tenant)
└── b2b-portal/             # B2B wholesale portal (Next.js)

packages/
├── ui/                     # Shared component library
│   ├── components/         # Button, Input, Modal, Table, Badge, etc.
│   ├── hooks/              # useDebounce, useMediaQuery, useClipboard, etc.
│   └── utils/              # cn(), formatCurrency(), formatDate(), etc.
├── api-client/             # Type-safe API client (generated from OpenAPI)
├── site-sdk/         # Public SDK for headless sites
├── email-templates/        # React Email templates
├── theme-engine/           # Theme rendering, CSS variable generation
└── types/                  # Shared TypeScript types (DTOs, enums)
```

---

## 4. Design System

### Design Tokens (CSS Custom Properties)

The dashboard runs on **silicaui** (`@wizeworks/silicaui`, a Tailwind v4 plugin) with `@sparx/brand/theme.css` (`sparx/packages/brand`) as the single **color** authority. Non-color tokens (type, space, radius, shadow, motion) plus the `--chart-*` palette live in `sparx/packages/ui/src/tokens.css`. Each app's `globals.css` registers the palette once — `@plugin '@wizeworks/silicaui' { colors: primary, secondary, accent, neutral, info, success, warning, error, danger, module }` — and the plugin statically emits every color + component utility (`.btn-*`, `.badge-*`, `.alert-*`, `bg-primary`, `bg-soft`, …). `danger` and `module` are sparx's two registered extras.

```css
/* @sparx/brand/theme.css — colors (defined once; dark resolves here too) */
:root {
  /* Base surface ramp */
  --color-base-100: #ffffff; /* topmost reading surface */
  --color-base-200: #f4f4f5; /* page ground */
  --color-base-300: #e4e4e7; /* deepest / borders */
  --color-base-content: #1f2937; /* primary text */

  /* Semantic palette (each with a matching -content) */
  --color-primary: #6366f1; /* indigo */
  --color-secondary: #db2777;
  --color-neutral: #1f2937;
  --color-info: #0ea5e9;
  --color-success: #10b981;
  --color-warning: #f59e0b; /* dark ink #422006 */
  --color-error: #ef4444;
  --color-danger: #ef4444;

  /* 18-module palette: one --color-module-<name> (+ -content) per module */
  --color-module-commerce: #f97316;
  --color-module-crm: #06b6d4;
  /* … */
  --color-module: var(--color-primary); /* default; ModuleProvider overrides */
}

:root[data-theme='dark'] {
  --color-primary: #818cf8;
  --color-secondary: #f472b6;
  --color-neutral: #e5e7eb;
  /* base ramp + semantics get their dark values here — defined ONCE,
     so there are no duplicate :root overrides fighting the dark palette */
}
```

```css
/* sparx/packages/ui/src/tokens.css — non-color tokens only */
:root {
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-size-base: 1rem; /* 16px floor */
  --spacing-4: 1rem;
  --radius-md: 0.375rem;
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  /* + the --chart-1..6 palette and a little component CSS */
}
```

Text colors are opacity modifiers off the base ink — `text-base-content` (primary), `text-base-content/70` (secondary), `/60` (muted), `/50` (tertiary), `/40` (disabled) — and borders are `border-base-300` (default) / `border-base-content/30` (strong).

### Theme Overrides (Tenant Themes)

Tenant themes override the base tokens via CSS custom properties on the `:root` of their site:

```css
/* Industrial theme (Gillett Diesel) */
:root {
  --color-primary: hsl(0, 80%, 40%); /* GDS red */
  --color-background: hsl(0, 0%, 4%); /* Near black */
  --color-surface: hsl(0, 0%, 11%); /* Dark charcoal */
  --font-sans: 'Bebas Neue', 'Inter', sans-serif;
}
```

---

## 5. Component Library (silicaui + `@wizeworks/ui`)

> See [docs/23-frontend-component-architecture.md](23-frontend-component-architecture.md) for the authoritative component spec (silicaui primitives, the four-axis variant system, ModuleProvider, full inventory). This section is a summary.

The dashboard's **primitives** are imported directly from `@wizeworks/silicaui-react` (Button, Input, Select, Badge, Card, Table, Tabs, Dialog, Alert, …). `@wizeworks/ui` survives as the home of the ~25 sparx **compositions** — the shell (`SidebarAppShell`/`BrandRail`, built on silica's `Sidebar` primitive), `ModuleProvider`, `SurfaceFrame`/`SurfaceStep`/`SurfaceSummary`, `ListToolbar`/`FilterBar`/`BulkActionBar`, `ConfirmProvider`, `PageHeader`, `Wordmark`, `toast`/`Toaster`, `statusTone`/`statusLabel`, `cn`, `Stat`, and the chart wrappers — all rebuilt on silicaui primitives.

### Core Components

**Layout:**
Container, Grid, Stack, Flex, Divider, ScrollArea

**Inputs:**
Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider, DatePicker, FilePicker, RichTextEditor, ColorPicker

**Feedback:**
Toast, Alert, Badge, Spinner, Progress, Skeleton, EmptyState, ErrorBoundary

**Overlay:**
Modal, Dialog, Drawer, Popover, Tooltip, DropdownMenu, ContextMenu

**Data Display:**
Table, DataGrid, Avatar, Card, Stat, Timeline, Tag, Code

**Navigation:**
Sidebar, Breadcrumb, Tabs, Pagination, Stepper, NavMenu

### Component Conventions

Every color-bearing control is **`color × variant × size × shape`** — four orthogonal axes, never a flat enum. silicaui's Tailwind plugin resolves them: `<Button color variant size>` maps to `btn btn-<color> btn-<variant> btn-<size>`, so there is no hand-rolled CVA recipe in feature code. Feature code composes these primitives and their variants; it never re-skins a control.

```tsx
// color × variant × size × shape — resolved by the silicaui plugin
<Button color="primary" variant="soft" size="md">Save</Button>
<Button color="module" variant="solid">New product</Button> // module hue via <ModuleProvider>
<Badge color={statusTone(status)} variant="soft">{statusLabel(status)}</Badge>
```

silica variant vocabulary: `solid` (bare `btn`), `soft` (`btn-soft`), `outline` (`btn-outline`), `dashed` → `btn-dash`, `ghost` (`btn-ghost`), `link` (`btn-link`); sizes `xs…xl`; shapes `square` / `circle` / `block` / `wide`. A **tint** is always `<color> + soft` (e.g. `bg-module bg-soft`, `bg-success bg-soft`) — a theme-aware `color-mix`, never a baked tint token. `@wizeworks/ui`'s `cn` extends tailwind-merge so `bg-<color> bg-soft` survives merging.

---

## 6. Tenant Dashboard

### App Router Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
├── (onboarding)/
│   ├── step-1/page.tsx          # Business info
│   ├── step-2/page.tsx          # Theme selection
│   ├── step-3/page.tsx          # First product
│   ├── step-4/page.tsx          # Domain
│   └── step-5/page.tsx          # Payments
└── (dashboard)/
    ├── layout.tsx                # Sidebar + topbar shell
    ├── page.tsx                  # Dashboard home (stats, tasks)
    ├── products/
    │   ├── page.tsx              # Product list
    │   └── [id]/page.tsx         # Product editor
    ├── orders/
    │   ├── page.tsx              # Order list
    │   └── [id]/page.tsx         # Order detail
    ├── customers/
    │   ├── page.tsx              # Customer list
    │   └── [id]/page.tsx         # Customer record + CRM
    ├── crm/
    │   ├── pipeline/page.tsx     # Kanban pipeline
    │   └── tasks/page.tsx        # Task list
    ├── email/
    │   ├── automations/page.tsx
    │   ├── templates/page.tsx
    │   └── broadcasts/page.tsx
    ├── content/
    │   ├── pages/page.tsx
    │   └── blog/page.tsx
    ├── dropship/page.tsx
    ├── analytics/page.tsx
    ├── b2b/
    │   ├── accounts/page.tsx
    │   └── quotes/page.tsx
    ├── domains/page.tsx
    └── settings/
        ├── general/page.tsx
        ├── billing/page.tsx
        ├── staff/page.tsx
        └── ai/page.tsx
```

### Data Fetching Strategy

- Server Components for initial page data (no loading flash)
- Client Components for interactive elements
- React Query for client-side mutations and real-time updates
- Optimistic updates for common actions (order status change, toggle)

---

## 7. Site (Multi-Tenant)

### Tenant Resolution

The site resolves the correct tenant from the request's `Host` header:

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const tenant = await resolveTenant(host); // DB lookup, cached in Redis

  if (!tenant) return NextResponse.rewrite(new URL('/not-found', request.url));

  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenant.id);
  response.headers.set('x-tenant-theme', tenant.theme);
  return response;
}
```

### Theme Rendering

Each site page reads the tenant's theme configuration and generates CSS variables:

```typescript
// app/layout.tsx
export default async function RootLayout({ children }) {
  const tenant = await getTenantFromHeaders()
  const themeVars = generateThemeVars(tenant.settings.theme)

  return (
    <html>
      <head>
        <style>{`:root { ${themeVars} }`}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Caching Strategy

- Product pages: ISR (Incremental Static Regeneration), revalidate every 60s
- Collection pages: ISR, revalidate every 300s
- Cart: no caching (always fresh)
- Customer account: no caching (private)
- CMS pages: ISR, revalidate on publish

---

## 8. Performance

### Core Web Vitals Targets

| Metric    | Target  | Strategy                                     |
| --------- | ------- | -------------------------------------------- |
| LCP       | < 2.5s  | Image optimization, CDN, ISR                 |
| FID / INP | < 100ms | Code splitting, minimal JS                   |
| CLS       | < 0.1   | Explicit image dimensions, font display swap |
| TTFB      | < 200ms | Edge caching, regional deployment            |

### Optimization Techniques

- `next/image` for automatic WebP, lazy load, blur placeholder
- Dynamic imports for heavy components (rich text editor, charts)
- Route-level code splitting (automatic in Next.js App Router)
- Bundle analysis in CI (fail if bundle exceeds threshold)
- Font subsetting via `next/font`
- Prefetch on hover for predictive navigation

---

## 9. Testing

### Unit Tests (Vitest)

- Component rendering tests
- Hook logic tests
- Utility function tests
- Coverage threshold: 80% for UI package

### E2E Tests (Playwright)

Key flows tested on every deploy to staging:

- Tenant signup → onboarding → live site
- Add product → publish
- Place order as customer → checkout
- Order fulfillment flow
- Custom domain setup flow
- Email automation trigger

### Accessibility

- Radix UI primitives are ARIA-compliant by default
- Keyboard navigation tested in E2E suite
- Color contrast ratios meet WCAG AA
- `axe-playwright` accessibility scan in CI
