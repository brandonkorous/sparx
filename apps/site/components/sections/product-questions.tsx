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
    <section className="py-16">
      <h2 className="text-base-content mb-4 text-3xl font-semibold tracking-tight">
        {config.heading}
      </h2>
      {questions.length > 0 ? (
        <ul className="m-0 mb-5 list-none p-0">
          {questions.map((q) => (
            <li key={q.id} className="border-base-300 border-b py-4 first:pt-0">
              <p className="text-base-content m-0 mb-2 leading-normal">
                <strong>Q:</strong> {q.body}
                {q.displayName ? (
                  <span className="text-base-content font-normal"> — {q.displayName}</span>
                ) : null}
              </p>
              {q.answers.map((a) => (
                <p
                  key={a.id}
                  className="text-base-content m-0 mb-1.5 flex flex-wrap items-baseline gap-1.5 pl-4 leading-normal"
                >
                  <strong>A:</strong> {a.body}
                  {a.isOfficial ? (
                    <span className="badge badge-primary badge-sm">Store</span>
                  ) : null}
                </p>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base-content mb-5">{config.emptyText}</p>
      )}
      {config.showForm ? (
        <QuestionForm tenantSlug={ctx.tenantSlug} handle={product.handle} />
      ) : null}
    </section>
  );
}
