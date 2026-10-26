import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caddyProblems, findDoc, memoryRequestMi, pigglesProblems } from './check-k8s-overlays.mjs';

const CADDY_OK = `apiVersion: apps/v1
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
  const rendered = `kind: Service\nmetadata:\n  name: caddy\n---\n${CADDY_OK}`;
  assert.match(findDoc(rendered, 'Deployment', 'caddy'), /replicas: 2/);
  assert.equal(findDoc(rendered, 'Deployment', 'nope'), '');
});

test('two co-located caddy pods on a rolling update pass', () => {
  assert.deepEqual(caddyProblems(CADDY_OK), []);
});

test('one caddy pod on Recreate (before SI-3) fails all three rules', () => {
  assert.equal(caddyProblems(CADDY_BEFORE).length, 3);
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
