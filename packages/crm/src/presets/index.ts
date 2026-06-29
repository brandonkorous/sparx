// Module presets hosted in the CRM package. Three arrays, each carrying its own
// `module` field so the seam gates each on the right flag:
//   · crmPresets       — module 'crm'       (deal pipelines + customer segments)
//   · b2bPresets       — module 'b2b'        (wholesale tiers + purchase approval)
//   · invoicingPresets — module 'invoicing'  (billing workflows + line types)
//
// They live together here because the CRM package owns the services they install
// through (the B2B account spine, the invoicing document services) and already
// deps @sparx/modules — so authoring against `definePreset` needs no new edge.

export { crmPresets } from './crm';
export { b2bPresets } from './b2b';
export { invoicingPresets } from './invoicing';
