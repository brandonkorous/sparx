# sparx Inventory Bridge (Tier A on-prem agent)

The bridge connects an **on-prem ERP** (whose API is only reachable on the tenant's
LAN — Fishbowl Inventory is the archetype) to sparx. It runs on a machine inside the
tenant's network and talks to sparx over **outbound HTTPS only**: no inbound ports,
no VPN. It reads on-hand stock locally and pushes it to sparx on a schedule.

See [docs/28](../../docs/28-inventory-sync-integration.md) §3 (connectivity tiers)
and [docs/100](../../docs/100-inventory-build-plan.md) P5d.

## How it fits

```
 Local ERP export ──▶ [ Inventory Bridge ] ──HTTPS──▶ POST /v1/inventory/sources/:id/push
   (CSV / JSON)         reader → push-client            POST …/heartbeat
```

Every snapshot is a **full on-hand list**: sparx reconciles each row through its
movement ledger (the external system always wins on `on_hand`), drops out-of-order
snapshots via last-writer ordering (`synced_at` = the export's modification time),
and flags mappings that vanished from the feed as stale. The bridge also sends a
lightweight **heartbeat** between snapshots so the dashboard shows the agent
online/offline.

## Pairing

In the sparx dashboard: **Inventory → Sources →** create a source of type
**On-prem bridge agent**, open it, and click **Pair agent**. Copy the API key shown
**once** and put it in the bridge config below. Pairing mints a tenant-scoped key
(`sk_live_…`) scoped to `inventory:push`; rotating issues a new key and revokes the old.

## Configure

Set environment variables (or a `.env` file beside the binary):

| Variable                 | Required | Default | Notes                                             |
| ------------------------ | :------: | ------- | ------------------------------------------------- |
| `SPARX_BASE_URL`         |    ✓     | —       | e.g. `https://api.sparx.works`                    |
| `SPARX_SOURCE_ID`        |    ✓     | —       | the source's UUID (from the connection page)      |
| `SPARX_API_KEY`          |    ✓     | —       | the `sk_live_…` key from **Pair agent**           |
| `BRIDGE_READER`          |          | `file`  | `file` \| `fishbowl`                              |
| `BRIDGE_FILE_PATH`       | for file | —       | path to the ERP's exported CSV/JSON               |
| `BRIDGE_FILE_FORMAT`     |          | `csv`   | `csv` \| `json`                                   |
| `SYNC_INTERVAL_SEC`      |          | `300`   | how often to read + push (30–86400)               |
| `HEARTBEAT_INTERVAL_SEC` |          | `60`    | liveness ping cadence (15–3600)                   |
| `REQUEST_TIMEOUT_MS`     |          | `30000` | per-request timeout                               |
| `MAX_RETRIES`            |          | `3`     | transient-failure retries (exp. backoff, cap 30s) |

### Export format

The `file` reader expects columns `sku`, `quantity` (aliases `qty` / `on_hand`), and
optional `location` (aliases `warehouse` / `location_id`). JSON may be a bare array
or `{ "items": [...] }`. Map each external SKU to a sparx variant + warehouse on the
connection's **SKU mappings** panel; unmapped SKUs land in the review queue.

## Run

```bash
pnpm --filter @sparx/inventory-bridge start    # node --import tsx src/index.ts
# or, containerized:
docker build -f services/inventory-bridge/Dockerfile -t sparx-inventory-bridge .
docker run --env-file bridge.env -v /path/to/exports:/data sparx-inventory-bridge
```

## Fishbowl-native reader (`BRIDGE_READER=fishbowl`)

Reading Fishbowl directly (its LAN JSON API on `:28192`, or a query against its
MySQL-compatible database) depends on the exact **edition, version, and IT policy**
of each install, so it must be finalized against a real instance before it ships
(docs/28 §8). Until then, point Fishbowl's scheduled export at a folder and run
`BRIDGE_READER=file` — the universal path that works for every on-prem system.
