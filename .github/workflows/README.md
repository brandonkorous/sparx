# Workflows

**Version:** 2.2
**Author:** Brandon Korous
**Last Updated:** 2026-10-29

There are four, and each is a different KIND of thing:

| File                                               | Trigger              | What it is                                                       |
| -------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| [ci.yml](ci.yml)                                   | every PR + push      | Is the change valid? Lint, typecheck, test, format, parity.      |
| [release.yml](release.yml)                         | every push to `main` | **The pipeline.** Infrastructure → data → containers → cleanup.  |
| [ops.yml](ops.yml)                                 | manual               | One-off chores that are deliberately NOT part of a release.      |
| [restore-from-export.yml](restore-from-export.yml) | manual               | Disaster recovery. Restores the Postgres dump and media tarball. |

## The release

```
push to main
  build            16 images → ghcr.io/<repo>/<image>:<sha>
  1 infrastructure namespace + secrets (Key Vault) → hand the ingress over
                   → k8s/azure/infra (sparx-app-env, media volume, Typesense,
                   PgBouncer)
  2 data           roles → migrate → seed platform rows
  3 containers     pin every image to <sha>, apply k8s/azure/apps, wait,
                   then re-sync system automations from the new code
    tag            cut the v* tag — only if the release actually shipped
  4 cleanup        prune old image versions + obsolete workflow-run history
```

That is the whole deployment of sparx, in the order it has to happen, in one file.

**What this release does NOT do any more** (since 2026-10-29): run Terraform,
grant identities, install the WizeLens collector, apply the Caddy ingress, or
make jotDOJO's database owner role. Those serve every product on the cluster, so
they moved to [wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure)
and its own [release](https://github.com/wizeworksllc/wize-infrastructure/blob/main/.github/workflows/release.yml)
(jobs `infrastructure`, `bootstrap`, `cluster`), which ships no app images and
takes minutes. See "Infrastructure is another repository's release" below.

### Why data comes before containers

Schema before code is uncontroversial: new code must never meet an old schema.
Rows are the same argument and were the same bug.

`migrate` moves the SCHEMA. Nothing ever put a row in it. So platform content —
the marketplace catalog, the global component library, starter legal pages —
could be committed, reviewed, merged and deployed while remaining entirely
absent from the running platform.

Not hypothetical: `marketplace_themes` held **zero rows on both clouds** against
20 committed theme bundles, and `/market/themes` served its empty state for a
month. Nothing was broken. There was simply no step that published it.

Putting the data stage BEFORE the rollout is what makes the guarantee real. If
the seed fails, the old containers are still serving and no new code ever meets
data that was never written. Running it afterwards means finding out the data is
wrong from a release that has already shipped.

It is idempotent — upserts on stable natural keys — which is what lets it run
unattended on every release rather than being a workflow someone has to remember.
And it **fails the release** when it fails, which the hand-run predecessor did
not: it logged warnings, so "the pipeline is green" and "the catalog is empty"
were true at the same time.

**The marketplace catalog is no longer a deploy stage at all**, which is the
stronger form of the same fix. api-rest publishes sparx's own themes, components
and blueprints on **boot**, into the same rows a licensed collaborator's upload
will write, and retracts by absence. A stage that must run is still a stage that
can be skipped, mis-wired to one cloud, or run without the volume it writes to —
all three of which happened. Publishing because the image booted cannot be any of
those. The catalog row counts moved to the end of stage 3 accordingly: the pods
that just came up are what wrote them.

### Why system automations re-sync AFTER the containers

System automations (the dunning ladder, "an order is waiting for sign-off", the
receipt emails) are a row per business, written from definitions in code: the
seeds in `wizeworks/packages/automation-actions`. Until now only the daily
`automation-reconcile-seeds` CronJob (02:07) and a module being switched on ever
rewrote those rows. So a release that changed a seed shipped the new definition
and left every business running the old one for up to a day: after the release
that taught the held-order rules who signs, the business would have kept getting
a task for an order only the buyer's own approver can sign, and that approver no
email.

This is data, so it is a step of the release, and it fails the release when it
fails. It is the one piece of data that comes AFTER the rollout rather than
before it, because the definitions exist only in the code the rollout brings: run
from stage 2, it would write the previous release's seeds back. So the last step
of stage 3, once `rollout status` has retired every old pod, checks the
event-worker is running this release's SHA and calls the same reconcile the
CronJob calls, with `?only=seeds` (the CronJob's daily campaign scan stays on its
own clock). It is idempotent, it runs even when the rollout was skipped (then it
changes nothing), and the run summary lists, per module, how many businesses and
rules it wrote and how many it skipped. The CronJob stays as the backstop.

### Why the k8s overlay is split

`k8s/azure/infra` and `k8s/azure/apps` exist so the order above can hold on a
cluster that has never been deployed, not only on one that already has
yesterday's pods on it.

The data stage runs Jobs that need a namespace, the `sparx-app-env` ConfigMap
and the `sparx-media` PVC to already exist. While those lived in one overlay
with the Deployments, the only way to have them was to roll the whole platform
first — which is exactly why the data stage used to run last, after the
containers it is supposed to precede.

The dividing line is **replacement**. `infra` holds things created once that
then converge: a namespace, a config map, a disk, a connection pooler, a search
engine holding an index. `apps` holds container images thrown away and replaced
on every release. Different lifecycles, different blast radii, different stages.

This also retires the old `bootstrap.yml` concept rather than porting it. That
workflow existed because "add a platform pod" is not "roll an image" — correct
instinct, wrong mechanism: 39 KB of dispatch with fifteen hand-picked component
names someone had to remember to run. The distinction it was drawing is the
overlay split, and it now runs on every release.

### One commit, one release, one SHA

`build` runs inside the pipeline and builds **every** image, unfiltered, so
`github.sha` is the only version in play.

What that replaced: a separate path-filtered build workflow, a `workflow_run`
trigger to chain off it, a `manifest_sha` and an `image_sha` that were "not
always the same", and a loop walking back fifty commits asking GHCR whether each
one had images. All of it existed to answer _which images do these manifests go
with_ — a question this pipeline does not have, because it builds them.

The path filter was there to avoid rebuilding every image to publish identical
bytes. It was not worth its complexity: this repository is **public**, so
Actions minutes are free, and each image restores from its own `type=gha` cache
scope when nothing under it changed. The cost was never money; it was two SHAs
and a class of "merged but never deployed" bugs.

### Infrastructure is another repository's release

From 2026-08-02 to 2026-10-29, stage 1 of this release ran `terraform apply` on
`terraform/envs/azure`, a `bootstrap` job applied `terraform/bootstrap-azure`
under its own identity, and stage 1 also applied the Caddy ingress, installed the
WizeLens collector and made jotDOJO's owner role. All of it now lives in
[wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure)
(local checkout `G:/code/@wizeworks/wize-infrastructure`), under the same paths
and the same state keys. The reason is the same one that put Terraform in a
pipeline in the first place, one level up: those resources serve every product
on the cluster (kanNINJA, jotDOJO, RocketEase, AgConnect, WizeLens, wize.works),
and a Caddy route for one of them used to wait about two hours behind twenty
sparx images and a sparx rollout.

What that means here:

- **Stage 1 assumes the cloud exists.** The cluster, the Postgres server, the
  reserved ingress IP, DNS and `kv-sparx-prod-cus` are wize-infrastructure's.
  Its Terraform also writes the media storage pair (`azure-storage-account`,
  `azure-storage-key`) into that vault, and stage 1 reads them from there.
- **A change that needs infra ships there first.** A new Caddy route, DNS
  record, database, vault, or the Pub/Sub topic for a new event is a pull request
  to wize-infrastructure, released by its pipeline, before the sparx change that
  relies on it merges.
- **"Hand the ingress over to wize-infrastructure"** is a step in stage 1. Caddy
  still runs in `sparx-prod` (its certificate disk and reserved IP make moving it
  a planned migration), but this overlay no longer emits it. Any Caddy object
  still labelled `app.kubernetes.io/managed-by: sparx-release-infra` is relabelled
  to `wize-infrastructure` before the `--prune`, so this release can never delete
  the ingress. Once wize-infrastructure has applied it, the step matches nothing.
  wize-infrastructure's overlay renders Caddy exactly as this one did (including
  `serviceAccountName: default`), so the handover is a pure relabel and Caddy
  does not restart.
- **The destroy guard moved with the Terraform.** An additive plan applies
  unattended and a destructive one stops wize-infrastructure's release until a
  manual dispatch with `allow_infrastructure_destroy`. Read
  [its workflow](https://github.com/wizeworksllc/wize-infrastructure/blob/main/.github/workflows/release.yml)
  for the details.
- **CI still guards the seams.** The `event-topics` job in [ci.yml](ci.yml)
  checks wize-infrastructure out beside this tree and runs its
  `check-event-topics.mjs` and `check-cloudflare-ranges.mjs` with `--sparx .`, so
  the pull request that adds an event without a topic, or changes the trusted
  Cloudflare ranges on one side only, is the one that fails. Locally,
  `pnpm check:events` does the same through
  [scripts/infra-check.mjs](../../scripts/infra-check.mjs).

### The destination is a variable

A release pipeline describes how to ship, not where. The `target` job resolves
the destination once and every other job reads its outputs:

| Variable              | Default              | What it is                           |
| --------------------- | -------------------- | ------------------------------------ |
| `AKS_RESOURCE_GROUP`  | `rg-sparx-prod-cus`  | Azure resource group                 |
| `AKS_CLUSTER`         | `aks-sparx-prod-cus` | AKS cluster name                     |
| `K8S_NAMESPACE`       | `sparx-prod`         | Namespace every `kubectl` uses       |
| `K8S_OVERLAY`         | `k8s/azure`          | Overlay root (`infra`/`apps`/`jobs`) |
| `KEEP_IMAGE_VERSIONS` | `5`                  | Image versions kept per package      |
| `KEEP_WORKFLOW_RUNS`  | `50`                 | Runs kept per live workflow          |

`TERRAFORM_DIR` and `AZURE_LOCATION` are wize-infrastructure's variables now;
nothing here reads them.

Adding an environment is setting these on it, not forking the file. The
namespace is named in two places that must agree — this variable and the
`namespace:` field of the overlays — so the `target` job **checks** them and
fails loudly on a mismatch, rather than applying Deployments into one namespace
and waiting for a rollout in another.

This replaces a naming convention that had grown to eight files (deploy /
db-migrate / build / marketplace-ingest, each doubled per cloud) where the thing
that actually varied was three strings.

## The tag is cut last, and only if the release shipped

`auto-tag.yml` used to be its own workflow on the same push trigger, with no
`needs` and no `workflow_run`. So a tag asserted _"someone pushed a `feat:`
commit"_ while everyone reads it as _"this version shipped"_.

The gap was not theoretical: **`v1.195.0` sits on `87dfe7f8`, a commit whose
image build and deploy both failed.** That version never ran anywhere.

Tagging is now the `tag` job, behind the stages, skipped if any of them failed —
so `git tag --points-at` is a truthful answer to "what is deployed". A skipped
stage still counts as shipped (`containers` skips itself when nothing changed).

`contents: write` is scoped to that one job. That is the only real argument for
keeping tagging separate — the release otherwise runs on `contents: read` while
holding cloud OIDC and package write, and should not also be able to write the
repository. Job-level permissions settle it without a second file.

Force a bump with the `bump` input (`patch`/`minor`/`major`), or suppress one
with `none` when re-running part of a release.

## Ops is not the release

`ops.yml` is manual-only and holds the chores. Today that is one: backfill
platform CRM records for tenants that predate the worker.

It used to hold four more — a marketplace ingest and three catalog purges. Those
are **gone rather than moved**: api-rest publishes sparx's own catalog on boot and
retracts by absence, so publishing is not something anyone triggers and unlisting
is deleting the source. Worth recording that the purges were built and never run,
which is exactly how production came to serve 25 dead component listings.

They are here rather than in the release on purpose. A release pipeline should
read as four stages and nothing else; the moment a task name like "purge themes"
appears in it, it stops describing how the platform ships and becomes a list of
chores that happen to run in order — and every future chore has an obvious place
to be added. Adding one here is a row in a case statement and never touches the
release.

It is one file with a `task` input rather than one file per chore, because the
chores are all the same shape (run a script inside the cluster, against the
app's own environment, as a Job) and the six files it replaced differed only in
an image, a path, and which of them remembered to require a typed confirmation.
Nothing in the list destroys data today, but the `*-purge-*` confirmation gate
stays: it is the contract for adding one, so the next destructive task inherits
the typed confirmation instead of needing someone to remember to build it.

It shares the release's concurrency group, so an ops task and a release never
run at the same time.

## Required configuration

Repository or environment **variables** (ids, not secrets):

| Variable                | Source                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`       | wize-infrastructure's [`terraform/bootstrap-azure`](https://github.com/wizeworksllc/wize-infrastructure/blob/main/terraform/bootstrap-azure) output |
| `AZURE_TENANT_ID`       | the same output                                                                                                                                     |
| `AZURE_SUBSCRIPTION_ID` | the subscription sparx runs in                                                                                                                      |
| `AZURE_KEY_VAULT_NAME`  | `kv-sparx-prod-cus`, the vault stage 1 reads the app secrets from                                                                                   |
| `INFRA_REPOSITORY`      | optional; the repo CI checks out for the parity checks (default `wizeworksllc/wize-infrastructure`)                                                 |

This identity holds Contributor, AKS access and `Key Vault Secrets User` on
`kv-sparx-prod-cus`, and nothing more: it no longer reads the Terraform state or
writes other products' vaults. `BOOTSTRAP_AZURE_CLIENT_ID` is no longer used
here; the `bootstrap` identity trusts wize-infrastructure's `bootstrap`
environment instead.

Repository **secrets**:

| Secret                  | What it carries                                |
| ----------------------- | ---------------------------------------------- |
| `SPARX_APP_SECRETS_ENV` | the whole app secret bundle as one dotenv blob |
| `TYPESENSE_API_KEY`     | search                                         |

`CLOUDFLARE_API_TOKEN` fed Terraform's DNS and origin certificate; Terraform
runs in wize-infrastructure now, so that is where it is needed.

No JSON key files and no client secret anywhere: authentication is OIDC
federation, and Entra matches the credential subject **exactly**, so a fork's
pull-request run executes under a different subject and cannot assume the
identity.

## Rollback

```
kubectl -n sparx-prod rollout undo deployment/<service>
```

Meaningful because every image is pinned to an immutable SHA and the release
FAILS if any placeholder tag survives the rewrite. `KEEP_IMAGE_VERSIONS` is 5
rather than 1 for the same reason — the margin for finding out days later that a
release two back was the last good one.

Migrations run before the rollout and the rollout is skipped if they fail, so
new code never meets an old schema. A migration itself is not rolled back; write
a new one that reverses it.

## What happened to the other fifteen

The GCP set — `bootstrap`, `build-images-gcp`, `deploy-gcp`, `db-migrate-gcp`,
`marketplace-ingest-gcp`, `cleanup-images-gcp`, three `marketplace-purge-*`, and
`platform-crm-backfill` — is **deleted**. The platform runs on Azure. They were
already inert (trigger-blocked behind a `__disabled__` sentinel) and keeping a
second, unexercised copy of every mechanic is what produced pairs that drifted
apart. `terraform/envs/prod` and `terraform/bootstrap` remain as code in
wize-infrastructure, whose CI keeps them `validate`-clean, because "we still have
the GKE definition" is only true while it is valid HCL.

The Azure set — `build-images-ghcr`, `deploy-azure`, `db-migrate-azure`,
`cleanup-images-ghcr`, `marketplace-ingest-azure` — is folded into
`release.yml` and `ops.yml` (the ingest half has since been retired outright —
see "Ops is not the release"). `db-migrate-azure` was a reusable workflow so that
it could be a peer of its GCP sibling; with the sibling gone, the only thing
that split bought was a job boundary and a concurrency-group deadlock that had
to be worked around with an expression comparing `github.workflow` to a literal
string.
