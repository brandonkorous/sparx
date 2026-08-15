# Application Deployments

One Deployment + Service + PodDisruptionBudget per app. `kustomization.yaml` is
the list that ships; a manifest not named there is not deployed, and — because
the release prunes on its ownership label — removing a name from that list is
how an app is actually deleted rather than silently left running.

| Manifest               | Serves                                     | Notes                                                     |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------- |
| `api-rest.yaml`        | api.sparx.works                            | Fastify REST API. 2 replicas; `strategy: Recreate` on AKS |
| `api-graphql.yaml`     | graphql.sparx.works                        | Pothos + Mercurius                                        |
| `api-mcp.yaml`         | mcp.sparx.works                            | The staff/agent MCP plane                                 |
| `mcp-site.yaml`        | mcp.sparx.zone                             | The shopper-facing MCP plane                              |
| `workbench.yaml`       | app.sparx.works                            | The operator app. Replaced the removed `dashboard`        |
| `web.yaml`             | sparx.works + the module marketing domains | One Next.js app reading the Host header                   |
| `site.yaml`            | every tenant storefront                    | Multi-tenant; hostname resolved per request               |
| `market.yaml`          | sparx.market                               | The marketplace                                           |
| `admin.yaml`           | admin.wize.works                           | The WizeWorks staff console — not a tenant surface        |
| `piggles-web.yaml`     | meetpiggles.com                            | **Piggles.** Marketing. No database, no auth, no api-rest |
| `piggles-account.yaml` | getpiggles.com                             | **Piggles.** The auth authority + platform billing        |
| `piggles-console.yaml` | mypiggles.com                              | **Piggles.** The operating console. No sign-in UI at all  |

Replica counts live in the overlay (`k8s/azure/apps/kustomization.yaml`), not
here — the same base runs on a laptop and on a one-node cluster.

## Piggles

Three of these belong to the sister brand. They share this NAMESPACE, the
database, api-rest and the secret store; they share no application code
(`piggles/CLAUDE.md` RULE #0 — either product must be deletable tomorrow without
affecting the other). Sharing a database is not sharing an application: the
database is a service both speak to.

They differ from their sparx siblings in exactly one structural way, and it is
worth knowing before editing one:

```yaml
envFrom:
  - configMapRef: { name: sparx-app-env } # the platform
  - secretRef: { name: sparx-app-secrets } # the platform's credentials
  - configMapRef: { name: piggles-app-env } # ← the brand, and it wins
```

**Later entries override earlier ones.** That ordering is what keeps one origin
in one place — see `k8s/azure/infra/piggles-app-env.env`, whose header records
what each value is and which of them has already caused an outage. The two
`BETTER_AUTH_URL`s are the exception and are set per-pod, because the two Piggles
apps run on two different origins.

## Adding a new app

1. Write `<app-name>.yaml` — copy the nearest neighbour rather than
   `api-rest.example.yaml`, which predates the current probe and security
   conventions.
2. Add it to `kustomization.yaml`.
3. Add its image to `k8s/azure/apps/kustomization.yaml` (`images:` + `replicas:`)
   — the release fails if any tag survives the SHA rewrite unpinned.
4. Add its Dockerfile to the build matrix in `.github/workflows/release.yml`.
   `scripts/check-dockerfile-deps.mjs` reads that matrix, so this is also what
   puts the image under dependency checking.
5. Give it a host block in `k8s/ingress/Caddyfile`. A running pod with no route
   is unreachable, and nothing reports a fault — the cluster is healthy.

## Shared env & secrets

- **`sparx-app-env`** — non-secret runtime config. Generated per overlay
  (`k8s/azure/infra/app-env-configmap.env`, `k8s/local/app-env-configmap.env`).
- **`piggles-app-env`** — the Piggles brand's overrides, same generators.
- **`sparx-app-secrets`** — every credential, including the `PIGGLES_*` keys.
  Applied by the release from `SPARX_APP_SECRETS_ENV` (or Key Vault);
  `k8s/local/secrets.example.env` is the documented key list.

## Workload Identity

The base sets `serviceAccountName: sparx-app`, annotated for GCP Workload
Identity. **The AKS overlay patches every Deployment back to `default`** — that
ServiceAccount is never created there and nothing in that cluster needs GCP
credentials, so a pod referencing it would stay Pending forever.
