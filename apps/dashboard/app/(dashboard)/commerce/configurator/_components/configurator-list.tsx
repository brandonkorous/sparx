'use client';

import Link from 'next/link';

import { Badge } from 'silicaui-react';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  statusLabel,
  statusTone,
} from '@sparx/ui';

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
    <Badge color={statusTone(t.status)} variant="soft" size="sm">
      {statusLabel(t.status)}
    </Badge>
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
    subtitle: (t) => <span className="text-base-content/70 text-xs">{productLink(t)}</span>,
    badge: statusBadge,
    body: (t) => (
      <p className="text-base-content/70 text-xs">
        {t.optionCount} option{t.optionCount === 1 ? '' : 's'} · {t.ruleCount} rule
        {t.ruleCount === 1 ? '' : 's'} · {t.addOnCount} add-on{t.addOnCount === 1 ? '' : 's'}
      </p>
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
