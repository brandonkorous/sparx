import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET,
  parseBaseReplicas,
  parseBudget,
  parseMatrix,
  parseReplicaOverrides,
  poolKind,
  tally,
} from './check-db-budget.mjs';

const BUDGET_YAML = `# header
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-rest
  namespace: sparx-prod
spec:
  template:
    spec:
      containers:
        - name: api-rest
          env:
            - { name: DB_CONNECTION_LIMIT, value: '4' }
            - { name: AUTH_DB_CONNECTION_LIMIT, value: '1' }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-worker
spec:
  template:
    spec:
      containers:
        - name: event-worker
          env:
            - { name: DB_CONNECTION_LIMIT, value: '2' }
`;

test('reads app and auth limits per Deployment', () => {
  assert.deepEqual(parseBudget(BUDGET_YAML), {
    'api-rest': { db: 4, auth: 1, operator: 0 },
    'event-worker': { db: 2, auth: 0, operator: 0 },
  });
});

test('the direct total may not pass the 35 usable connections (event-worker forced to 20 did)', () => {
  const budget = { ...parseBudget(BUDGET_YAML), admin: { db: 0, auth: 0, operator: 2 } };
  const kinds = { 'api-rest': 'db', 'event-worker': 'db', admin: 'operator' };
  const ok = tally({ budget, replicas: { 'api-rest': 2 }, kinds, operatorMax: 5 });
  assert.equal(ok.direct, 2 * 5 + 2 + 2);
  const forced = { ...budget, 'event-worker': { db: 20, auth: 0, operator: 0 } };
  const over = tally({ budget: forced, replicas: { 'api-rest': 4 }, kinds, operatorMax: 5 });
  assert.match(over.problems[0], /direct to Postgres the pools total 42, over the 35/);
});

test('reads replica overrides and base replicas', () => {
  const kust = 'images: []\nreplicas:\n  # note\n  - name: api-rest\n    count: 2\n  - name: web\n    count: 1\n\npatches: []\n';
  assert.deepEqual(parseReplicaOverrides(kust), { 'api-rest': 2, web: 1 });
  const base = 'kind: Deployment\nmetadata:\n  name: admin\nspec:\n  replicas: 1 # x\n---\nkind: Service\nmetadata:\n  name: admin\n';
  assert.deepEqual(parseBaseReplicas([base]), { admin: 1 });
});

test('maps release images to source directories', () => {
  const matrix = '- { name: web, dockerfile: sparx/apps/web/Dockerfile }\n- {\n  name: api-rest,\n  dockerfile: wizeworks/services/api-rest/Dockerfile,\n}';
  assert.deepEqual(parseMatrix(matrix), { web: 'sparx/apps/web', 'api-rest': 'wizeworks/services/api-rest' });
});

test('classifies packages by the pools they open', () => {
  assert.equal(poolKind('{"dependencies":{"@wizeworks/auth":"workspace:*"}}'), 'db');
  assert.equal(poolKind('{"dependencies":{"@wizeworks/operator-auth":"workspace:*"}}'), 'operator');
  assert.equal(poolKind('{"dependencies":{"next":"16"}}'), null);
});

test('a database-using Deployment with no limit fails (the state before SI-1)', () => {
  const { problems } = tally({ budget: {}, replicas: {}, kinds: { 'api-graphql': 'db' }, operatorMax: 5 });
  assert.match(problems[0], /api-graphql uses the database but has no DB_CONNECTION_LIMIT/);
});

test('sums direct pools, and through PgBouncer counts only its server pool plus owner and operator pools', () => {
  const budget = parseBudget(BUDGET_YAML);
  const kinds = { 'api-rest': 'db', 'event-worker': 'db', admin: 'operator' };
  const pooler = { pods: 2, max: 9 };
  const ok = tally({ budget, replicas: { 'api-rest': 2 }, kinds, operatorMax: 5, pooler });
  assert.equal(ok.direct, 2 * 5 + 2 + 5);
  assert.equal(ok.pooled, 18 + 2 * 1 + 5);
  assert.deepEqual(ok.problems, []);
  const over = tally({ budget, replicas: { 'api-rest': 20 }, kinds, operatorMax: 5, pooler });
  assert.ok(over.pooled > BUDGET);
  assert.match(over.problems.at(-1), /over the budget/);
});

test('a pool the code raises at boot must be stated at its real size', () => {
  const budget = parseBudget(BUDGET_YAML);
  const kinds = { 'api-rest': 'db', 'event-worker': 'db' };
  const { problems } = tally({ budget, replicas: {}, kinds, operatorMax: 5, codeFloors: { 'event-worker': 20 } });
  assert.match(problems[0], /event-worker: code raises its pool to 20/);
});

test('a budget entry for a Deployment that does not use the database is flagged', () => {
  const { problems } = tally({ budget: parseBudget(BUDGET_YAML), replicas: {}, kinds: { 'api-rest': 'db' }, operatorMax: 5 });
  assert.match(problems[0], /names event-worker/);
});
