// Customers — the CRM module's surfaces.

import {
  BarChart3,
  Building2,
  Copy,
  Filter,
  ListChecks,
  Receipt,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { cell, createEntityListSurface } from '../../../surfaces/entity-list';
import { stub } from './stub';
import type { CustomerRow, NamedRow } from './rows';

export const CRM_SURFACES: SurfaceDefinition[] = [
  /* ── People ────────────────────────────────────────────────────────────── */
  {
    key: 'crm.customers.list',
    title: 'Customers',
    module: 'crm',
    icon: Users,
    section: 'People',
    order: 10,
    keywords: ['contacts', 'buyers', 'clients'],
    component: createEntityListSurface<CustomerRow>({
      path: '/v1/crm/customers',
      queryKey: ['crm', 'customers'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search customers…',
      emptyTitle: 'No customers yet',
      emptyBody: 'Everyone who buys from you or gets added by hand appears here.',
      emptyIcon: Users,
      columns: [
        { key: 'name', header: 'Name', render: (row) => cell.text(row.name) },
        { key: 'email', header: 'Email', render: (row) => cell.text(row.email) },
        { key: 'company', header: 'Company', render: (row) => cell.text(row.company) },
      ],
    }),
  },
  {
    key: 'crm.accounts.list',
    title: 'Wholesale accounts',
    module: 'crm',
    icon: Building2,
    section: 'People',
    order: 11,
    keywords: ['b2b', 'trade', 'companies'],
    component: createEntityListSurface<NamedRow>({
      path: '/v1/crm/b2b-accounts',
      queryKey: ['crm', 'b2b-accounts'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search accounts…',
      emptyTitle: 'No wholesale accounts yet',
      emptyBody: 'Businesses that buy from you at agreed prices live here.',
      emptyIcon: Building2,
      columns: [{ key: 'name', header: 'Name', render: (row) => cell.text(row.name) }],
    }),
  },
  stub({
    key: 'crm.segments.list',
    title: 'Segments',
    module: 'crm',
    icon: Filter,
    section: 'People',
    order: 12,
    keywords: ['groups', 'lists', 'audience'],
    body: 'A segment is a saved group of customers who share something — big spenders, or everyone who hasn’t bought in a year.',
  }),
  stub({
    key: 'crm.duplicates.list',
    title: 'Duplicates',
    module: 'crm',
    icon: Copy,
    section: 'People',
    order: 13,
    keywords: ['merge', 'cleanup', 'same person'],
    body: 'Duplicates finds the same person entered twice so you can merge them into one record.',
  }),

  /* ── Sales ─────────────────────────────────────────────────────────────── */
  {
    key: 'crm.deals.list',
    title: 'Deals',
    module: 'crm',
    icon: Target,
    section: 'Sales',
    order: 20,
    keywords: ['pipeline', 'opportunities'],
    component: createEntityListSurface<NamedRow>({
      path: '/v1/crm/deals',
      queryKey: ['crm', 'deals'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search deals…',
      emptyTitle: 'No deals yet',
      emptyBody: 'Deals track a sale you are working on, from first contact to close.',
      emptyIcon: Target,
      columns: [{ key: 'name', header: 'Name', render: (row) => cell.text(row.name ?? row.title) }],
    }),
  },
  stub({
    key: 'crm.pipelines.list',
    title: 'Pipelines',
    module: 'crm',
    icon: Workflow,
    section: 'Sales',
    order: 21,
    keywords: ['stages', 'process'],
    body: 'A pipeline is the set of stages a deal moves through, so you can name your own way of winning work.',
  }),
  {
    key: 'crm.tasks.list',
    title: 'Tasks',
    module: 'crm',
    icon: ListChecks,
    section: 'Sales',
    order: 22,
    keywords: ['todo', 'follow up', 'reminders'],
    component: createEntityListSurface<NamedRow>({
      path: '/v1/crm/tasks',
      queryKey: ['crm', 'tasks'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search tasks…',
      emptyTitle: 'No tasks yet',
      emptyBody: 'Things you need to do for a customer or deal show up here.',
      emptyIcon: ListChecks,
      columns: [
        { key: 'title', header: 'Task', render: (row) => cell.text(row.title ?? row.name) },
      ],
    }),
  },
  stub({
    key: 'crm.orders.list',
    title: 'Customer orders',
    module: 'crm',
    icon: Receipt,
    section: 'Sales',
    order: 23,
    keywords: ['history', 'purchases'],
    body: 'The same orders as Selling, seen from the customer’s side — what this person has bought from you.',
  }),

  /* ── Reporting ─────────────────────────────────────────────────────────── */
  stub({
    key: 'crm.reports',
    title: 'Reports',
    module: 'crm',
    icon: BarChart3,
    section: 'Reporting',
    order: 30,
    keywords: ['analytics', 'retention', 'value'],
    body: 'Reports show how your customer base is doing — who is worth the most, and who is drifting away.',
  }),
];
