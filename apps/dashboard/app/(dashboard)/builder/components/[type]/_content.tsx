import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import type {
  ComponentDto,
  ComponentUsageDto,
  ComponentVersionDto,
  PropKind,
} from '@sparx/builder-schemas';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';
import { boxAxesFor, type BoxAxis, type PropSpec } from '../../_builder/registry';
import {
  CARDINALITY_LABELS,
  GROUP_LABELS,
  KIND_LABELS,
  MODULE_LABELS,
  boundCardinalities,
  getComponentDef,
  summaryOf,
  surfaceLabel,
  type ComponentDef,
} from '../_lib/catalog';
import { LucideByName } from '../_lib/lucide-by-name';
import { CopyComponentButton } from '../_components/copy-component-button';
import { DeleteComponentButton } from '../_components/delete-component-button';
import { UpgradePlacementsButton } from '../_components/upgrade-placements-button';

// Detail for one catalog component (docs/34 §3, Record Detail). A SYSTEM
// component (the in-code registry) renders a read-only reference + a "Copy"
// action that seeds a tenant component from it. A TENANT component (docs/53)
// renders its identity + fields + a Delete action. Rendered both at
// /builder/components/[type] and in the dashboard drawer/modal via the
// detail-slot registry; `id` is the system `type` or the custom component key.

interface Props {
  id: string;
}

const CONTROL_LABELS: Record<PropSpec['control'], string> = {
  text: 'Text',
  textarea: 'Multi-line text',
  richtext: 'Rich text',
  select: 'Dropdown',
  buttongroup: 'Choice',
  switch: 'Toggle',
  icon: 'Icon picker',
  linktarget: 'Link target',
};

const PROP_KIND_LABELS: Record<PropKind, string> = {
  text: 'Text',
  richtext: 'Rich text',
  url: 'URL',
  image: 'Image',
  number: 'Number',
  boolean: 'Toggle',
};

const BOX_AXIS_LABELS: Record<BoxAxis, string> = {
  width: 'Width',
  height: 'Height',
  padding: 'Padding',
  surface: 'Surface',
  background: 'Background',
  align: 'Alignment',
  position: 'Position',
  visibility: 'Visibility',
};

const CARDINALITY_MEANINGS: Record<string, string> = {
  scalar: 'a single value such as text, a number, or an image',
  object: 'one record, exposing its fields',
  array: 'a list — the component iterates over each item',
  empty: 'renders even when nothing is bound',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-baseline gap-x-4 gap-y-1">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Custom keys are lowercase (^[a-z…]); system types are PascalCase — so a
// registry hit unambiguously means "system", and anything else is a tenant
// component fetched from api-rest.
export async function ComponentDetailContent({ id }: Props) {
  const def = getComponentDef(id);
  if (def) return <SystemComponentDetail def={def} />;

  let component: ComponentDto;
  try {
    component = await api.get<ComponentDto>(`/v1/builder/components/${encodeURIComponent(id)}`);
  } catch (err) {
    if ((err as ApiRestError)?.status === 404) notFound();
    throw err;
  }
  // Version history + where-used (docs/53 P-E / §6). Best-effort: a failed read
  // just hides the panel rather than 500-ing the detail.
  const [versions, usage] = await Promise.all([
    api
      .get<{ versions: ComponentVersionDto[] }>(
        `/v1/builder/components/${encodeURIComponent(id)}/versions`
      )
      .then((r) => r.versions)
      .catch(() => [] as ComponentVersionDto[]),
    api
      .get<ComponentUsageDto>(`/v1/builder/components/${encodeURIComponent(id)}/usages`)
      .catch(() => null),
  ]);
  return <CustomComponentDetail component={component} versions={versions} usage={usage} />;
}

// ── System component (read-only reference + Copy) ─────────────────────────────

function SystemComponentDetail({ def }: { def: ComponentDef }) {
  const Icon = def.icon;
  const cards = boundCardinalities(def);
  const acceptsEmpty = def.accepts.includes('empty');
  const axes = boxAxesFor(def);

  return (
    <Stack gap={6}>
      <Stack direction="row" align="start" justify="between" gap={3} wrap>
        <Stack direction="row" align="center" gap={3} wrap className="min-w-0">
          <Icon className="text-module h-7 w-7 shrink-0" aria-hidden />
          <Stack gap={2} className="min-w-0">
            <Stack direction="row" align="center" gap={3} wrap>
              <Heading level={1}>{def.label}</Heading>
              <Badge color="info" variant="soft" size="sm">
                {KIND_LABELS[def.kind]}
              </Badge>
              <Badge color="module" variant="soft" size="sm">
                {GROUP_LABELS[def.group]}
              </Badge>
              {def.module ? (
                <Badge color="neutral" variant="soft" size="sm">
                  {MODULE_LABELS[def.module]}
                </Badge>
              ) : null}
            </Stack>
            <Text variant="muted">{summaryOf(def)}</Text>
          </Stack>
        </Stack>
        <CopyComponentButton systemType={def.type} label={def.label} />
      </Stack>

      {/* Overview */}
      <Card>
        <CardHeader>
          <Heading level={3}>Overview</Heading>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            <Field label="Type">
              <Text size="sm" className="font-mono">
                {def.type}
              </Text>
            </Field>
            <Field label="Kind">
              <Text size="sm">
                {def.kind === 'container'
                  ? 'Container — arranges child nodes inside it.'
                  : 'Leaf — renders its own content.'}
              </Text>
            </Field>
            <Field label="Group">
              <Text size="sm">{GROUP_LABELS[def.group]}</Text>
            </Field>
            <Field label="Module">
              <Text size="sm">{def.module ? MODULE_LABELS[def.module] : 'None (primitive)'}</Text>
            </Field>
            <Field label="Surfaces">
              <Text size="sm">{surfaceLabel(def)}</Text>
            </Field>
            <Field label="Binding">
              <Text size="sm">{def.bindable ? 'Can bind to data' : 'Static (no binding)'}</Text>
            </Field>
          </Stack>
        </CardContent>
      </Card>

      {/* Data binding */}
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Data binding</Heading>
            <CardDescription>
              {def.bindable
                ? 'Connect this component to a field from your content types or modules. It accepts the shapes below; everything else stays as authored.'
                : 'This component renders fixed, authored content — it does not bind to data.'}
            </CardDescription>
          </Stack>
        </CardHeader>
        {def.bindable && (cards.length > 0 || acceptsEmpty) ? (
          <CardContent>
            <Stack gap={3}>
              {cards.map((c) => (
                <Stack key={c} direction="row" align="center" gap={3}>
                  <Badge color="module" variant="soft" className="shrink-0">
                    {CARDINALITY_LABELS[c]}
                  </Badge>
                  <Text size="sm" variant="muted">
                    {CARDINALITY_MEANINGS[c]}
                  </Text>
                </Stack>
              ))}
              {acceptsEmpty ? (
                <Text size="sm" variant="muted">
                  Also {CARDINALITY_MEANINGS.empty}.
                </Text>
              ) : null}
            </Stack>
          </CardContent>
        ) : null}
      </Card>

      {/* Configuration */}
      <Card padding="none">
        <CardHeader className="px-6 pt-6">
          <Stack gap={1}>
            <Heading level={3}>Configuration</Heading>
            <CardDescription>
              {def.props.length > 0
                ? 'Settings exposed in the inspector when this component is selected.'
                : 'No settings — this component renders from its content and layout alone.'}
            </CardDescription>
          </Stack>
        </CardHeader>
        {def.props.length > 0 ? (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting</TableHead>
                  <TableHead>Control</TableHead>
                  <TableHead>Options</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {def.props.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>
                      <Stack gap={1}>
                        <Text size="sm" className="font-medium">
                          {p.label}
                        </Text>
                        <Text size="xs" variant="muted" className="font-mono">
                          {p.key}
                        </Text>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {CONTROL_LABELS[p.control]}
                      </Text>
                    </TableCell>
                    <TableCell>
                      {p.options && p.options.length > 0 ? (
                        <Stack direction="row" align="center" gap={1} wrap>
                          {p.options.map((o) => (
                            <Badge key={o.value} color="neutral" variant="soft" size="sm">
                              {o.label}
                            </Badge>
                          ))}
                        </Stack>
                      ) : (
                        <Text size="sm" variant="muted">
                          —
                        </Text>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>

      {/* Composition & layout */}
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Composition &amp; layout</Heading>
            <CardDescription>
              How this component nests and which layout controls it exposes.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            <Field label="Children">
              <Text size="sm">
                {def.kind === 'container'
                  ? 'Holds child components.'
                  : def.acceptsChildren
                    ? 'A leaf that can still nest children (e.g. an icon beside its label).'
                    : 'A leaf — it holds no children.'}
              </Text>
            </Field>
            <Field label="Layout controls">
              {axes.length > 0 ? (
                <Stack direction="row" align="center" gap={1} wrap>
                  {axes.map((a) => (
                    <Badge key={a} color="neutral" variant="soft" size="sm">
                      {BOX_AXIS_LABELS[a]}
                    </Badge>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" variant="muted">
                  None
                </Text>
              )}
            </Field>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ── Tenant component (identity + fields + Delete) ─────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function CustomComponentDetail({
  component,
  versions,
  usage,
}: {
  component: ComponentDto;
  versions: ComponentVersionDto[];
  usage: ComponentUsageDto | null;
}) {
  const surfacesLabel =
    component.surfaces.includes('page') && component.surfaces.includes('site')
      ? 'Page & layout'
      : component.surfaces.includes('site')
        ? 'Site layout'
        : 'Page';

  return (
    <Stack gap={6}>
      {/* Edit + Delete are lifecycle actions — teleport into the shared detail
          chrome's header (drawer/modal chrome or the full-page shell), parity
          with every other entity's Edit/Archive/Delete controls. */}
      <DetailHeaderSlot>
        <Button asChild size="sm" variant="soft">
          <a href={`/builder/components/${component.key}/edit`}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </a>
        </Button>
        <DeleteComponentButton
          componentKey={component.key}
          name={component.name}
          redirectTo="/builder/components"
        />
      </DetailHeaderSlot>

      <Stack direction="row" align="start" justify="between" gap={3} wrap>
        <Stack direction="row" align="center" gap={3} wrap className="min-w-0">
          <LucideByName name={component.icon} className="text-module h-7 w-7 shrink-0" />
          <Stack gap={2} className="min-w-0">
            <Stack direction="row" align="center" gap={3} wrap>
              <Heading level={1}>{component.name}</Heading>
              <Badge color="module" variant="soft" size="sm">
                Custom
              </Badge>
              <Badge color="info" variant="soft" size="sm">
                {GROUP_LABELS[component.group]}
              </Badge>
              <Badge color="neutral" variant="soft" size="sm">
                v{component.latestVersion}
              </Badge>
            </Stack>
            <Text variant="muted">{component.description ?? 'A component you built.'}</Text>
          </Stack>
        </Stack>
      </Stack>

      {/* Overview */}
      <Card>
        <CardHeader>
          <Heading level={3}>Overview</Heading>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            <Field label="Key">
              <Text size="sm" className="font-mono">
                custom:{component.key}
              </Text>
            </Field>
            <Field label="Group">
              <Text size="sm">{GROUP_LABELS[component.group]}</Text>
            </Field>
            <Field label="Surfaces">
              <Text size="sm">{surfacesLabel}</Text>
            </Field>
            <Field label="Version">
              <Text size="sm">v{component.latestVersion} (latest)</Text>
            </Field>
          </Stack>
        </CardContent>
      </Card>

      {/* Fields (parameterization — docs/53 §5) */}
      <Card padding="none">
        <CardHeader className="px-6 pt-6">
          <Stack gap={1}>
            <Heading level={3}>Fields</Heading>
            <CardDescription>
              {component.propSpec.length > 0
                ? 'The configurable slots each placement of this component can fill.'
                : 'No configurable fields — every placement renders the same. Edit the component to add fields and structure.'}
            </CardDescription>
          </Stack>
        </CardHeader>
        {component.propSpec.length > 0 ? (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {component.propSpec.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>
                      <Stack gap={1}>
                        <Text size="sm" className="font-medium">
                          {p.label}
                        </Text>
                        <Text size="xs" variant="muted" className="font-mono">
                          {p.key}
                        </Text>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {PROP_KIND_LABELS[p.kind]}
                      </Text>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>

      {/* Used on (where-used — docs/53 §6) */}
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Used on</Heading>
            <CardDescription>
              The pages and layouts that place this component. It can’t be deleted while it’s in
              use.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          {usage && usage.total > 0 ? (
            <Stack gap={4}>
              <Stack direction="row" align="center" gap={2} wrap>
                {usage.pages.map((p) => (
                  <Badge key={`p:${p.id}`} color="neutral" variant="soft" size="sm">
                    {p.name}
                  </Badge>
                ))}
                {usage.layouts.map((l) => (
                  <Badge key={`l:${l.id}`} color="module" variant="soft">
                    {l.name} (layout)
                  </Badge>
                ))}
              </Stack>
              <UpgradePlacementsButton
                componentKey={component.key}
                latestVersion={component.latestVersion}
                outdated={usage.pinnedVersions.some((v) => v < component.latestVersion)}
              />
            </Stack>
          ) : (
            <Text size="sm" variant="muted">
              Not placed anywhere yet.
            </Text>
          )}
        </CardContent>
      </Card>

      {/* Version history (docs/53 §4 / P-E) */}
      {versions.length > 0 ? (
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <Stack gap={1}>
              <Heading level={3}>Version history</Heading>
              <CardDescription>
                Each save is an immutable version. Placements pin a version and update on your
                terms.
              </CardDescription>
            </Stack>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.version}>
                    <TableCell>
                      <Stack direction="row" align="center" gap={2}>
                        <Text size="sm" className="font-medium">
                          v{v.version}
                        </Text>
                        {v.version === component.latestVersion ? (
                          <Badge color="module" variant="soft" className="text-xs">
                            Latest
                          </Badge>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {fmtDate(v.createdAt)}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {v.propSpec.length}
                      </Text>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
