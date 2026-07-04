// Media MCP tools — upload or reference an image for a tenant's site(s).
//
// Two tools, matching the two create paths in asset-service.ts:
//   · upload_image        — raw bytes (base64) → the real transcode pipeline.
//   · set_image_from_url  — an external http(s) image / small data:image URI.
//
// Both return { assetId, url, status }. Use the returned `url` directly as a
// Builder Image node's `src`, or as a Section's `bgImage` for a full-bleed
// background (see describe_builder_styling). Assets are TENANT-wide (shared by
// every site the tenant owns) — there is no propertyId. Scope: write:builder
// (media is a builder/site input; the dashboard gates it on the same editor
// role that edits the builder). Non-destructive creates → not confirmation-gated.

import { z } from 'zod';
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_PROXIED_UPLOAD_BYTES,
  MediaValidationError,
  createImageAssetFromBytes,
  createImageAssetFromUrl,
  createImageUpload,
  type CreateImageUploadInput,
} from '../asset-service.js';
import { toMediaContext, type McpCtx } from './context.js';

export interface MediaMcpTool {
  name: string;
  description: string;
  scope: string;
  input: z.ZodType;
  confirmation: boolean;
  run(ctx: McpCtx, input: unknown): Promise<unknown>;
}

const allowedMimeList = [...ALLOWED_IMAGE_MIME].sort().join(', ');
const maxKiB = MAX_UPLOAD_IMAGE_BYTES / 1024;

// Accepts raw base64 OR a full `data:image/...;base64,<payload>` URI (lenient —
// the agent may hand either); returns the decoded bytes.
function decodeImageBase64(data: string): Buffer {
  const trimmed = data.trim();
  const comma = trimmed.startsWith('data:') ? trimmed.indexOf(',') : -1;
  const b64 = comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length === 0) throw new MediaValidationError('`data` is not valid, non-empty base64.');
  return buf;
}

const uploadImage: MediaMcpTool = {
  name: 'upload_image',
  description:
    `Upload an image (raw bytes) into the tenant's media library and get a URL to place on a site. The image ` +
    `is stored and transcoded to optimised web variants. Use the returned \`url\` as a Builder Image node's \`src\` ` +
    `or a Section \`bgImage\`. Allowed types: ${allowedMimeList}. Max ${maxKiB} KiB (optimise/downscale first — web ` +
    `images should be small; for a larger or already-hosted image use set_image_from_url instead).`,
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    data: z
      .string()
      .min(1)
      .describe(
        'The image bytes as base64 (a bare base64 string, or a full data:image/...;base64,<payload> URI).'
      ),
    mimeType: z
      .string()
      .min(1)
      .max(127)
      .describe(`The image content type — one of: ${allowedMimeList}.`),
    filename: z.string().min(1).max(255).describe('A filename for the asset, e.g. "hero.webp".'),
    alt: z.string().max(500).optional().describe('Alt text (accessibility + SEO).'),
    width: z.number().int().positive().optional().describe('Intrinsic pixel width, if known.'),
    height: z.number().int().positive().optional().describe('Intrinsic pixel height, if known.'),
  }),
  run: async (ctx, input) => {
    const { data, mimeType, filename, alt, width, height } = input as {
      data: string;
      mimeType: string;
      filename: string;
      alt?: string;
      width?: number;
      height?: number;
    };
    const bytes = decodeImageBase64(data);
    const mctx = await toMediaContext(ctx);
    return createImageAssetFromBytes(mctx, { data: bytes, mimeType, filename, alt, width, height });
  },
};

const setImageFromUrl: MediaMcpTool = {
  name: 'set_image_from_url',
  description:
    `Reference an existing image by URL (or a small data:image/... URI) as a media asset, without uploading bytes. ` +
    `The server does NOT fetch the URL — the site visitor's browser does — so use a publicly reachable https URL. ` +
    `Use the returned \`url\` as a Builder Image node's \`src\` or a Section \`bgImage\`. Only http(s) and ` +
    `data:image/ references are accepted (other schemes are refused). For a data: URI the reference must be under ` +
    `1024 chars — larger images must be uploaded with upload_image.`,
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    url: z
      .string()
      .min(1)
      .max(1024)
      .describe('An absolute https URL to an image, or a data:image/... URI (< 1024 chars).'),
    alt: z.string().max(500).optional().describe('Alt text (accessibility + SEO).'),
    mimeType: z
      .string()
      .max(127)
      .optional()
      .describe(
        'Override the image type; inferred from the URL extension / data URI when omitted.'
      ),
    width: z.number().int().positive().optional().describe('Intrinsic pixel width, if known.'),
    height: z.number().int().positive().optional().describe('Intrinsic pixel height, if known.'),
    filename: z.string().max(255).optional().describe('A filename for the asset (optional).'),
  }),
  run: async (ctx, input) => {
    const mctx = await toMediaContext(ctx);
    return createImageAssetFromUrl(
      mctx,
      input as {
        url: string;
        alt?: string;
        mimeType?: string;
        width?: number;
        height?: number;
        filename?: string;
      }
    );
  },
};

const maxProxiedMB = MAX_PROXIED_UPLOAD_BYTES / (1024 * 1024);

const createImageUploadTool: MediaMcpTool = {
  name: 'create_image_upload',
  description:
    `Start a real image upload WITHOUT sending the bytes through this tool call — use THIS for actual photos and ` +
    `screenshots. (upload_image inlines base64, which corrupts anything but a tiny image; set_image_from_url is for an ` +
    `already-hosted URL.) Returns an \`uploadUrl\` you PUT the raw bytes to out of band, e.g. ` +
    `\`curl -X PUT --data-binary @shot.jpg -H "content-type: image/jpeg" "<uploadUrl>"\`, plus \`imageUrl\` to use as a ` +
    `Builder Image \`src\` / Section \`bgImage\` (it renders as soon as the bytes land, before transcoding finishes). ` +
    `The server sniffs the actual bytes and REJECTS a type/size mismatch; the uploadUrl is single-use and expires in ~15 min. ` +
    `Allowed types: ${allowedMimeList}. Max ${maxProxiedMB} MB.`,
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    filename: z.string().min(1).max(255).describe('A filename for the asset, e.g. "hero.jpg".'),
    mimeType: z
      .string()
      .min(1)
      .max(127)
      .describe(`The image content type — one of: ${allowedMimeList}.`),
    byteSize: z
      .number()
      .int()
      .positive()
      .describe('Exact size of the image file in bytes (the PUT body must not exceed this).'),
    alt: z.string().max(500).optional().describe('Alt text (accessibility + SEO).'),
    width: z.number().int().positive().optional().describe('Intrinsic pixel width, if known.'),
    height: z.number().int().positive().optional().describe('Intrinsic pixel height, if known.'),
  }),
  run: async (ctx, input) => {
    const mctx = await toMediaContext(ctx);
    return createImageUpload(mctx, input as CreateImageUploadInput);
  },
};

export const mediaMcpTools: MediaMcpTool[] = [uploadImage, createImageUploadTool, setImageFromUrl];
