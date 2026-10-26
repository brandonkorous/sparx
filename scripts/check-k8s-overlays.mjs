#!/usr/bin/env node
// Do the rendered Azure overlays keep the availability rules the bug plan added? (SI-3, SI-5)
// Renders k8s/azure/infra and k8s/azure/apps with `kubectl kustomize` (client-side only) and checks
// each rule against the object it is about. Needs kubectl on PATH, as every CI runner has.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The rendered document for kind/name, or ''. */
export function findDoc(rendered, kind, name) {
  return rendered.split(/^---$/m).find((d) => new RegExp(`^kind: ${kind}$`, 'm').test(d) && new RegExp(`^  name: ${name}$`, 'm').test(d)) ?? '';
}

/** One rule: a label and the problem text when the predicate fails. */
const rule = (ok, problem) => (ok ? [] : [problem]);

/** Caddy: two pods, rolled without a gap, kept on one node for the RWO cert disk. */
export function caddyProblems(infra) {
  const d = findDoc(infra, 'Deployment', 'caddy');
  return [
    ...rule(/^  replicas: ([2-9]|\d{2,})$/m.test(d), 'caddy must run at least 2 replicas'),
    ...rule(/type: RollingUpdate/.test(d) && /maxUnavailable: 0/.test(d), 'caddy must roll with maxUnavailable 0'),
    ...rule(/podAffinity:[\s\S]*app: caddy[\s\S]*topologyKey: kubernetes\.io\/hostname/.test(d), 'caddy pods must share a node (RWO cert disk)'),
  ];
}

/** Memory request of a Deployment's first container, in Mi (0 when absent). */
export function memoryRequestMi(doc) {
  const m = /requests:\n(?:\s+cpu: \S+\n)?\s+memory: "?(\d+)(Mi|Gi)"?/.exec(doc);
  if (!m) return 0;
  return m[2] === 'Gi' ? Number(m[1]) * 1024 : Number(m[1]);
}

/** Piggles sign-in authority: two pods, a PDB that keeps one, requests at measured RSS. */
export function pigglesProblems(apps) {
  const account = findDoc(apps, 'Deployment', 'piggles-account');
  const pdb = findDoc(apps, 'PodDisruptionBudget', 'piggles-account');
  return [
    ...rule(/^  replicas: ([2-9]|\d{2,})$/m.test(account), 'piggles-account must run at least 2 replicas'),
    ...rule(/minAvailable: 1/.test(pdb), 'piggles-account needs a PDB with minAvailable 1 in the Azure overlay'),
    ...rule(memoryRequestMi(account) >= 400, 'piggles-account must request at least 400Mi (measured 351 MB)'),
    ...rule(memoryRequestMi(findDoc(apps, 'Deployment', 'piggles-console')) >= 400, 'piggles-console must request at least 400Mi (measured 365 MB)'),
  ];
}

/** Every problem across both rendered overlays. */
export function overlayProblems({ infra, apps }) {
  return [...caddyProblems(infra), ...pigglesProblems(apps)];
}

function render(root, dir) {
  return execFileSync('kubectl', ['kustomize', path.join(root, dir)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = overlayProblems({ infra: render(root, 'k8s/azure/infra'), apps: render(root, 'k8s/azure/apps') });
  if (problems.length === 0) return console.log('check:k8s-overlays — availability rules hold.');
  for (const p of problems) console.error(`check:k8s-overlays — ${p}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
