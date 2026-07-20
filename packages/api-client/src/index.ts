// @sparx/api-client — TypeScript SDK for the sparx public REST API.
// (The exported `Sparx` class keeps its PascalCase — it's a code identifier, not brand text.)
//
// Quick start:
//
//   import { Sparx } from '@sparx/api-client';
//   const sparx = new Sparx({
//     baseUrl: 'https://api.sparx.works',
//     token: process.env.SPARX_API_KEY!,
//   });
//   const { data, meta } = await sparx.cms.getEntryBySlug('blog_post', 'hello');
//
// For storefronts handling a `?sparxPreview=` query, pass `previewToken`:
//
//   const sparx = new Sparx({ baseUrl, previewToken: () => req.query.preview });
//   const post = await sparx.cms.getEntryBySlug('blog_post', slug, { preview: true });
//
// Conventions match docs/06-api-specification.md:
//   - All responses use the {success, data, meta?} envelope; the client
//     unwraps and throws ApiError on {success: false}.
//   - Mutations support Idempotency-Key + If-Match passthrough.
//   - ETag is exposed on `meta.etag` so callers can plumb optimistic
//     concurrency without inspecting headers.

import { SparxClient, type SparxClientOptions } from './client';
import { CmsApi } from './cms';
import { MediaApi } from './media';
import { GraphQLClient } from './graphql';

export interface SparxOptions extends SparxClientOptions {
  /**
   * Override the base URL used for GraphQL operations. Defaults to the
   * same `baseUrl` REST uses (Caddy host-routes /v1/graphql to api-graphql).
   * Set this to `https://graphql.sparx.works` if you want the dedicated
   * GraphQL hostname directly.
   */
  graphqlBaseUrl?: string;
}

export class Sparx {
  public readonly client: SparxClient;
  public readonly cms: CmsApi;
  public readonly media: MediaApi;
  public readonly graphql: GraphQLClient;

  constructor(opts: SparxOptions) {
    this.client = new SparxClient(opts);
    this.cms = new CmsApi(this.client);
    this.media = new MediaApi(this.client);
    this.graphql = new GraphQLClient({
      baseUrl: opts.graphqlBaseUrl ?? opts.baseUrl,
      token: opts.token,
      fetch: opts.fetch,
    });
  }
}

// RequestOptions/ApiResponse are the parameter and return types of the exported
// SparxClient.request() — without them a consumer calling the low-level
// transport directly (rather than the CmsApi/MediaApi helpers) can't type it.
export {
  SparxClient,
  type SparxClientOptions,
  type RequestOptions,
  type ApiResponse,
  type ResponseMeta,
  type EnvelopeMeta,
} from './client';
export { ApiError, type Envelope } from './envelope';
export type {
  ContentEntry,
  ContentEntryListItem,
  ContentEntrySeo,
  ContentRevision,
  ContentTypeMeta,
  EntryStatus,
  MediaAsset,
  MediaVariant,
  NavigationItem,
  NavigationMenu,
  PageMeta,
  Redirect,
} from './types';
export { CmsApi } from './cms';
export { MediaApi } from './media';
export {
  GraphQLClient,
  type GraphQLClientOptions,
  type GraphQLOperation,
  type GraphQLError,
  type GraphQLResponse,
} from './graphql';
export type {
  CreateEntryInput,
  ListEntriesQuery,
  PreviewTokenResponse,
  PublishEntryInput,
  UpdateEntryInput,
} from './cms';
export type { InitUploadInput, PresignedUpload, UpdateMediaAssetInput } from './media';
