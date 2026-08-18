// Internal endpoint invoked by the Staff k8s CronJob (k8s/cronjobs/).
//
//   POST /internal/staff/certification-reminders → warn about expiring tickets
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// `certificationsNeedingReminder` and `markReminded` shipped built and tested,
// with **no caller anywhere in the repo**. So the one thing the Certifications
// surface promises — that you will be told BEFORE a licence lapses — never
// happened. docs/149 §10 listed it as "still to build"; this is it.
//
// ── WHY IT PUBLISHES AN EVENT RATHER THAN SENDING AN EMAIL ───────────────────
// docs/149 asked for "an email template behind it". This follows the platform's
// existing reminder pattern instead — `emitOverdueTaskReminders` in
// `@wizeworks/crm` publishes `crm.task.updated` "so the email automation engine can
// fire a templated reminder" — because the alternative is sparx deciding, on a
// tenant's behalf, who should be emailed about a forklift licence. That answer
// differs per business: the person, their supervisor, a compliance mailbox, or
// a task on a board rather than mail at all.
//
// The consequence to be honest about: an event with no automation behind it
// does nothing. That is the exact shape of the bug this file fixes, so the
// trigger is also registered in the workbench's `TRIGGER_EVENTS` catalog — an
// event a tenant cannot pick from a list may as well not be published.
//
// ── WHAT MAKES IT SAFE TO RUN NIGHTLY ────────────────────────────────────────
// `certificationsNeedingReminder` filters on each row's OWN `lastRemindedAt`
// against its own lead window, so a 90-day lead sends roughly once every 90
// days rather than 90 times. `markReminded` stamps only the rows this run
// actually published, and it runs AFTER the publishes — a broker failure means
// the reminder is retried tomorrow rather than silently marked as sent.

import type { FastifyPluginAsync } from 'fastify';

import { certificationsNeedingReminder, markReminded } from '@wizeworks/staff';

import { authorizeCron, forEachTenant } from '../../lib/cron-auth.js';
import { listTenantsWithModule } from '../../lib/module-tenants.js';
import { publishDomainEvent } from '../../lib/staff-events.js';

/** A calendar day as `YYYY-MM-DD`, read in UTC. `expiresOn` is a `@db.Date` and
 *  so arrives at UTC midnight; formatting it any other way names the day before
 *  for every reader west of Greenwich. */
function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const staffCronRoutes: FastifyPluginAsync = (app) => {
  app.post<{ Querystring: { today?: string } }>(
    '/internal/staff/certification-reminders',
    async (request) => {
      authorizeCron(request);

      // An override exists so a missed night can be replayed for the day it was
      // missed, rather than only ever asking about today.
      const override = request.query.today;
      const today = override ? new Date(override) : new Date();

      const tenants = await listTenantsWithModule('staff');
      const summary = await forEachTenant(tenants, async (tenantId) => {
        const due = await certificationsNeedingReminder(tenantId, today);
        if (due.length === 0) return { reminded: 0 };

        const published: string[] = [];
        for (const cert of due) {
          await publishDomainEvent('staff.certification.expiring', tenantId, null, {
            certificationId: cert.id,
            staffMemberId: cert.staffMember.id,
            staffMemberName: [cert.staffMember.firstName, cert.staffMember.lastName]
              .filter(Boolean)
              .join(' '),
            staffMemberEmail: cert.staffMember.email,
            name: cert.name,
            // `expiresOn` is nullable on the model but never null here — the
            // query filters `expiresOn: { not: null }`. Guarded anyway rather
            // than asserted, because a `!` here would be a runtime throw inside
            // a nightly job nobody is watching.
            expiresOn: cert.expiresOn ? dayString(cert.expiresOn) : null,
            reminderLeadDays: cert.reminderLeadDays,
            // Whether it is a warning or an existing problem. A lapsed licence
            // keeps being reported until somebody deals with it, so the
            // consumer needs to tell the two apart to word itself honestly.
            expired: cert.expiresOn ? cert.expiresOn.getTime() < today.getTime() : false,
          });
          published.push(cert.id);
        }

        // Stamped only after the publishes, and only for what was published.
        await markReminded(tenantId, published, today);
        return { reminded: published.length };
      });

      const reminded = summary.outcomes.reduce((sum, o) => sum + (o.result?.reminded ?? 0), 0);
      request.log.info(
        { today: dayString(today), reminded, ...summary, outcomes: undefined },
        'staff certification reminder sweep'
      );
      return { success: true, data: { today: dayString(today), reminded, ...summary } };
    }
  );

  return Promise.resolve();
};

export default staffCronRoutes;
