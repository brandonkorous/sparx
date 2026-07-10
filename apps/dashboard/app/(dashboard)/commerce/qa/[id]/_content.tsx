import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import { AnswerForm } from './_components/answer-form';
import { QuestionModerateActions } from './_components/question-moderate-actions';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

interface AnswerRow {
  id: string;
  body: string;
  isOfficial: boolean;
  authorCustomerId: string | null;
  authorUserId: string | null;
  createdAt: string;
}

interface QuestionCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

interface QuestionDetail {
  id: string;
  productId: string;
  body: string;
  status: string;
  createdAt: string;
  productTitle: string | null;
  productHandle: string | null;
  customer: QuestionCustomer | null;
  answers: AnswerRow[];
}

function displayCustomer(c: QuestionCustomer | null): string {
  if (!c) return 'Anonymous';
  const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return full !== '' ? full : (c.email ?? 'Customer');
}

export async function QuestionDetailContent({ id }: Props) {
  let detail: QuestionDetail;
  try {
    detail = await api.get<QuestionDetail>(`/v1/commerce/questions/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle/moderation controls teleport into the shared detail
          chrome's header (drawer/modal chrome or the full-page shell),
          parity with ConfiguratorTemplate. */}
      <DetailHeaderSlot>
        <QuestionModerateActions questionId={detail.id} status={detail.status} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Question</h1>
          <div className="flex flex-row items-center gap-2">
            <Badge color={statusTone(detail.status)} variant="soft" size="sm">
              {statusLabel(detail.status)}
            </Badge>
            <p className="text-base-content/70 text-sm">
              {displayCustomer(detail.customer)} · {new Date(detail.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Question body</h3>
            <p className="opacity-70">
              Product:{' '}
              {detail.productTitle ? (
                <Link
                  href={`/commerce/products/${detail.productId}`}
                  className="hover:text-module hover:underline"
                >
                  {detail.productTitle}
                </Link>
              ) : (
                'Deleted product'
              )}
            </p>
          </div>
          <p className="whitespace-pre-wrap">{detail.body}</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Answers</h3>
            <p className="opacity-70">
              Official answers are shown first on the storefront and carry a staff badge.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {detail.answers.length === 0 ? (
              <p className="text-base-content/70 text-sm">
                No answers yet — post the first one below.
              </p>
            ) : (
              detail.answers.map((a) => (
                <div key={a.id} className="flex flex-col gap-1">
                  <div className="flex flex-row items-center gap-2">
                    {a.isOfficial ? (
                      <Badge color="success" variant="soft" size="sm">
                        Staff
                      </Badge>
                    ) : (
                      <Badge color="neutral" variant="soft" size="sm">
                        Customer
                      </Badge>
                    )}
                    <p className="text-base-content/70 text-xs">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap">{a.body}</p>
                </div>
              ))
            )}
            <AnswerForm questionId={detail.id} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
