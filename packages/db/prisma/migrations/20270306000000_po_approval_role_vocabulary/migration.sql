-- docs/146 Phase 8.5 — the approver role has to be a role this platform HAS.
--
-- `20270304000000` shipped the CHECK as `owner | admin | member`, which is Better
-- Auth's organisation vocabulary rather than sparx's. The real staff ladder is
-- `owner | admin | editor | viewer | api` (`users.role`, and the ranked ladder in
-- packages/api-core/src/auth.ts), and there is no `member` in it.
--
-- Left alone, a rule saying "any team member signs this" routes to a role nobody
-- holds: the order would be held forever with no possible approver, and the
-- screen would give no hint why. That is a spending control that silently stops
-- purchasing — the worst failure available to this feature.
--
-- `viewer` is deliberately NOT offered either. A viewer is read-only by
-- definition, so a rule routing to one is the same dead end wearing a name that
-- does exist.

-- Nothing has shipped with a `member` rule (Phase 8 is uncommitted), but the
-- backfill runs anyway: this migration must be correct on any database that
-- applied 0304 before this landed, and BEFORE the constraint, or every such row
-- fails the ALTER instantly. (Phase 7 learned that one the direct way.)
UPDATE "inventory_po_approval_rules"
SET "required_role" = 'admin'
WHERE "required_role" = 'member';

ALTER TABLE "inventory_po_approval_rules"
  DROP CONSTRAINT "inventory_po_approval_rules_role_check";
ALTER TABLE "inventory_po_approval_rules"
  ADD CONSTRAINT "inventory_po_approval_rules_role_check" CHECK (
    "required_role" IS NULL OR "required_role" IN ('owner', 'admin', 'editor')
  );
