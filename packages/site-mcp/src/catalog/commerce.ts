// Commerce catalog tools (docs/113 §6) — read the storefront catalog + submit
// reviews/questions. Each wraps a route under /v1/public/commerce.

import { z } from 'zod';
import type { StorefrontTool } from '../types.js';

const handle = z.string().min(1).max(255);
const page = z.number().int().min(1).default(1);
const perPage = z.number().int().min(1).max(100).default(24);

const searchProducts: StorefrontTool = {
  name: 'search_products',
  description:
    'Faceted product search across this store (full-text + filters). Use for "do you sell X", price/stock/fitment questions, and browsing.',
  kind: 'read',
  module: 'commerce',
  input: z.object({
    q: z.string().max(255).optional().describe('Search text.'),
    vendor: z.string().max(127).optional(),
    productType: z.string().max(127).optional(),
    tag: z.string().max(63).optional(),
    inStock: z.boolean().optional().describe('Only in-stock products.'),
    minPriceCents: z.number().int().min(0).optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    fitmentMakes: z.string().max(255).optional().describe('Comma-separated fitment makes.'),
    fitmentModels: z.string().max(255).optional(),
    fitmentEngines: z.string().max(255).optional(),
    fitmentYear: z.number().int().min(1900).max(2200).optional(),
    sort: z
      .enum(['relevance', 'price-asc', 'price-desc', 'title-asc', 'title-desc', 'newest'])
      .default('relevance'),
    page,
    perPage,
  }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/commerce/search',
      query: input as Record<string, string>,
    }),
};

const listProducts: StorefrontTool = {
  name: 'list_products',
  description: 'List/browse products with simple filters (no search index needed).',
  kind: 'read',
  module: 'commerce',
  input: z.object({
    q: z.string().max(255).optional(),
    vendor: z.string().max(127).optional(),
    productType: z.string().max(127).optional(),
    tag: z.string().max(63).optional(),
    fitmentMake: z.string().max(127).optional(),
    fitmentYear: z.number().int().min(1900).max(2200).optional(),
    page,
    perPage,
  }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/commerce/products',
      query: input as Record<string, string>,
    }),
};

const getProduct: StorefrontTool = {
  name: 'get_product',
  description:
    'Full detail for one product by its handle: description, variants, options, images, price range, stock, and fitment.',
  kind: 'read',
  module: 'commerce',
  input: z.object({ handle }),
  call: (client, _ctx, input) => {
    const { handle: h } = input as { handle: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/products/${encodeURIComponent(h)}`,
    });
  },
};

const listCollections: StorefrontTool = {
  name: 'list_collections',
  description: 'List the store’s product collections (curated groups).',
  kind: 'read',
  module: 'commerce',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/commerce/collections' }),
};

const getCollectionProducts: StorefrontTool = {
  name: 'get_collection_products',
  description: 'List products in a collection by the collection handle.',
  kind: 'read',
  module: 'commerce',
  input: z.object({ handle, page, perPage }),
  call: (client, _ctx, input) => {
    const { handle: h, ...q } = input as { handle: string; page: number; perPage: number };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/collections/${encodeURIComponent(h)}/products`,
      query: q,
    });
  },
};

const listCategories: StorefrontTool = {
  name: 'list_categories',
  description: 'The store’s category tree.',
  kind: 'read',
  module: 'commerce',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/commerce/categories' }),
};

const getProductReviews: StorefrontTool = {
  name: 'get_product_reviews',
  description: 'Published customer reviews + rating summary for a product handle.',
  kind: 'read',
  module: 'commerce',
  input: z.object({ handle, page, perPage: z.number().int().min(1).max(50).default(20) }),
  call: (client, _ctx, input) => {
    const { handle: h, ...q } = input as { handle: string; page: number; perPage: number };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/products/${encodeURIComponent(h)}/reviews`,
      query: q,
    });
  },
};

const getProductQuestions: StorefrontTool = {
  name: 'get_product_questions',
  description: 'Published questions and answers for a product handle.',
  kind: 'read',
  module: 'commerce',
  input: z.object({ handle }),
  call: (client, _ctx, input) => {
    const { handle: h } = input as { handle: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/products/${encodeURIComponent(h)}/questions`,
    });
  },
};

const submitProductReview: StorefrontTool = {
  name: 'submit_product_review',
  description:
    'Submit a product review (enters moderation before it appears). Requires a rating and body.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    handle,
    rating: z.number().int().min(1).max(5),
    authorName: z.string().min(1).max(63),
    title: z.string().max(127).optional(),
    body: z.string().min(1).max(5000),
  }),
  call: (client, _ctx, input) => {
    const { handle: h, ...body } = input as Record<string, unknown> & { handle: string };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/products/${encodeURIComponent(h)}/reviews`,
      body,
    });
  },
};

const askProductQuestion: StorefrontTool = {
  name: 'ask_product_question',
  description: 'Ask a question about a product (enters moderation).',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    handle,
    displayName: z.string().min(1).max(63).optional(),
    body: z.string().min(1).max(2000),
  }),
  call: (client, _ctx, input) => {
    const { handle: h, ...body } = input as Record<string, unknown> & { handle: string };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/products/${encodeURIComponent(h)}/questions`,
      body,
    });
  },
};

export const commerceTools: StorefrontTool[] = [
  searchProducts,
  listProducts,
  getProduct,
  listCollections,
  getCollectionProducts,
  listCategories,
  getProductReviews,
  getProductQuestions,
  submitProductReview,
  askProductQuestion,
];
