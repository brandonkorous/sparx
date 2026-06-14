'use client';

import {
  Badge,
  Card,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

import { BlueprintCardActions } from '../../../marketplace/_components/blueprint-card-actions';

// Client wrapper for the installed-blueprints list (docs/54). SelectionList takes
// render functions (columns/card) that can't cross the server→client boundary, so
// the server page hands serializable rows + `view` here and this builds both views.
// Read-only at the list level — `selectable={false}` (no checkboxes / bulk bar);
// each row's lifecycle controls live in <BlueprintCardActions> (its own client
// island), preserved in both the table (an actions column) and the card body.

export interface BlueprintListItem {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: string;
  preview?: string;
  contents: {
    products: number;
    categories: number;
    collections: number;
    content: number;
    pages: number;
    emails: number;
    components: number;
    theme: string;
    hasLayout: boolean;
  };
  install: {
    id: string;
    status: string;
    version: string;
    updateAvailable: boolean;
  } | null;
}

interface BlueprintsListProps {
  rows: BlueprintListItem[];
  view: 'table' | 'card';
  canInstall: boolean;
}

export function BlueprintsList({ rows, view, canInstall }: BlueprintsListProps) {
  const actions = (bp: BlueprintListItem) => (
    <BlueprintCardActions
      blueprintKey={bp.key}
      blueprintName={bp.name}
      latestVersion={bp.version}
      install={bp.install}
      canInstall={canInstall}
    />
  );

  const contentBadges = (bp: BlueprintListItem) => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{bp.contents.products} products</Badge>
      <Badge variant="outline">{bp.contents.content} content</Badge>
      <Badge variant="outline">{bp.contents.pages} pages</Badge>
      <Badge variant="outline">{bp.contents.emails} emails</Badge>
      <Badge variant="outline">{bp.contents.components} components</Badge>
      <Badge variant="outline">Theme: {bp.contents.theme}</Badge>
    </div>
  );

  const columns: SelectionColumn<BlueprintListItem>[] = [
    {
      header: 'Blueprint',
      cell: (bp) => (
        <Stack gap={1} className="min-w-0">
          <Text size="sm" weight="medium" className="truncate">
            {bp.name}
          </Text>
          <Text size="xs" variant="muted" className="line-clamp-2">
            {bp.summary}
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Vertical',
      cell: (bp) => <Badge variant="soft">{bp.vertical}</Badge>,
    },
    {
      header: 'Includes',
      cell: contentBadges,
    },
    {
      header: 'Version',
      align: 'right',
      cell: (bp) => (
        <Text size="sm" variant="muted">
          v{bp.install?.version ?? bp.version}
        </Text>
      ),
    },
    {
      header: 'Status',
      align: 'right',
      cell: (bp) => <div className="flex justify-end">{actions(bp)}</div>,
    },
  ];

  const card: SelectionCard<BlueprintListItem> = {
    title: () => null,
    render: (bp) => (
      <Card variant="module" padding="none" className="overflow-hidden">
        {bp.preview ? (
          <img
            src={bp.preview}
            alt={`${bp.name} preview`}
            className="aspect-[16/10] w-full border-b border-[var(--color-border)] object-cover object-top"
          />
        ) : null}
        <Stack gap={3} className="p-4">
          <Stack direction="row" align="center" gap={2} className="justify-between">
            <Text size="md" weight="medium" className="truncate">
              {bp.name}
            </Text>
            <Badge variant="soft">{bp.vertical}</Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {bp.summary}
          </Text>
          {contentBadges(bp)}
          {actions(bp)}
        </Stack>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(bp) => bp.key}
      getRowLabel={(bp) => bp.name}
      entityLabelPlural="blueprints"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
