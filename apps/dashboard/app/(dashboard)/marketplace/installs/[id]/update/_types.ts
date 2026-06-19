// The update-changeset shape returned by GET /v1/blueprints/installs/:id/update
// (docs/55 §6, §10). Mirrors the api-rest UpdatePlan (camelCase, returned as-is).

export interface UpdateFieldChange {
  /** Globally addressable conflict id: `${kind}:${naturalKey}#${path}`. */
  id: string;
  path: string;
  type: 'auto' | 'conflict';
  base: unknown;
  mine: unknown;
  theirs: unknown;
  taken: 'mine' | 'theirs';
}

export interface UpdateArtifactDiff {
  kind: string;
  naturalKey: string;
  refId: string | null;
  status: 'unchanged' | 'updated' | 'conflict' | 'new' | 'removed' | 'detached' | 'tenant_deleted';
  changes: UpdateFieldChange[];
}

export interface UpdatePlan {
  installId: string;
  blueprintKey: string;
  fromVersion: string;
  toVersion: string;
  updatable: boolean;
  artifacts: UpdateArtifactDiff[];
  summary: { updated: number; conflicts: number; auto: number; new: number; removed: number };
}
