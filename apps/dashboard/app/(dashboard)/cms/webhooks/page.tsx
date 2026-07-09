// Webhook subscriptions UI — placeholder.
//
// The audit (cms-audit-2026-05-29.md F-05) found that the CMS sub-nav linked
// tenants straight into a 500 because no page.tsx existed. The audit's
// fix-A was "ship a minimal placeholder", which is what this is — the full
// CRUD UI on top of /v1/webhooks/subscriptions is tracked as Phase 5+ work
// in project_cms_phase5_deferred.md. Removing the sidebar tab was option B
// and was rejected: webhooks are a real surface, just not built out yet.
//
// Until the editor lands, this page tells tenants that webhooks exist,
// what they're for, and how to manage them via the API.

import { PageHeader } from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { Webhook } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function WebhooksPage() {
  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Webhook className="h-5 w-5" />}
          title="Webhooks"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              coming soon
            </Badge>
          }
          description={
            <>
              Subscribe an external endpoint to <code>content.*</code> events so a publish in sparx
              triggers a downstream rebuild, cache purge, or notification. Backend wiring is live —
              the dashboard editor lands in a follow-up.
            </>
          }
        />

        <Card className="bg-module bg-soft">
          <CardBody>
            <EmptyState
              icon={<Webhook className="h-5 w-5" />}
              title="Webhook editor is on the roadmap"
              description="Until the UI ships, configure subscriptions via the API: POST /v1/webhooks/subscriptions with a target URL, the events you care about, and an HMAC signing secret. Deliveries are logged with retry state."
              actions={
                <Button
                  color="module"
                  variant="outline"
                  render={
                    <a
                      href="https://docs.sparx.works/api/webhooks"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Read the webhook API docs"
                    />
                  }
                >
                  Read the webhook API docs
                </Button>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Events you can subscribe to</h3>
            <p className="opacity-70">
              Every state-changing CMS mutation fans out to Pub/Sub and (when subscribed) to your
              endpoint with an HMAC-SHA256 signature in the <code>X-sparx-Signature</code> header.
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-sm">
                <code>content.entry.created</code> · new entry inserted
              </p>
              <p className="text-sm">
                <code>content.entry.updated</code> · entry body / SEO patched (autosave or save)
              </p>
              <p className="text-sm">
                <code>content.entry.published</code> · entry flipped to <code>published</code>
              </p>
              <p className="text-sm">
                <code>content.entry.scheduled</code> · entry scheduled for future publish
              </p>
              <p className="text-sm">
                <code>content.entry.unpublished</code> · entry reverted to <code>draft</code>
              </p>
              <p className="text-sm">
                <code>content.entry.deleted</code> · soft delete
              </p>
              <p className="text-sm">
                <code>content_type.upserted</code> · custom content type schema saved
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
