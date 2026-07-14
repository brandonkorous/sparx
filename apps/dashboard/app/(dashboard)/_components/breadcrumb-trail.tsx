'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ModuleProvider,
  Stack,
  Text,
  type SparxModule,
} from '@sparx/ui';
import {
  Building2,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react';
import type { OrgMembership } from '@sparx/auth';
import { findSectionByPath, getManifestForPath, moduleManifests } from '../_shell/registry';
import type { Property } from '@/lib/sites';
import { resolveActiveProperty } from '@/lib/site-scope';
import { setActiveSite } from '../settings/sites/actions';
import { switchOrganization } from '@/lib/org-actions';

// Workspace > Site > Module > Section > Page
//
// The trail has three interactive controls plus navigate-only links:
//   - Workspace (segment 1): the tenant. Menu → settings + sign out. Switch /
//     create land in Phase 2 (docs/32) once the org plugin is enabled.
//   - Site (segment 2): the active web PROPERTY (docs/49 §6). A switcher
//     dropdown — pick which site you're editing (sets the active-site cookie via
//     setActiveSite). Always shown: a tenant HAS sites, and this is the one
//     canonical place to change which site the whole app is scoped to. Single-
//     site tenants still see it (one entry + "Manage sites").
//   - Module (segment 3): a SPLIT control. The label links to the module home;
//     an adjacent ▾ opens a switcher listing the OTHER modules the tenant has
//     enabled (active one checked, accent-colored). This deviates from the
//     original §4.2 (which listed the module's sections) — sections now live in
//     the sidebar and as segment 3. See docs/24 §4.2 + docs/32.
//   - Section (segment 3): navigate-only link; the current page is plain text.
//
// Responsive: on md+ the inline trail renders with overflow-collapse to a `…`
// popover. Below md the whole trail condenses to a single context chip that
// opens a bottom sheet with Workspace / Module / Section groups — every switch
// is a full-width touch row. Desktop/mobile are toggled by Tailwind `md:`
// visibility (both in the DOM) so there is no first-paint flash from a media
// query resolving after mount.

type Manifest = (typeof moduleManifests)[number];

type TrailSegment =
  | { kind: 'tenant'; label: string; href: string }
  | { kind: 'site'; label: string; href: string }
  | { kind: 'module'; label: string; href: string; moduleId: Exclude<SparxModule, 'platform'> }
  | { kind: 'section'; label: string; href: string };

export interface BreadcrumbTrailProps {
  tenantName: string;
  /** Module manifest ids the tenant has activated. Filters the switcher so a
   *  tenant never sees a module it hasn't enabled. */
  enabledModules: readonly string[];
  /** The tenant's web properties (sites) + which is active (docs/49). Drives the
   *  Site segment; the switcher hides itself when the tenant has ≤1 site. */
  sites?: Property[];
  activePropertyId?: string | null;
  /** The user's org memberships + active org id (docs/114 §A.4). Turns the
   *  Workspace crumb into a switcher when the user belongs to >1 org. */
  organizations?: OrgMembership[];
  activeOrgId?: string | null;
}

export function BreadcrumbTrail({
  tenantName,
  enabledModules,
  sites = [],
  activePropertyId = null,
  organizations = [],
  activeOrgId = null,
}: BreadcrumbTrailProps) {
  const pathname = usePathname() ?? '/';
  const manifest = getManifestForPath(pathname, enabledModules);
  const section = findSectionByPath(pathname);

  // The Site segment is always present whenever the tenant has a site — a tenant
  // is a workspace that HAS sites, and the active site is what grounds the user
  // on what they're editing. Every tenant is born with a primary site
  // (packages/auth sign-up), so this is effectively always shown. Even when the
  // primary's name echoes the workspace name, we keep the crumb: the duplicate
  // reads as "workspace → site", and it stays a live switcher.
  const activeSite = sites.length > 0 ? resolveActiveProperty(sites, activePropertyId) : undefined;

  const segments: TrailSegment[] = [{ kind: 'tenant', label: tenantName, href: '/' }];
  if (activeSite) {
    segments.push({ kind: 'site', label: activeSite.name, href: '/settings/sites' });
  }
  if (manifest) {
    segments.push({
      kind: 'module',
      label: manifest.label,
      href: manifest.routePrefix,
      moduleId: manifest.id,
    });
  }
  if (section) {
    segments.push({ kind: 'section', label: section.label, href: section.href });
  }

  // Modules offered in the switcher: the enabled set, plus the current module
  // if (somehow) it isn't in that set — you should always be able to see where
  // you are and switch away from it.
  const switchableModules = React.useMemo(() => {
    const list = moduleManifests.filter((m) => enabledModules.includes(m.id));
    if (manifest && !list.some((m) => m.id === manifest.id)) return [manifest, ...list];
    return list;
  }, [enabledModules, manifest]);

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <DesktopTrail
          segments={segments}
          manifest={manifest}
          switchableModules={switchableModules}
          sites={sites}
          activeSiteId={activeSite?.id ?? null}
          organizations={organizations}
          activeOrgId={activeOrgId}
        />
      </div>
      <div className="min-w-0 md:hidden">
        <MobileSwitcher
          tenantName={tenantName}
          manifest={manifest}
          activeSectionHref={section?.href ?? null}
          switchableModules={switchableModules}
          sites={sites}
          activeSiteId={activeSite?.id ?? null}
          organizations={organizations}
          activeOrgId={activeOrgId}
        />
      </div>
    </>
  );
}

// ── Desktop inline trail ───────────────────────────────────

function DesktopTrail({
  segments,
  manifest,
  switchableModules,
  sites,
  activeSiteId,
  organizations,
  activeOrgId,
}: {
  segments: TrailSegment[];
  manifest: Manifest | undefined;
  switchableModules: Manifest[];
  sites: Property[];
  activeSiteId: string | null;
  organizations: OrgMembership[];
  activeOrgId: string | null;
}) {
  const collapseState = useResponsiveCollapse(segments.length);

  const lastIndex = segments.length - 1;
  const visible: { index: number; kind: 'segment' | 'ellipsis' }[] = [];
  let inserted = false;
  for (let i = 0; i < segments.length; i += 1) {
    if (collapseState.hiddenIndexes.has(i)) {
      if (!inserted) {
        visible.push({ index: i, kind: 'ellipsis' });
        inserted = true;
      }
      continue;
    }
    visible.push({ index: i, kind: 'segment' });
    inserted = false;
  }

  return (
    <Breadcrumb className="min-w-0" ref={collapseState.containerRef}>
      <BreadcrumbList
        className="flex-nowrap overflow-hidden"
        ref={collapseState.contentRef as React.Ref<HTMLOListElement>}
      >
        {visible.map((v, i) => {
          const isVisuallyLast = i === visible.length - 1;
          if (v.kind === 'ellipsis') {
            const hiddenSegments = Array.from(collapseState.hiddenIndexes)
              .sort((a, b) => a - b)
              .map((idx) => segments[idx])
              .filter((s): s is TrailSegment => Boolean(s));
            return (
              <React.Fragment key={`ellipsis-${v.index}`}>
                <BreadcrumbItem>
                  <HiddenSegmentsPopover segments={hiddenSegments} />
                </BreadcrumbItem>
                {!isVisuallyLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          }
          const seg = segments[v.index];
          if (!seg) return null;
          const isLast = v.index === lastIndex;
          return (
            <React.Fragment key={`${seg.kind}-${seg.href}`}>
              <BreadcrumbItem className="min-w-0">
                <SegmentContent
                  seg={seg}
                  isLast={isLast}
                  manifest={manifest}
                  switchableModules={switchableModules}
                  sites={sites}
                  activeSiteId={activeSiteId}
                  organizations={organizations}
                  activeOrgId={activeOrgId}
                />
              </BreadcrumbItem>
              {!isVisuallyLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SegmentContent({
  seg,
  isLast,
  manifest,
  switchableModules,
  sites,
  activeSiteId,
  organizations,
  activeOrgId,
}: {
  seg: TrailSegment;
  isLast: boolean;
  manifest: Manifest | undefined;
  switchableModules: Manifest[];
  sites: Property[];
  activeSiteId: string | null;
  organizations: OrgMembership[];
  activeOrgId: string | null;
}) {
  if (seg.kind === 'tenant') {
    return (
      <WorkspaceSegment
        tenantName={seg.label}
        organizations={organizations}
        activeOrgId={activeOrgId}
      />
    );
  }
  if (seg.kind === 'site') {
    return <SiteSegment sites={sites} activeSiteId={activeSiteId} />;
  }
  if (seg.kind === 'module' && manifest) {
    // Module stays interactive even when it is the current page — switching is
    // its whole purpose.
    return <ModuleSplitControl manifest={manifest} switchableModules={switchableModules} />;
  }
  // Section: navigate-only. The current page is non-interactive text.
  return isLast ? (
    <BreadcrumbPage className="truncate">{seg.label}</BreadcrumbPage>
  ) : (
    <BreadcrumbLink asChild className="truncate">
      <Link href={seg.href}>{seg.label}</Link>
    </BreadcrumbLink>
  );
}

// Workspace control (docs/114 §A.4). Always carries Team, settings + sign out.
// When the user belongs to more than one org it also becomes a switcher: pick
// another workspace (sets the active org → re-mints the JWT tid/role) or jump to
// the full accounts picker.
function WorkspaceSegment({
  tenantName,
  organizations,
  activeOrgId,
}: {
  tenantName: string;
  organizations: OrgMembership[];
  activeOrgId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const multi = organizations.length > 1;

  const switchTo = (organizationId: string) => {
    if (organizationId === activeOrgId) return;
    startTransition(async () => {
      await switchOrganization(organizationId);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0" disabled={pending}>
          <span className="min-w-0 truncate">{tenantName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {multi ? (
          <>
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((o) => (
              <DropdownMenuItem key={o.organizationId} onSelect={() => switchTo(o.organizationId)}>
                <Building2 className="h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {o.organizationId === activeOrgId ? <Check className="h-4 w-4 shrink-0" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <Link href="/accounts">
                <Building2 className="h-4 w-4" />
                All accounts
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <DropdownMenuLabel>{tenantName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings/team">
            <Users className="h-4 w-4" />
            Team
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon className="h-4 w-4" />
            Workspace settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/sign-out">
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Site control (docs/49 §6): the active web property + a switcher to change
// which site you're editing. Selecting one sets the active-site cookie via the
// shared server action, then refreshes so every site-scoped surface (the
// Builder) reloads for the chosen site.
function SiteSegment({ sites, activeSiteId }: { sites: Property[]; activeSiteId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const active = sites.find((s) => s.id === activeSiteId) ?? sites[0];

  const switchTo = (id: string) => {
    if (id === active?.id) return;
    startTransition(async () => {
      await setActiveSite(id);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0" disabled={pending}>
          <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 truncate">{active?.name ?? 'Site'}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => switchTo(s.id)}>
            <span className="min-w-0 flex-1 truncate">
              {s.name}
              {s.isPrimary ? ' · primary' : ''}
            </span>
            {s.id === active?.id ? <Check className="h-4 w-4 shrink-0" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/sites">
            <SettingsIcon className="h-4 w-4" />
            Manage sites
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Split control: label → module home, ▾ → module switcher.
function ModuleSplitControl({
  manifest,
  switchableModules,
}: {
  manifest: Manifest;
  switchableModules: Manifest[];
}) {
  return (
    <ModuleProvider module={manifest.id} className="contents">
      <span className="inline-flex min-w-0 items-center">
        <BreadcrumbLink asChild className="truncate">
          <Link href={manifest.routePrefix} style={{ color: 'var(--color-module)' }}>
            {manifest.label}
          </Link>
        </BreadcrumbLink>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              shape="square"
              size="sm"
              className="ml-0.5"
              aria-label={`Switch module — current: ${manifest.label}`}
              style={{ color: 'var(--color-module)' }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Switch module</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {switchableModules.map((m) => {
              const Icon = m.icon;
              const active = m.id === manifest.id;
              return (
                <DropdownMenuItem key={m.id} asChild>
                  <Link href={m.routePrefix}>
                    <ModuleProvider module={m.id} className="contents">
                      <Icon className="h-4 w-4" style={{ color: 'var(--color-module)' }} />
                    </ModuleProvider>
                    <span className="min-w-0 flex-1 truncate">{m.label}</span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </ModuleProvider>
  );
}

// ── Hidden-segments popover (desktop overflow) ─────────────

function HiddenSegmentsPopover({ segments }: { segments: TrailSegment[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Show hidden segments">
          <BreadcrumbEllipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {segments.map((s) => (
          <DropdownMenuItem key={`${s.kind}-${s.href}`} asChild>
            <Link href={s.href}>{s.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Mobile condensed switcher ──────────────────────────────

function MobileSwitcher({
  tenantName,
  manifest,
  activeSectionHref,
  switchableModules,
  sites,
  activeSiteId,
  organizations,
  activeOrgId,
}: {
  tenantName: string;
  manifest: Manifest | undefined;
  activeSectionHref: string | null;
  switchableModules: Manifest[];
  sites: Property[];
  activeSiteId: string | null;
  organizations: OrgMembership[];
  activeOrgId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  // Close the sheet after a navigation completes.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0];
  const switchSite = (id: string) => {
    setOpen(false);
    if (id === activeSite?.id) return;
    startTransition(async () => {
      await setActiveSite(id);
      router.refresh();
    });
  };

  const multiOrg = organizations.length > 1;
  const switchOrg = (id: string) => {
    setOpen(false);
    if (id === activeOrgId) return;
    startTransition(async () => {
      await switchOrganization(id);
      router.refresh();
    });
  };

  const chipLabel = manifest?.label ?? tenantName;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="max-w-full min-w-0"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        {manifest ? (
          <ModuleProvider module={manifest.id} className="contents">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--color-module)' }}
            />
          </ModuleProvider>
        ) : null}
        <span className="min-w-0 truncate">{chipLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="bottom" className="h-auto max-h-[85vh] rounded-t-xl pt-2">
          <DrawerTitle className="sr-only">Navigate</DrawerTitle>
          <div className="overflow-y-auto pb-2">
            <Stack gap={1}>
              <SheetGroupLabel>Workspace</SheetGroupLabel>
              {multiOrg ? (
                organizations.map((o) => (
                  <SheetRow
                    key={o.organizationId}
                    onClick={() => switchOrg(o.organizationId)}
                    active={o.organizationId === activeOrgId}
                    icon={<Building2 className="h-4 w-4" />}
                  >
                    {o.name}
                  </SheetRow>
                ))
              ) : (
                <SheetRow active>{tenantName}</SheetRow>
              )}
              {multiOrg ? (
                <SheetRow href="/accounts" icon={<Building2 className="h-4 w-4" />}>
                  All accounts
                </SheetRow>
              ) : null}
              <SheetRow href="/settings/team" icon={<Users className="h-4 w-4" />}>
                Team
              </SheetRow>
              <SheetRow href="/settings" icon={<SettingsIcon className="h-4 w-4" />}>
                Workspace settings
              </SheetRow>
              <SheetRow href="/sign-out" icon={<LogOut className="h-4 w-4" />}>
                Sign out
              </SheetRow>

              {sites.length > 0 ? (
                <>
                  <SheetGroupLabel>Site</SheetGroupLabel>
                  {sites.map((s) => (
                    <SheetRow
                      key={s.id}
                      onClick={() => switchSite(s.id)}
                      active={s.id === activeSite?.id}
                      icon={<Globe className="h-4 w-4" />}
                    >
                      {s.name}
                      {s.isPrimary ? ' · primary' : ''}
                    </SheetRow>
                  ))}
                  <SheetRow href="/settings/sites" icon={<SettingsIcon className="h-4 w-4" />}>
                    Manage sites
                  </SheetRow>
                </>
              ) : null}

              {switchableModules.length > 0 ? (
                <>
                  <SheetGroupLabel>Modules</SheetGroupLabel>
                  {switchableModules.map((m) => {
                    const Icon = m.icon;
                    return (
                      <SheetRow
                        key={m.id}
                        href={m.routePrefix}
                        active={m.id === manifest?.id}
                        icon={
                          <ModuleProvider module={m.id} className="contents">
                            <Icon className="h-4 w-4" style={{ color: 'var(--color-module)' }} />
                          </ModuleProvider>
                        }
                      >
                        {m.label}
                      </SheetRow>
                    );
                  })}
                </>
              ) : null}

              {manifest && manifest.sections.length > 0 ? (
                <>
                  <SheetGroupLabel>{manifest.label} pages</SheetGroupLabel>
                  {manifest.sections.map((s) => {
                    const Icon = s.icon;
                    return (
                      <SheetRow
                        key={s.id}
                        href={s.href}
                        active={s.href === activeSectionHref}
                        icon={<Icon className="h-4 w-4" />}
                      >
                        {s.label}
                      </SheetRow>
                    );
                  })}
                </>
              ) : null}
            </Stack>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function SheetGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" variant="muted" weight="medium" className="px-3 pt-3 pb-1">
      {children}
    </Text>
  );
}

// A full-width touch row. With `href` it navigates; with `onClick` it runs an
// action (e.g. switch site); with neither it's a static (current-context) row.
// `active` shows a trailing check.
function SheetRow({
  href,
  onClick,
  icon,
  active = false,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  const body = (
    <>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <Text as="span" size="sm" className="min-w-0 flex-1 truncate">
        {children}
      </Text>
      {active ? <Check className="h-4 w-4 shrink-0" /> : null}
    </>
  );

  if (onClick) {
    return (
      <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3" onClick={onClick}>
        {body}
      </Button>
    );
  }

  if (!href) {
    // Static current-context row (no nav). `flex-1` on the label pushes the
    // check to the end, so no explicit gap is needed.
    return <div className="flex h-10 items-center px-3">{body}</div>;
  }

  return (
    <Button variant="ghost" asChild className="h-10 w-full justify-start gap-3 px-3">
      <Link href={href}>{body}</Link>
    </Button>
  );
}

// ── Responsive collapse (desktop) ──────────────────────────

interface CollapseState {
  hiddenIndexes: Set<number>;
  containerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
}

function useResponsiveCollapse(segmentCount: number): CollapseState {
  const containerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLElement | null>(null);
  const [hiddenCount, setHiddenCount] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const containerWidth = container.clientWidth;
      const contentWidth = contentRef.current?.scrollWidth ?? 0;
      if (contentWidth > containerWidth && segmentCount > 2) {
        // Hide one more middle segment per overflow tick, up to N-2 (always
        // keep first + last). We do not measure precise per-segment widths;
        // the layout reflows on the next ResizeObserver fire and converges.
        setHiddenCount((prev) => Math.min(prev + 1, segmentCount - 2));
      } else if (contentWidth < containerWidth * 0.85 && hiddenCount > 0) {
        // Generous expand threshold so we don't oscillate at the boundary.
        setHiddenCount((prev) => Math.max(0, prev - 1));
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [segmentCount, hiddenCount]);

  // Indexes 1..(hiddenCount) are hidden (always preserving 0 and last).
  const hiddenIndexes = React.useMemo(() => {
    const s = new Set<number>();
    for (let i = 1; i <= hiddenCount; i += 1) s.add(i);
    return s;
  }, [hiddenCount]);

  return { hiddenIndexes, containerRef, contentRef };
}
