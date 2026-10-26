import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caddyProblems, findDoc, memoryRequestMi, pigglesProblems } from './check-k8s-overlays.mjs';

const CADDY_TWO = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: caddy
spec:
  replicas: 2
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
    type: RollingUpdate
  template:
    spec:
      affinity:
        podAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels:
                app: caddy
            topologyKey: kubernetes.io/hostname
`;
const CADDY_BEFORE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: caddy
spec:
  replicas: 1
  strategy:
    type: Recreate
`;

test('finds a document by kind and name', () => {
  const rendered = `kind: Service\nmetadata:\n  name: caddy\n---\n${CADDY_TWO}`;
  assert.match(findDoc(rendered, 'Deployment', 'caddy'), /replicas: 2/);
  assert.equal(findDoc(rendered, 'Deployment', 'nope'), '');
});

test('one caddy pod on Recreate passes while the cert disk is RWO', () => {
  assert.deepEqual(caddyProblems(CADDY_BEFORE), []);
});

test('two co-located caddy pods pass only on Recreate (Multi-Attach hang, 10-26)', () => {
  assert.equal(caddyProblems(CADDY_TWO).length, 1);
  const recreate = CADDY_TWO.replace(/  strategy:[\s\S]*?type: RollingUpdate\n/, '  strategy:\n    type: Recreate\n');
  assert.deepEqual(caddyProblems(recreate), []);
});

test('two caddy pods without the same-node rule fail', () => {
  assert.equal(caddyProblems(CADDY_BEFORE.replace('replicas: 1', 'replicas: 2')).length, 1);
});

const deployment = (name, replicas, memory) =>
  `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\nspec:\n  replicas: ${replicas}\n  template:\n    spec:\n      containers:\n      - name: ${name}\n        resources:\n          requests:\n            cpu: 25m\n            memory: ${memory}\n`;
const PDB = 'apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: piggles-account\nspec:\n  minAvailable: 1\n';

test('reads a memory request in Mi or Gi', () => {
  assert.equal(memoryRequestMi(deployment('a', 1, '400Mi')), 400);
  assert.equal(memoryRequestMi(deployment('a', 1, '1Gi')), 1024);
  assert.equal(memoryRequestMi('kind: Deployment'), 0);
});

test('two account pods, a keeping PDB and 400Mi requests pass', () => {
  const apps = [deployment('piggles-account', 2, '400Mi'), PDB, deployment('piggles-console', 1, '400Mi')].join('---\n');
  assert.deepEqual(pigglesProblems(apps), []);
});

test('one account pod, no PDB and 256Mi requests (before SI-5) fail every rule', () => {
  const apps = [deployment('piggles-account', 1, '256Mi'), deployment('piggles-console', 1, '256Mi')].join('---\n');
  assert.equal(pigglesProblems(apps).length, 4);
});
