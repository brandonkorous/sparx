#!/usr/bin/env node
// PgBouncer config for the release (SI-1): built from the DATABASE_URL the apps already use.
//
//   node scripts/pgbouncer-config.mjs files <env-file> <out-dir>   writes pgbouncer.ini + userlist.txt
//   node scripts/pgbouncer-config.mjs pooled-url <env-file> <host>  prints DATABASE_URL pointed at PgBouncer
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Server connections per PgBouncer pod (2 pods = 18) for sparx_app; ticks park one each, so this is the big share.
export const SERVER_POOL = { default: 7, reserve: 2, max: 9 };

/** The value of `key` in a dotenv file body, or undefined. */
export function readEnv(body, key) {
  const line = body.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line === undefined ? undefined : line.slice(key.length + 1);
}

/** user, password, host, port and database of a postgres URL. */
export function parseDatabaseUrl(raw) {
  const url = new URL(raw);
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error('DATABASE_URL is not a postgres URL');
  const database = url.pathname.replace(/^\//, '');
  if (!url.username || !url.password || !database) throw new Error('DATABASE_URL needs a user, password and database');
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port || '5432',
    database,
  };
}

/** pgbouncer.ini: transaction mode (RLS uses SET LOCAL), TLS to Azure, one database. */
export function pgbouncerIni(db) {
  return [
    '[databases]',
    `${db.database} = host=${db.host} port=${db.port} dbname=${db.database}`,
    '',
    '[pgbouncer]',
    'listen_addr = 0.0.0.0',
    'listen_port = 5432',
    'auth_type = scram-sha-256',
    'auth_file = /etc/pgbouncer/userlist.txt',
    'pool_mode = transaction',
    'max_client_conn = 500',
    `default_pool_size = ${SERVER_POOL.default}`,
    `reserve_pool_size = ${SERVER_POOL.reserve}`,
    `max_db_connections = ${SERVER_POOL.max}`,
    'max_prepared_statements = 200',
    'server_tls_sslmode = require',
    'server_idle_timeout = 60',
    'ignore_startup_parameters = extra_float_digits,search_path',
    '',
  ].join('\n');
}

/** userlist.txt line; a double quote inside a value is doubled, per the PgBouncer format. */
export function userlist(db) {
  const q = (s) => `"${s.replaceAll('"', '""')}"`;
  return `${q(db.user)} ${q(db.password)}\n`;
}

/** DATABASE_URL rewritten to reach PgBouncer: in-cluster plain TCP, prepared statements off. */
export function pooledUrl(raw, host) {
  const url = new URL(raw);
  url.hostname = host;
  url.port = '5432';
  url.searchParams.set('sslmode', 'disable');
  url.searchParams.set('pgbouncer', 'true');
  return url.toString();
}

function main([mode, envFile, target]) {
  const raw = readEnv(fs.readFileSync(envFile, 'utf8'), 'DATABASE_URL');
  if (!raw) throw new Error(`DATABASE_URL missing from ${envFile}`);
  if (mode === 'pooled-url') return process.stdout.write(pooledUrl(raw, target));
  if (mode !== 'files') throw new Error(`unknown mode "${mode}"`);
  const db = parseDatabaseUrl(raw);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'pgbouncer.ini'), pgbouncerIni(db));
  fs.writeFileSync(path.join(target, 'userlist.txt'), userlist(db), { mode: 0o600 });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
