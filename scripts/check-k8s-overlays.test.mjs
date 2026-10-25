import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caddyProblems, findDoc } from './check-k8s-overlays.mjs';

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
