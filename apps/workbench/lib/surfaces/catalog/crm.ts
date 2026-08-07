// Customers — the CRM module's surfaces.

import {
  BarChart3,
  Boxes,
  Building2,
  Clock,
  Copy,
  Filter,
  LifeBuoy,
  ListChecks,
  Mailbox as MailboxIcon,
  PhoneCall,
  Receipt,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { CustomersListSurface } from '../../../surfaces/crm/customers-list';
import { CustomerDetailSurface } from '../../../surfaces/crm/customer-detail';
import { WholesaleAccountsListSurface } from '../../../surfaces/crm/accounts-list';
import { AccountDetailSurface } from '../../../surfaces/crm/account-detail';
import { SegmentsListSurface } from '../../../surfaces/crm/segments-list';
import { SegmentDetailSurface } from '../../../surfaces/crm/segment-detail';
import { DuplicatesSurface } from '../../../surfaces/crm/duplicates';
import { DealsListSurface } from '../../../surfaces/crm/deals-list';
import { DealDetailSurface } from '../../../surfaces/crm/deal-detail';
import { PipelinesListSurface } from '../../../surfaces/crm/pipelines-list';
import { PipelineDetailSurface } from '../../../surfaces/crm/pipeline-detail';
import { TasksListSurface } from '../../../surfaces/crm/tasks-list';
import { TaskDetailSurface } from '../../../surfaces/crm/task-detail';
import { CustomerOrdersSurface } from '../../../surfaces/crm/customer-orders';
import { CrmReportsSurface } from '../../../surfaces/crm/reports';
import { ObjectTypesListSurface } from '../../../surfaces/crm/object-types-list';
import { ObjectTypeDetailSurface } from '../../../surfaces/crm/object-type-detail';
import { MailboxesListSurface } from '../../../surfaces/crm/mailboxes-list';
import { PhoneSystemsListSurface } from '../../../surfaces/crm/phone-systems-list';
import { TicketsListSurface } from '../../../surfaces/crm/tickets-list';
import { TicketDetailSurface } from '../../../surfaces/crm/ticket-detail';
import { SlaPoliciesSurface } from '../../../surfaces/crm/sla-policies';

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
    component: CustomersListSurface,
    createSurface: 'crm.customer.detail',
    createLabel: 'Add a customer',
  },
  {
    key: 'crm.customer.detail',
    title: 'Customer',
    module: 'crm',
    icon: Users,
    component: CustomerDetailSurface,
    // Opened from the list ({id:'new'} to add, {id} to manage). Adding one is
    // the same surface as managing one, so it is a pane, not a launcher entry.
    listed: false,
  },
  {
    key: 'crm.accounts.list',
    title: 'Wholesale accounts',
    module: 'crm',
    icon: Building2,
    section: 'People',
    order: 11,
    keywords: ['b2b', 'trade', 'companies'],
    component: WholesaleAccountsListSurface,
    createSurface: 'crm.account.detail',
    createLabel: 'Add an account',
  },
  {
    key: 'crm.account.detail',
    title: 'Wholesale account',
    module: 'crm',
    icon: Building2,
    component: AccountDetailSurface,
    listed: false,
  },
  {
    key: 'crm.segments.list',
    title: 'Segments',
    module: 'crm',
    icon: Filter,
    section: 'People',
    order: 12,
    keywords: ['groups', 'lists', 'audience'],
    component: SegmentsListSurface,
    createSurface: 'crm.segment.detail',
    createLabel: 'New segment',
  },
  {
    key: 'crm.segment.detail',
    title: 'Segment',
    module: 'crm',
    icon: Filter,
    component: SegmentDetailSurface,
    listed: false,
  },
  {
    key: 'crm.duplicates.list',
    title: 'Duplicates',
    module: 'crm',
    icon: Copy,
    section: 'People',
    order: 13,
    keywords: ['merge', 'cleanup', 'same person'],
    component: DuplicatesSurface,
  },

  /* ── Sales ─────────────────────────────────────────────────────────────── */
  {
    key: 'crm.deals.list',
    title: 'Deals',
    module: 'crm',
    icon: Target,
    section: 'Sales',
    order: 20,
    keywords: ['pipeline', 'opportunities'],
    component: DealsListSurface,
    createSurface: 'crm.deal.detail',
    createLabel: 'New deal',
  },
  {
    key: 'crm.deal.detail',
    title: 'Deal',
    module: 'crm',
    icon: Target,
    component: DealDetailSurface,
    listed: false,
  },
  {
    key: 'crm.pipelines.list',
    title: 'Pipelines',
    module: 'crm',
    icon: Workflow,
    section: 'Sales',
    order: 21,
    keywords: ['stages', 'process'],
    component: PipelinesListSurface,
    createSurface: 'crm.pipeline.detail',
    createLabel: 'New pipeline',
  },
  {
    key: 'crm.pipeline.detail',
    title: 'Pipeline',
    module: 'crm',
    icon: Workflow,
    component: PipelineDetailSurface,
    listed: false,
  },
  {
    key: 'crm.tasks.list',
    title: 'Tasks',
    module: 'crm',
    icon: ListChecks,
    section: 'Sales',
    order: 22,
    keywords: ['todo', 'follow up', 'reminders'],
    component: TasksListSurface,
    createSurface: 'crm.task.detail',
    createLabel: 'New task',
  },
  {
    key: 'crm.task.detail',
    title: 'Task',
    module: 'crm',
    icon: ListChecks,
    component: TaskDetailSurface,
    listed: false,
  },
  {
    key: 'crm.orders.list',
    title: 'Customer orders',
    module: 'crm',
    icon: Receipt,
    section: 'Sales',
    order: 23,
    keywords: ['history', 'purchases'],
    // Commerce order data seen from the CRM side — reuses the commerce order data
    // layer and opens the real order detail. Wears the Commerce hue.
    component: CustomerOrdersSurface,
  },

  /* ── Support ───────────────────────────────────────────────────────────── */
  //
  // Its own section, not a corner of Sales. A request is somebody asking for
  // help, which is a different job from working a deal, and the person doing it
  // is often not the person selling.
  {
    key: 'crm.tickets.list',
    title: 'Requests',
    module: 'crm',
    icon: LifeBuoy,
    section: 'Support',
    order: 25,
    // What someone types when they are looking for this, which is rarely the
    // word we chose for it — "tickets", "helpdesk", and the thing they are
    // actually worried about ("overdue", "sla").
    keywords: [
      'tickets',
      'support',
      'helpdesk',
      'service',
      'issues',
      'complaints',
      'sla',
      'overdue',
    ],
    component: TicketsListSurface,
    createSurface: 'crm.ticket.detail',
    createLabel: 'New request',
  },
  {
    key: 'crm.ticket.detail',
    title: 'Request',
    module: 'crm',
    icon: LifeBuoy,
    component: TicketDetailSurface,
    // Opening one is the same surface as working one ({id:'new'} → {id}), so it
    // is a pane rather than a launcher entry.
    listed: false,
  },
  {
    key: 'crm.sla-policies',
    title: 'Response times',
    module: 'crm',
    icon: Clock,
    section: 'Support',
    order: 26,
    keywords: [
      'sla',
      'response time',
      'business hours',
      'opening hours',
      'targets',
      'promise',
      'reply time',
    ],
    component: SlaPoliciesSurface,
    // One promise per business — a second copy of this pane would show the same
    // thing and let two people save over each other.
    singleton: true,
  },

  /* ── Setting up ────────────────────────────────────────────────────────── */
  {
    key: 'crm.object-types.list',
    title: 'Record types',
    module: 'crm',
    icon: Boxes,
    section: 'Setting up',
    order: 40,
    keywords: ['custom fields', 'extra details', 'properties', 'record types', 'schema'],
    component: ObjectTypesListSurface,
    createSurface: 'crm.object-type.detail',
    createLabel: 'New record type',
  },
  {
    key: 'crm.object-type.detail',
    title: 'Record type',
    module: 'crm',
    icon: Boxes,
    component: ObjectTypeDetailSurface,
    // Adding one is the same surface as managing one ({key:'new'} → {key}), so
    // it is a pane rather than a launcher entry.
    listed: false,
  },
  {
    key: 'crm.mailboxes.list',
    title: 'Mailboxes',
    module: 'crm',
    icon: MailboxIcon,
    section: 'Setting up',
    order: 50,
    keywords: ['email', 'inbox', 'imap', 'connect email', 'gmail', 'outlook'],
    component: MailboxesListSurface,
    // One list of connected accounts — there is nothing per-instance to vary,
    // so a second copy would only ever show the same thing.
    singleton: true,
  },
  {
    key: 'crm.phone-systems.list',
    title: 'Phone systems',
    module: 'crm',
    icon: PhoneCall,
    section: 'Setting up',
    order: 60,
    // What someone actually types when the Call button is missing — they search
    // for the thing they want to do ("click to call"), or for their vendor.
    keywords: [
      'phone',
      'calls',
      'calling',
      'click to call',
      'voice',
      'twilio',
      'connect phone',
      'caller id',
    ],
    component: PhoneSystemsListSurface,
    singleton: true,
  },

  /* ── Reporting ─────────────────────────────────────────────────────────── */
  {
    key: 'crm.reports',
    title: 'Reports',
    module: 'crm',
    icon: BarChart3,
    section: 'Reporting',
    order: 30,
    keywords: ['analytics', 'retention', 'value'],
    // Each instance owns its own pipeline selection, so it is not a singleton.
    component: CrmReportsSurface,
  },
];
