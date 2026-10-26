import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextProblems, parseMatrixEntries, releaseProblems } from './check-next-actions-key.mjs';

const RELEASE = `matrix:
  include:
    - { name: web, dockerfile: sparx/apps/web/Dockerfile, actions_key: NEXT_ACTIONS_KEY_WEB }
    - {
          name: api-rest,
          dockerfile: wizeworks/services/api-rest/Dockerfile,
      }
build-args: |
    WIZELENS_RELEASE=\${{ github.sha }}
run: key=$(az keyvault secret show --vault-name v --name n --query value -o tsv)
secrets: |
    next_actions_key=\${{ env.NEXT_ACTIONS_KEY }}
`;
const DOCKERFILE = `RUN --mount=type=secret,id=next_actions_key \\
    key="$(cat /run/secrets/next_actions_key)"; export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$key"; pnpm build
ARG WIZELENS_RELEASE=local
`;
const MANIFEST = `            - name: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: sparx-app-secrets
                  key: NEXT_ACTIONS_KEY_WEB
                  optional: true
`;

test('parses one-line and multi-line matrix entries', () => {
  assert.deepEqual(parseMatrixEntries(RELEASE), [
    { name: 'web', dockerfile: 'sparx/apps/web/Dockerfile', actionsKey: 'NEXT_ACTIONS_KEY_WEB' },
    { name: 'api-rest', dockerfile: 'wizeworks/services/api-rest/Dockerfile', actionsKey: undefined },
  ]);
});

test('a fully wired Next app has no problems', () => {
  const [web] = parseMatrixEntries(RELEASE);
  assert.deepEqual(nextProblems(web, { dockerfile: DOCKERFILE, manifest: MANIFEST, release: RELEASE }), []);
});

test('the state before SI-2 fails: no key anywhere', () => {
  const entry = { name: 'web', dockerfile: 'sparx/apps/web/Dockerfile' };
  assert.match(nextProblems(entry, { dockerfile: 'RUN pnpm build', manifest: '', release: '' })[0], /no actions_key/);
  const keyed = { ...entry, actionsKey: 'NEXT_ACTIONS_KEY_WEB' };
  const problems = nextProblems(keyed, { dockerfile: 'RUN pnpm build', manifest: '', release: '' });
  assert.equal(problems.length, 3);
});

test('a key read from a GitHub secret is reported', () => {
  const [web] = parseMatrixEntries(RELEASE);
  const release = `${RELEASE}env:
    NEXT_ACTIONS_KEY_WEB: \${{ secrets.NEXT_ACTIONS_KEY_WEB }}
`;
  const problems = nextProblems(web, { dockerfile: DOCKERFILE, manifest: MANIFEST, release });
  assert.match(problems[0], /must come from Key Vault/);
});

test('an image without ARG WIZELENS_RELEASE is reported', () => {
  const entry = { name: 'api-rest', dockerfile: 'x/Dockerfile' };
  assert.deepEqual(releaseProblems(entry, DOCKERFILE, RELEASE), []);
  assert.match(releaseProblems(entry, 'FROM base', RELEASE)[0], /no ARG WIZELENS_RELEASE/);
});
