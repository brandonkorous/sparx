// Site-level catalog tools (docs/113 §6): who the site is, universal search,
// and newsletter opt-in. `get_site_info` wraps a lean projected endpoint
// (/v1/public/site-info) — never the raw tenant settings blob.

import { z } from 'zod';
import type { SiteTool } from '../types.js';

const getSiteInfo: SiteTool = {
  name: 'get_site_info',
  description:
    'Basic facts about this site: name, tagline, hours, contact, social links, and policy pages. Use for "what are your hours / where are you / how do I contact you".',
  kind: 'read',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/site-info' }),
};

const searchSite: SiteTool = {
  name: 'search_site',
  description:
    'Search everything on the site — products, collections, and published pages — returning titles + links. Use for broad "do you have / where can I find" questions.',
  kind: 'read',
  input: z.object({
    q: z.string().max(255).optional(),
    page: z.number().int().min(1).default(1),
    perPage: z.number().int().min(1).max(50).default(20),
  }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/search',
      query: input as Record<string, string>,
    }),
};

const subscribeNewsletter: SiteTool = {
  name: 'subscribe_newsletter',
  description: 'Subscribe an email address to the site’s newsletter/list.',
  kind: 'guest_write',
  module: 'crm',
  input: z.object({
    email: z.string().email(),
    firstName: z.string().max(127).optional(),
    lastName: z.string().max(127).optional(),
    list: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(63)
      .optional()
      .describe('List slug (default "newsletter").'),
    note: z.string().max(2000).optional(),
  }),
  call: (client, _ctx, input) =>
    client.request({ method: 'POST', path: '/v1/public/newsletter', body: input }),
};

export const siteTools: SiteTool[] = [getSiteInfo, searchSite, subscribeNewsletter];
