// Tenant-activation bootstrap.
//
// When a tenant activates the CRM module, seed:
//   • the default sales pipeline (DEFAULT_PIPELINE_TEMPLATE) with its stages
//   • the built-in segment templates (high-value, at-risk, b2b-fleet,
//     new-customers)
//
// Both bootstrap functions are idempotent (slug-keyed lookups), so a
// re-activation or a duplicate event is a safe no-op. We intentionally do
// NOT wrap this in gateHandler — gateHandler short-circuits on disabled
// tenants, but we ARE the consumer that runs only when the module just
// turned on. Module-cache invalidation also happens here (slimmer than
// pulling registry.ts into the loop). On `module.deactivated` we keep the
// rows around — disabling is reversible and tenants would be upset to
// lose their edited pipeline on a brief disable.

import { invalidateModuleCache } from '@sparx/modules';

import * as documentLineTypeService from '../services/document-line-type-service';
import * as documentWorkflowService from '../services/document-workflow-service';
import * as pipelineService from '../services/pipeline-service';
import * as segmentService from '../services/segment-service';
import type { ConsumerContext } from './registry';

export function registerModuleActivationConsumers(ctx: ConsumerContext): (() => void)[] {
  return [
    ctx.bus.subscribe('module.activated', async (event) => {
      const slug = (event.payload as { module?: string } | null)?.module;
      if (slug !== 'crm') return;
      // Drop the cached "is CRM enabled?" answer first, otherwise the
      // service-layer's withTenant() calls below would race the cache and
      // potentially see the old (disabled) answer. Bootstrap doesn't use
      // the gate (it's a system action), but downstream side effects
      // (audit logger, publishCrmEvent) might.
      invalidateModuleCache(event.tenantId, 'crm');
      const serviceCtx = { tenantId: event.tenantId, userId: undefined };
      await pipelineService.bootstrapDefaultPipeline(serviceCtx);
      await segmentService.bootstrapBuiltInSegments(serviceCtx);
    }),

    // Invoicing (docs/87): on activation, seed the built-in document workflows
    // (Invoice, Service / Repair) and the starter line-type registry. Both
    // bootstraps are slug/key-keyed and idempotent, so a re-activation is a
    // safe no-op. Rows survive `module.deactivated` — a brief disable should
    // never lose a tenant's edited workflows.
    ctx.bus.subscribe('module.activated', async (event) => {
      const slug = (event.payload as { module?: string } | null)?.module;
      if (slug !== 'invoicing') return;
      invalidateModuleCache(event.tenantId, 'invoicing');
      const serviceCtx = { tenantId: event.tenantId, userId: undefined };
      await documentWorkflowService.bootstrapDefaultWorkflows(serviceCtx);
      await documentLineTypeService.bootstrapDefaultLineTypes(serviceCtx);
    }),
  ];
}
