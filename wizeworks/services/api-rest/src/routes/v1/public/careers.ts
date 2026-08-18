// Public careers application endpoint — first-party hiring for WizeWorks/sparx.
//
//   POST /v1/public/careers/apply ?tenant=<slug>  → a visitor on sparx.works
//   /careers submits an application (a specific founding role, or the general
//   "open application"). We store it as a JobApplication row on the PLATFORM
//   tenant (`wizeworks`, same convention as /early — docs/80 §2) and publish two
//   `email.send` events: one notifying the sparx team, one confirming to the
//   applicant. The admin app (later) reads these rows directly.
//
// No auth (anonymous visitors; the marketing site has no login yet). Not
// module-gated: careers is not a tenant product module, it's the company's own
// hiring surface, so it must work regardless of which modules `wizeworks` runs.
//
// Résumé transport: the whole submission (fields + the PDF, base64-encoded)
// arrives as ONE JSON body. api-rest has no multipart parser and no CORS on the
// HTTP app, and sparx/apps/web already talks to api-rest server-to-server — so a single
// atomic JSON request from the /careers server action is the simplest correct
// shape (no orphaned uploads, no presign minter exposed to anonymous callers).
// The route raises its own bodyLimit above the 5 MiB global default to fit the
// base64 payload, and validates + magic-byte-checks the decoded PDF server-side.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@wizeworks/db';
import { publish } from '@wizeworks/api-core/pubsub';
import { ok } from '@wizeworks/api-core/envelope';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
import { env } from '../../../env.js';
import { careersResumeKey, getStorage } from '../../../lib/storage.js';

// Hard cap on the decoded résumé PDF. Résumés are small; 8 MiB is generous and
// keeps the base64 JSON body well under the per-route limit below.
const MAX_RESUME_BYTES = 8 * 1024 * 1024;
// Per-route body cap — base64 inflates bytes ~33%, so 8 MiB of PDF is ~10.7 MiB
// encoded; 12 MiB leaves headroom for the surrounding JSON fields.
const ROUTE_BODY_LIMIT = 12 * 1024 * 1024;

// Fallback recipient for the internal notification when CAREERS_NOTIFY_EMAIL is
// unset — mirrors the "optional env, safe literal default" idiom used elsewhere.
const FALLBACK_NOTIFY_EMAIL = 'careers@sparx.works';

const Query = z.object({
  tenant: z.string().min(1).max(63),
});

const Resume = z.object({
  filename: z.string().min(1).max(255),
  // Base64 (no data: URI prefix) of the PDF bytes.
  contentBase64: z.string().min(1),
});

const Body = z.object({
  roleSlug: z.string().min(1).max(120),
  roleTitle: z.string().min(1).max(255),
  fullName: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  linkedinUrl: z.string().url().max(500).optional(),
  portfolioUrl: z.string().url().max(500).optional(),
  coverLetter: z.string().max(20000).optional(),
  roleInterest: z.string().max(255).optional(),
  resume: Resume.optional(),
});

function clientIp(request: FastifyRequest): string | undefined {
  return request.ip || undefined;
}

function userAgent(request: FastifyRequest): string | undefined {
  const ua = request.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 1000) : undefined;
}

// Decode + validate the résumé PDF. Returns the raw bytes, or throws a 400 if the
// payload isn't a plausible PDF or is oversized.
function decodeResume(resume: z.infer<typeof Resume>): Buffer {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(resume.contentBase64, 'base64');
  } catch {
    throw badRequest('Résumé could not be decoded.');
  }
  if (bytes.byteLength === 0) throw badRequest('Résumé file is empty.');
  if (bytes.byteLength > MAX_RESUME_BYTES) {
    throw badRequest('Résumé is too large (8 MB max).');
  }
  // Magic-byte check: a real PDF starts with "%PDF-". Cheap guard against a
  // mislabeled or corrupt upload before we commit it to storage.
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw badRequest('Résumé must be a PDF file.');
  }
  return bytes;
}

const publicCareersRoutes: FastifyPluginAsync = (app) => {
  app.post(
    '/v1/public/careers/apply',
    {
      // Bigger body than the 5 MiB global default (base64 PDF), and a tight
      // per-IP limit on top of the global limiter — an application form is
      // low-frequency, so a handful per minute is plenty and throttles abuse.
      bodyLimit: ROUTE_BODY_LIMIT,
      config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
    },
    async (request) => {
      const q = Query.parse(request.query);
      const body = Body.parse(request.body);

      const tenant = await prisma.tenant.findUnique({
        where: { slug: q.tenant },
        select: { id: true },
      });
      if (!tenant) throw notFound('Tenant', q.tenant);
      const tenantId = tenant.id;

      // Decode the PDF up front so a bad file fails before we write any row.
      const resumeBytes = body.resume ? decodeResume(body.resume) : null;

      // 1) Create the application row (résumé fields filled in step 3). Kept in
      //    its own short tenant-scoped transaction so the GCS upload never runs
      //    inside an open DB transaction.
      const application = await withTenant({ tenantId }, (tx) =>
        tx.jobApplication.create({
          data: {
            tenantId,
            roleSlug: body.roleSlug,
            roleTitle: body.roleTitle,
            fullName: body.fullName,
            email: body.email,
            phone: body.phone ?? null,
            location: body.location ?? null,
            linkedinUrl: body.linkedinUrl ?? null,
            portfolioUrl: body.portfolioUrl ?? null,
            coverLetter: body.coverLetter ?? null,
            roleInterest: body.roleInterest ?? null,
            source: 'careers-site',
            ipAddress: clientIp(request) ?? null,
            userAgent: userAgent(request) ?? null,
          },
          select: { id: true },
        })
      );

      // 2) Store the résumé privately, then 3) attach it to the row. A signed
      //    read URL goes into the team email so it's openable for the review
      //    window without a login.
      let resumeUrl: string | undefined;
      if (resumeBytes && body.resume) {
        const storage = getStorage();
        const key = careersResumeKey(tenantId, application.id, body.resume.filename);
        await storage.writeObject(key, 'application/pdf', resumeBytes);
        await withTenant({ tenantId }, (tx) =>
          tx.jobApplication.update({
            where: { id: application.id },
            data: {
              resumeKey: key,
              resumeFilename: body.resume?.filename ?? null,
              resumeMime: 'application/pdf',
              resumeSize: resumeBytes.byteLength,
            },
          })
        );
        resumeUrl = await storage.presignGet(key);
      }

      // 4) Notify the sparx team + confirm to the applicant. Both ride the
      //    existing `email.send` topic; publish() never throws (a Pub/Sub hiccup
      //    is logged, not surfaced) so a mail glitch can't lose the application.
      const notifyTo = env.CAREERS_NOTIFY_EMAIL ?? FALLBACK_NOTIFY_EMAIL;
      await Promise.all([
        publish(request.log, 'email.send', tenantId, null, {
          template: 'job-application-received',
          to: notifyTo,
          props: {
            roleTitle: body.roleTitle,
            applicantName: body.fullName,
            applicantEmail: body.email,
            phone: body.phone,
            location: body.location,
            linkedinUrl: body.linkedinUrl,
            portfolioUrl: body.portfolioUrl,
            roleInterest: body.roleInterest,
            coverLetter: body.coverLetter,
            resumeUrl,
            resumeFilename: body.resume?.filename,
          },
        }),
        publish(request.log, 'email.send', tenantId, null, {
          template: 'job-application-confirmation',
          to: body.email,
          props: {
            applicantName: body.fullName,
            roleTitle: body.roleTitle,
          },
        }),
      ]);

      return ok({ ok: true, id: application.id });
    }
  );

  return Promise.resolve();
};

export default publicCareersRoutes;
