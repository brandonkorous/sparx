'use client';

import Link from 'next/link';

import { Badge, SelectionList, type SelectionCard, type SelectionColumn, Text } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the configurator-templates list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); the template name opens the
// template editor via EntityRowLink, the product name links to the product.

export interface ConfigurationTemplateRow {
  id: string;
  productId: string;
  productTitle: string;
  name: string;
  description: string | null;
  status: string;
  optionCount: number;
  ruleCount: number;
  addOnCount: number;
  updatedAt: string;
}

interface ConfiguratorListProps {
  templates: ConfigurationTemplateRow[];
  view: 'table' | 'card';
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline'> = {
  active: 'success',
  draft: 'outline',
  archived: 'warning',
};

export function ConfiguratorList({ templates, view }: ConfiguratorListProps) {
  const productLink = (t: ConfigurationTemplateRow) => (
    <Link href={`/commerce/products/${t.productId}`} className="hover:text-[var(--module-active)]">
      {t.productTitle}
    </Link>
  );

  const templateLink = (t: ConfigurationTemplateRow, className?: string) => (
    <EntityRowLink
      href={`/commerce/configurator/${t.id}`}
      entityType="configurator-template"
      entityId={t.id}
      className={className ?? 'hover:text-[var(--module-active)]'}
    >
      {t.name}
    </EntityRowLink>
  );

  const statusBadge = (t: ConfigurationTemplateRow) => (
    <Badge color={STATUS_VARIANT[t.status] ?? 'outline'}>{t.status}</Badge>
  );

  const columns: SelectionColumn<ConfigurationTemplateRow>[] = [
    { header: 'Product', cell: productLink },
    { header: 'Template', cell: (t) => templateLink(t) },
    { header: 'Options', cell: (t) => t.optionCount },
    { header: 'Rules', cell: (t) => t.ruleCount },
    { header: 'Add-ons', cell: (t) => t.addOnCount },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<ConfigurationTemplateRow> = {
    title: (t) => templateLink(t, 'truncate hover:text-[var(--module-active)]'),
    subtitle: (t) => (
      <Text as="span" size="xs" variant="muted">
        {productLink(t)}
      </Text>
    ),
    badge: statusBadge,
    body: (t) => (
      <Text size="xs" variant="muted">
        {t.optionCount} option{t.optionCount === 1 ? '' : 's'} · {t.ruleCount} rule
        {t.ruleCount === 1 ? '' : 's'} · {t.addOnCount} add-on{t.addOnCount === 1 ? '' : 's'}
      </Text>
    ),
  };

  return (
    <SelectionList
      items={templates}
      view={view}
      getId={(t) => t.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
