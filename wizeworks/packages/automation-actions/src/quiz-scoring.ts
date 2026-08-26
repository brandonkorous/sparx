// A quiz result becomes a real CRM score (docs/151 §7, docs/152 C3).
//
// ── WHY THIS LIVES IN THE ACTION LAYER ───────────────────────────────────────
//
// It reads a FORM definition and writes a CRM score, which makes it neither
// package's business: putting it in `@wizeworks/crm` would have that package
// depend on the builder's schemas to understand a form's config, and putting it
// in the builder would have the builder writing lead scores. Cross-module
// orchestration is exactly what the action layer is for, and this package
// already depends on both sides.
//
// ── AND WHY THE SCORE IS A REAL CRM SCORE ────────────────────────────────────
//
// A quiz that concludes somebody is ready to buy and leaves no trace the sales
// side can see is a toy. The points go through the ordinary scoring model, so
// the quiz shows up in `explain_crm_score` beside every other reason the number
// is what it is, and whoever picks the lead up can see what moved it.

import { withTenant } from '@wizeworks/db';
import { isQuiz, readQuizScoring, scoreAnswers } from '@wizeworks/builder-schemas';
import { scoringService } from '@wizeworks/crm';

export interface QuizScoringInput {
  submissionId: string;
}

interface Ctx {
  tenantId: string;
  tx?: unknown;
}

/**
 * Apply a quiz's outcome to the contact the capture step just created.
 *
 * Runs after `captureFormLead` in the same automation step, so there is somebody
 * to score. Idempotent on `quizScoredAt`: the action is retried on failure, and
 * points added twice would inflate a lead a little more every time a worker
 * hiccuped.
 *
 * A no-op unless the form actually carries weights AND the author opted in to
 * scoring people with it. That second gate is a real distinction rather than
 * belt-and-braces: a quiz can tell a visitor their result without also making a
 * claim about them in the CRM, and that is the safer thing to default to.
 */
export async function scoreFormQuiz(ctx: Ctx, input: QuizScoringInput): Promise<void> {
  const svcCtx = ctx as Parameters<typeof scoringService.applyQuizPoints>[0];

  const sub = await withTenant(svcCtx, (tx) =>
    tx.formSubmission.findUnique({
      where: { id: input.submissionId },
      select: {
        customerId: true,
        status: true,
        propertyId: true,
        formNodeId: true,
        fields: true,
        quizScoredAt: true,
      },
    })
  );
  // Nothing to score without somebody to score. Spam never scores, and an
  // already-stamped row is the retry case.
  if (!sub?.customerId || !sub.propertyId) return;
  if (sub.status === 'spam' || sub.quizScoredAt) return;
  const { customerId, propertyId } = sub;

  const definition = await withTenant(svcCtx, (tx) =>
    tx.formDefinition.findUnique({
      where: { propertyId_formNodeId: { propertyId, formNodeId: sub.formNodeId } },
      select: { config: true },
    })
  );
  // A form whose settings panel was never opened has no row, which is a working
  // form with no scoring — not an error.
  if (!definition) return;

  const cfg = definition.config as Record<string, unknown> | null;
  const scoring = readQuizScoring(cfg?.scoring);
  if (!isQuiz(scoring) || !scoring.scoreContact) return;

  const values =
    sub.fields && typeof sub.fields === 'object' ? (sub.fields as Record<string, string>) : {};
  const result = scoreAnswers(scoring, values);

  await withTenant(svcCtx, async (tx) => {
    // Stamped in the SAME transaction as the score write, so a crash between the
    // two cannot leave a submission that gets scored again.
    await tx.formSubmission.update({
      where: { id: input.submissionId },
      data: { quizScoredAt: new Date() },
    });
    // A zero-point result is still recorded. "They took it and matched nothing"
    // is exactly what the sales side needs, and recording silence would make an
    // answered quiz indistinguishable from one nobody opened.
    await scoringService.applyQuizPoints(
      { ...svcCtx, tx },
      {
        customerId,
        points: result.points,
        reason: scoring.reason || 'Answered a quiz on the site',
      }
    );
  });
}
