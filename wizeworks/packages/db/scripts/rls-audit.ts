#!/usr/bin/env tsx
// RLS audit — static analysis over every Prisma migration SQL file.
//
// For every CREATE TABLE that carries a `tenant_id` column, asserts the
// same migration (or any later one) contains:
//
//   • ALTER TABLE ... ENABLE ROW LEVEL SECURITY
//   • ALTER TABLE ... FORCE  ROW LEVEL SECURITY    (per CLAUDE.md hand-edit rule)
//   • CREATE POLICY ... ON ...                     (tenant_isolation policy)
//
// It ALSO asserts that the EFFECTIVE (last-defined) policy on every table reads
// its tenant GUC through the missing-safe `current_tenant_id()` helper — never a
// raw `current_setting('app.<x>')`, which throws `unrecognized configuration
// parameter` (SQLSTATE 42704) when the GUC is unset (e.g. during FK-validation
// scans run by the non-superuser `sparx_owner`). This is the bug class fixed by
// 20260801000000_fix_b2b_import_rls_guc and 20260821120000_fix_dropship_inventory
// _scheduling_rls_guc. Because a later migration can drop+recreate a policy in the
// corrected form, the check is last-definition-wins: a historical raw policy that
// a later migration supersedes is fine.
//
// It ALSO asserts that every cross-tenant DISPATCH SCAN can actually read what
// it scans. A `find_*` SECURITY DEFINER function is owned by `sparx_owner` and
// runs with NO `app.tenant_id` set — that is the point of a cross-tenant scan.
// But Decision F3 puts FORCE ROW LEVEL SECURITY on every tenant table precisely
// so `sparx_owner` CANNOT bypass RLS, so such a scan matches
// `tenant_id = current_tenant_id()` against NULL and returns ZERO ROWS. No
// error, no log — the background feature simply never fires, and it passes
// locally because docker's `sparx_owner` is a superuser. Each scanned FORCE-RLS
// table therefore needs a PERMISSIVE `FOR SELECT TO sparx_owner` policy.
//
// This has now shipped broken TWICE. 20270117000000_dispatch_scan_owner_rls
// fixed twelve tables after booking notifications were found piling up unsent;
// within a week six more scans were added with no policy (the whole social
// health/inbox/metrics sweep plus the email-sequence drain), and every one of
// them returned zero rows in prod until 20270126000000_scan_owner_rls_backfill.
// Nothing tied "add a scan" to "grant the owner read on what it scans" — so
// that pairing is enforced here, statically, and fails pre-push instead of
// silently doing nothing in production for a week.
//
// Junction tables (no `tenant_id` column, e.g. commerce_category_products)
// are skipped — tenant scoping rides through their FK parents via
// ON DELETE CASCADE.
//
// Exceptions are explicit:
//   • Auth tables (users, sessions, accounts, etc.) are ENABLE-only by
//     design — Better Auth needs cross-tenant reads at sign-in time
//     (see [memory] sparx_db_rls_pattern.md).
//   • Fitment reference tables (commerce_fitment_domains/categories/
//     items/variants) support nullable tenant_id so sparx-seeded global
//     rows are visible to every tenant alongside per-tenant additions.
//     They carry an OR-clause policy ("tenant_id IS NULL OR ...") and
//     ENABLE — never FORCE (FORCE blocks the platform-seed insert path).
//
// Exit code: 0 on clean, 1 on any failure. Designed to be cheap enough
// to run in pre-push and CI.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');

// Tables that are ENABLE-only (no FORCE) by design. Each entry needs a
// one-line reason; reviewers should push back on additions.
const ENABLE_ONLY_TABLES = new Set<string>([
  'users', // Better Auth sign-in lookup needs cross-tenant scan
  'sessions',
  'accounts',
  'verifications',
  'verification_tokens',
  'api_keys', // tenant-scoped at app layer; ENABLE-only to allow scoping by api_key_id
  // sparx platform legal acceptance (docs/42 §6) — written by signUpMerchant
  // via the owner connection WITHOUT tenant context (FORCE's WITH CHECK would
  // reject that insert since current_tenant_id() is null there). Same posture
  // as the auth tables; /v1/me/legal-* reads go through withRequestTenant so
  // the ENABLE policy still scopes sparx_app.
  'platform_legal_acceptance',
  // (Fitment reference tables were ENABLE-only while a platform-global Vehicle
  // domain existed; 20260923000000_fitment_remove_global_vehicle removed the
  // global concept and tightened them to tenant_id NOT NULL + FORCE, so they
  // are now ordinary tenant-scoped tables — no exemption needed.)
]);

// Tables intentionally WITHOUT RLS — tenant-shared reference data, OR non-RLS
// DISPATCH tables that must be readable before a tenant is known. Each entry
// needs a one-line reason; reviewers should push back on additions.
const SHARED_REFERENCE_TABLES = new Set<string>([
  // `domains` is the host→property (site) dispatch table (docs/49 §5). The
  // host→site resolver and the Caddy on-demand-TLS ask endpoint look up `host`
  // BEFORE any tenant is known, so the row must be readable without an
  // app.tenant_id GUC — exactly like the `tenants` table. `host` is GLOBALLY
  // unique (the cross-tenant guard: a host can't be claimed by two tenants);
  // the sensitive content a host points at (pages/orders/customers) stays
  // FORCE-RLS on its own tables, and management routes filter by tenant_id in
  // the app. Deliberately non-RLS (user-approved 2026-06-04).
  'domains',
  // `marketplace_publishers` (docs/60 §6) is the publisher-identity registry for
  // the cross-tenant marketplace. A published listing names its publisher to any
  // tenant AND to the public (no tenant context), so publisher identity is public
  // catalog metadata — deliberately non-RLS like `tenants`/`domains`. The
  // `owner_tenant_id` column trips the audit's tenant-id heuristic; the catalog
  // tables themselves (marketplace_blueprints/themes/components/integrations) DO
  // carry ENABLE+FORCE + a `marketplace_visibility` policy.
  'marketplace_publishers',
]);

interface TableDef {
  name: string;
  migration: string;
  hasTenantId: boolean;
}

interface RlsState {
  hasEnable: boolean;
  hasForce: boolean;
  hasPolicy: boolean;
}

interface AuditFinding {
  table: string;
  migration: string;
  missing: string[];
}

// The unsafe form: a raw `current_setting('app.<name>')` with NO missing_ok
// second arg — it THROWS (42704) on an unset GUC instead of returning NULL.
// The safe forms never match: the `current_tenant_id()` / `current_user_id()`
// helpers don't contain a literal `current_setting('app.…')`, and the explicit
// `current_setting('app.tenant_id', true)` has `, true` before the close paren.
const UNSAFE_GUC_RE = /current_setting\(\s*'app\.[a-z_]+'\s*\)/i;

// The effective (last-defined) policy form per table.
interface PolicyForm {
  migration: string;
  unsafe: boolean;
}

// A cross-tenant dispatch scan: `find_*` + SECURITY DEFINER. Captures the name,
// the header (params → SET/STABLE, where SECURITY DEFINER lives) and the body.
// The other SECURITY DEFINER functions in the schema (resolve_b2b_price,
// sync_b2b_credit_used, ensure_crm_activities_partition, current_user_id) are
// deliberately NOT matched: they are called from a request that already carries
// tenant context, so the tenant_isolation policy is exactly what they want.
const SCAN_FN_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(find_[a-z0-9_]*)\s*\(([\s\S]*?)AS\s+\$\$([\s\S]*?)\$\$/gi;

// Relations a scan body reads. Over-matches by design (aliases, LATERAL, CTEs);
// the result is intersected with the known-table set, which filters those out.
const SCAN_TABLE_REF_RE = /\b(?:FROM|JOIN)\s+"?([a-z_][a-z0-9_]*)"?/gi;

// A policy handing the definer role its read: `TO sparx_owner`, whether the
// narrow FOR SELECT form or the FOR ALL one used by platform_components.
const OWNER_GRANT_RE = /\bTO\s+sparx_owner\b/i;

/** A scan function and the tables it reads. Last definition wins — several are
 *  redefined by later migrations (find_due_calendar_connections,
 *  find_active_scheduled_automations), and only the final body is live. */
interface ScanFn {
  migration: string;
  tables: string[];
}

function main(): void {
  const migrations = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory())
    .sort();

  const tables: TableDef[] = [];
  const rlsByTable = new Map<string, RlsState>();
  // Last-definition-wins: the form of the most recent CREATE POLICY per table.
  const policyForm = new Map<string, PolicyForm>();
  // Tables carrying a policy that grants the definer role a read.
  const ownerReadTables = new Set<string>();
  // Cross-tenant dispatch scans, by function name (last definition wins).
  const scanFns = new Map<string, ScanFn>();

  for (const m of migrations) {
    const sqlPath = path.join(MIGRATIONS_DIR, m, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // CREATE TABLE — capture each table and whether it has tenant_id.
    const createRe = /CREATE TABLE "?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\n\)\s*;/gi;
    let cm: RegExpExecArray | null;
    while ((cm = createRe.exec(sql)) !== null) {
      const name = cm[1]!;
      const body = cm[2]!;
      const hasTenantId = /"?tenant_id"?\s+UUID/i.test(body);
      tables.push({ name, migration: m, hasTenantId });
      if (!rlsByTable.has(name)) {
        rlsByTable.set(name, { hasEnable: false, hasForce: false, hasPolicy: false });
      }
    }

    // ENABLE / FORCE — collect for every table seen so far.
    const enableRe = /ALTER TABLE "?([a-z_][a-z0-9_]*)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    let em: RegExpExecArray | null;
    while ((em = enableRe.exec(sql)) !== null) {
      const t = em[1]!;
      const state = rlsByTable.get(t) ?? { hasEnable: false, hasForce: false, hasPolicy: false };
      state.hasEnable = true;
      rlsByTable.set(t, state);
    }
    const forceRe = /ALTER TABLE "?([a-z_][a-z0-9_]*)"?\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi;
    let fm: RegExpExecArray | null;
    while ((fm = forceRe.exec(sql)) !== null) {
      const t = fm[1]!;
      const state = rlsByTable.get(t) ?? { hasEnable: false, hasForce: false, hasPolicy: false };
      state.hasForce = true;
      rlsByTable.set(t, state);
    }
    // Capture the full statement body (to the terminating `;`) so we can
    // inspect its USING / WITH CHECK expression for the unsafe GUC form.
    const policyRe =
      /CREATE POLICY\s+"?[a-z_][a-z0-9_]*"?\s+ON\s+"?([a-z_][a-z0-9_]*)"?([\s\S]*?);/gi;
    let pm: RegExpExecArray | null;
    while ((pm = policyRe.exec(sql)) !== null) {
      const t = pm[1]!;
      const body = pm[2] ?? '';
      const state = rlsByTable.get(t) ?? { hasEnable: false, hasForce: false, hasPolicy: false };
      state.hasPolicy = true;
      rlsByTable.set(t, state);
      // Last write wins: a later migration recreating the policy in the safe
      // form clears an earlier raw one.
      policyForm.set(t, { migration: m, unsafe: UNSAFE_GUC_RE.test(body) });
      // Additive, NOT last-write-wins: the owner-read grant is a SEPARATE policy
      // sitting alongside tenant_isolation on the same table, so a later
      // tenant_isolation rewrite must not appear to revoke it.
      if (OWNER_GRANT_RE.test(body)) ownerReadTables.add(t);
    }

    // Cross-tenant dispatch scans and the relations they read.
    SCAN_FN_RE.lastIndex = 0;
    let sm: RegExpExecArray | null;
    while ((sm = SCAN_FN_RE.exec(sql)) !== null) {
      const [, name, header = '', fnBody = ''] = sm;
      if (!/SECURITY\s+DEFINER/i.test(header)) continue;
      const refs = new Set<string>();
      SCAN_TABLE_REF_RE.lastIndex = 0;
      let rm: RegExpExecArray | null;
      while ((rm = SCAN_TABLE_REF_RE.exec(fnBody)) !== null) refs.add(rm[1]!);
      scanFns.set(name!, { migration: m, tables: [...refs] });
    }
  }

  // Dedupe table list by name; last definition wins (some are altered later).
  const tablesByName = new Map<string, TableDef>();
  for (const t of tables) tablesByName.set(t.name, t);

  const findings: AuditFinding[] = [];

  for (const t of tablesByName.values()) {
    if (SHARED_REFERENCE_TABLES.has(t.name)) continue;
    if (!t.hasTenantId) continue; // Junction tables ride through FK parents.

    const state = rlsByTable.get(t.name) ?? {
      hasEnable: false,
      hasForce: false,
      hasPolicy: false,
    };

    const missing: string[] = [];
    if (!state.hasEnable) missing.push('ENABLE ROW LEVEL SECURITY');

    if (!ENABLE_ONLY_TABLES.has(t.name)) {
      if (!state.hasForce) missing.push('FORCE ROW LEVEL SECURITY');
      if (!state.hasPolicy) missing.push('CREATE POLICY tenant_isolation');
    }

    if (missing.length > 0) {
      findings.push({ table: t.name, migration: t.migration, missing });
    }
  }

  // Effective-policy form check: flag any table whose last-defined policy still
  // reads its tenant GUC through a raw `current_setting('app.<x>')`.
  const unsafeGuc = [...policyForm.entries()]
    .filter(([, form]) => form.unsafe)
    .map(([table, form]) => ({ table, migration: form.migration }));

  // Scan-reachability check: every FORCE-RLS table a cross-tenant scan reads
  // must grant the definer role a read, or the scan returns zero rows in prod.
  // Intersecting with the known-table set drops aliases/CTEs/LATERAL noise, and
  // non-RLS relations (`tenants`, `domains`) need no policy by definition.
  const unreadableScans = [...scanFns.entries()]
    .map(([fn, def]) => ({
      fn,
      migration: def.migration,
      blocked: def.tables.filter(
        (t) => rlsByTable.get(t)?.hasForce === true && !ownerReadTables.has(t)
      ),
    }))
    .filter((s) => s.blocked.length > 0);

  const totalTenantTables = [...tablesByName.values()].filter(
    (t) => t.hasTenantId && !SHARED_REFERENCE_TABLES.has(t.name)
  ).length;

  console.log(`Audited ${tablesByName.size} tables (${totalTenantTables} tenant-scoped).`);
  console.log(`  ENABLE-only by design: ${ENABLE_ONLY_TABLES.size}`);
  console.log(`  Shared reference (no RLS): ${SHARED_REFERENCE_TABLES.size}`);
  console.log(`  Cross-tenant dispatch scans: ${scanFns.size}`);

  if (findings.length === 0 && unsafeGuc.length === 0 && unreadableScans.length === 0) {
    console.log(
      '\nOK — every tenant-scoped table has the required RLS clauses, every policy reads its\n' +
        'GUC via current_tenant_id(), and every cross-tenant scan can read what it scans.'
    );
    process.exit(0);
  }

  if (findings.length > 0) {
    console.error(`\nFAIL — ${findings.length} table(s) missing RLS clauses:\n`);
    for (const f of findings) {
      console.error(`  ${f.table}  (introduced in ${f.migration})`);
      for (const m of f.missing) console.error(`    - missing: ${m}`);
    }
    console.error(
      '\nFix: hand-edit the relevant migration SQL to add the missing clauses (Prisma will not generate them).'
    );
  }

  if (unsafeGuc.length > 0) {
    console.error(
      `\nFAIL — ${unsafeGuc.length} table(s) whose effective policy uses a raw current_setting('app.…') GUC:\n`
    );
    for (const f of unsafeGuc) {
      console.error(`  ${f.table}  (last defined in ${f.migration})`);
    }
    console.error(
      '\nFix: add a later migration that DROPs + recreates each policy with the\n' +
        'missing-safe helper — USING (tenant_id = current_tenant_id()) — which\n' +
        'returns NULL on an unset GUC instead of throwing 42704 under FORCE RLS.\n' +
        '(See 20260801000000_fix_b2b_import_rls_guc for the canonical pattern.)'
    );
  }

  if (unreadableScans.length > 0) {
    console.error(
      `\nFAIL — ${unreadableScans.length} cross-tenant scan(s) read a FORCE-RLS table the\n` +
        'definer role cannot see. Each returns ZERO ROWS in prod — silently, with no\n' +
        'error — so whatever background feature it drives never fires:\n'
    );
    for (const s of unreadableScans) {
      console.error(`  ${s.fn}()  (defined in ${s.migration})`);
      for (const t of s.blocked) console.error(`    - no owner read on: ${t}`);
    }
    console.error(
      '\nFix: add a migration granting the definer a read on each table listed —\n' +
        '  CREATE POLICY <table>_owner_read ON "<table>"\n' +
        '      AS PERMISSIVE FOR SELECT TO sparx_owner USING (true);\n' +
        'This opens nothing for sparx_app and grants no cross-tenant WRITE: the scan\n' +
        'only READS, and the per-row work still runs under withTenant({tenantId}).\n' +
        '(See 20270126000000_scan_owner_rls_backfill for the canonical pattern.)'
    );
  }

  process.exit(1);
}

main();
