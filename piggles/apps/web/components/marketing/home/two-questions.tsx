import { Section } from '@piggles/ui';
import { TwoQuestionsForm } from '../two-questions';

export function TwoQuestions() {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div className="rise max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          You answer two questions. It arrives set up.
        </h2>
        <p className="mt-6 text-lg">
          No empty workspace, no manual. What you pick changes what you see first &mdash; never what
          you are allowed to have. Here are the two, and here is what they cost.
        </p>
      </div>

      <TwoQuestionsForm />
    </Section>
  );
}
