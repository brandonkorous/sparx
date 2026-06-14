// Bound product section — published Q&A list + ask-a-question form.

import type { ProductQuestionsConfig } from '@sparx/sitebuilder-schemas';

import { QuestionForm } from '@/components/question-form';
import type { SectionContext } from '../section-renderer';

export function ProductQuestionsSection({
  config,
  ctx,
}: {
  config: ProductQuestionsConfig;
  ctx: SectionContext;
}) {
  const product = ctx.product;
  if (!product) return null;
  const questions = ctx.productExtras?.questions ?? [];
  return (
    <section className="st-section">
      <h2 className="st-h2" style={{ marginBottom: '1rem' }}>
        {config.heading}
      </h2>
      {questions.length > 0 ? (
        <ul className="st-qa" style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem' }}>
          {questions.map((q) => (
            <li key={q.id} className="st-qa__item">
              <p className="st-qa__q">
                <strong>Q:</strong> {q.body}
                {q.displayName ? (
                  <span className="st-muted" style={{ fontWeight: 400 }}>
                    {' '}
                    — {q.displayName}
                  </span>
                ) : null}
              </p>
              {q.answers.map((a) => (
                <p key={a.id} className="st-qa__a">
                  <strong>A:</strong> {a.body}
                  {a.isOfficial ? <span className="st-qa__official">Store</span> : null}
                </p>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="st-muted" style={{ marginBottom: '1.25rem' }}>
          {config.emptyText}
        </p>
      )}
      {config.showForm ? (
        <QuestionForm tenantSlug={ctx.tenantSlug} handle={product.handle} />
      ) : null}
    </section>
  );
}
