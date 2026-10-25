import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabaseUrl, pgbouncerIni, pooledUrl, readEnv, userlist } from './pgbouncer-config.mjs';

const RAW = 'postgresql://sparx_app:p%40ss%22w@psql-sparx-prod-cus.postgres.database.azure.com:5432/sparx?sslmode=require';

test('reads DATABASE_URL from a dotenv body and keeps = inside the value', () => {
  assert.equal(readEnv('A=1\nDATABASE_URL=x?a=b\n', 'DATABASE_URL'), 'x?a=b');
  assert.equal(readEnv('A=1\n', 'DATABASE_URL'), undefined);
});

test('parses user, decoded password, host and database', () => {
  const db = parseDatabaseUrl(RAW);
  assert.deepEqual(db, {
    user: 'sparx_app',
    password: 'p@ss"w',
    host: 'psql-sparx-prod-cus.postgres.database.azure.com',
    port: '5432',
    database: 'sparx',
  });
});

test('refuses a URL with no password', () => {
  assert.throws(() => parseDatabaseUrl('postgresql://sparx_app@h:5432/sparx'));
});

test('ini is transaction mode with TLS to the server and a capped server pool', () => {
  const ini = pgbouncerIni(parseDatabaseUrl(RAW));
  assert.match(ini, /^sparx = host=psql-sparx-prod-cus\.postgres\.database\.azure\.com port=5432 dbname=sparx$/m);
  assert.match(ini, /^pool_mode = transaction$/m);
  assert.match(ini, /^server_tls_sslmode = require$/m);
  assert.match(ini, /^max_db_connections = 7$/m);
  assert.doesNotMatch(ini, /user=/);
});

test('userlist doubles embedded quotes', () => {
  assert.equal(userlist(parseDatabaseUrl(RAW)), '"sparx_app" "p@ss""w"\n');
});

test('pooled URL points at PgBouncer, drops TLS in-cluster, turns prepared statements off', () => {
  const url = new URL(pooledUrl(RAW, 'pgbouncer.sparx-prod.svc.cluster.local'));
  assert.equal(url.host, 'pgbouncer.sparx-prod.svc.cluster.local:5432');
  assert.equal(url.searchParams.get('sslmode'), 'disable');
  assert.equal(url.searchParams.get('pgbouncer'), 'true');
  assert.equal(decodeURIComponent(url.password), 'p@ss"w');
  assert.equal(url.pathname, '/sparx');
});
