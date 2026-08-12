// @sparx/migration — turning another platform's export into sparx data.
//
// Pure and isomorphic by design. The workbench imports it to read and check a file in
// the browser before anything is uploaded; the API imports it to serve the catalogue
// and to re-check rows server-side; the marketing site imports the registry so a page
// can only claim what an adapter actually maps. Nothing here touches the network, the
// database, or a tenant.

export {
  CANONICAL_ENTITIES,
  ENTITY_FIELDS,
  ENTITY_LABEL,
  ENTITY_MODULE,
  fieldSpec,
  naturalKeyFields,
  type CanonicalEntity,
  type CanonicalRow,
  type EntityModule,
  type FieldKind,
  type FieldSpec,
} from './canonical';

export {
  clean,
  isAmbiguousDate,
  isBlank,
  isEmail,
  isUrl,
  toBoolean,
  toCents,
  toDecimal,
  toInteger,
  toIsoDate,
  toList,
  toPath,
  toPhoneDigits,
  toSlug,
} from './coerce';

export {
  dedupeHeaders,
  parseCsv,
  parseDelimited,
  sniffDelimiter,
  splitRecords,
  type ParsedDelimited,
  type ParseOptions,
  type SourceRow,
} from './parse/csv';

export {
  child,
  childText,
  children,
  decodeEntities,
  metaValue,
  parseXml,
  type XmlNode,
} from './parse/xml';
export { parseWxr, type WxrDocument } from './parse/wxr';

export {
  detect,
  mapManually,
  readSource,
  sniffFormat,
  type DetectInput,
  type DetectionCandidate,
  type MappedEntity,
  type ReadResult,
} from './detect';

export {
  countLabel,
  failingRows,
  importableRows,
  summarize,
  validateRows,
  type DuplicateGroup,
  type IssueSeverity,
  type ValidationIssue,
  type ValidationReport,
} from './validate';

export {
  catalogue,
  catalogueByKind,
  vendorCapability,
  vendorSlugs,
  type SourceSummary,
  type VendorCapability,
} from './registry';

export { allSources, getSource, getVendor, VENDORS, type VendorSlug } from './vendors';

// Live connections. The one part of this package that touches a network — and it
// does so only through a `fetch` the caller hands in, which is what keeps the rest of
// the promise above true and keeps these testable without a Shopify store.
export {
  availableResources,
  connectorCatalogue,
  connectorDescriptorForVendor,
  connectorForVendor,
  connectorOnlyEntities,
  CONNECTORS,
  ConnectorError,
  assertHttps,
  assertSafeUrl,
  describeConnector,
  getConnector,
  type Connector,
  type ConnectorAccount,
  type ConnectorDescriptor,
  type ConnectorResource,
  type ConnectorSlug,
  type CredentialField,
  type Credentials,
  type FetchLike,
  type HttpRequest,
  type HttpResponse,
  type PullInput,
  type PullPage,
} from './connectors';

export {
  isDelimited,
  isMultiEntity,
  isTextual,
  type SourceFormat,
  type VendorAdapter,
  type VendorKind,
  type VendorSource,
} from './types';
