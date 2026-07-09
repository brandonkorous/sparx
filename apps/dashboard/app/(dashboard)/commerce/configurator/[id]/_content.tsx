import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Settings2 } from 'lucide-react';

import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';
import { statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { TemplateStatusBar } from './_components/template-status-bar';
import { TemplateJsonEditor } from './_components/template-json-editor';

interface ConfigurationChoice {
  key: string;
  label: string;
  variantId?: string;
  addOnVariantId?: string;
  priceDeltaCents?: number;
  metadataPayload?: Record<string, unknown>;
  swatchHex?: string;
  imageMediaId?: string;
  position: number;
}

interface ConfigurationOption {
  key: string;
  label: string;
  helpText?: string;
  type: 'single_choice' | 'multi_choice' | 'toggle' | 'text' | 'number';
  required: boolean;
  minSelections?: number;
  maxSelections?: number;
  defaultChoiceKeys: string[];
  groupHeader?: string;
  position: number;
  choices: ConfigurationChoice[];
}

interface ConfigurationRuleCondition {
  optionKey: string;
  op: 'in' | 'not_in' | 'gt' | 'lt' | 'eq';
  value: string | number | string[];
}

type ConfigurationRuleAction =
  | { kind: 'require'; optionKey: string }
  | { kind: 'hide'; optionKey: string }
  | { kind: 'show_only_choices'; optionKey: string; choiceKeys: string[] }
  | { kind: 'price_adjust'; deltaCents: number; label?: string }
  | { kind: 'add_addon'; variantId: string; quantity: number }
  | { kind: 'error'; message: string };

interface ConfigurationRule {
  name: string;
  match: 'all' | 'any';
  conditions: ConfigurationRuleCondition[];
  actions: ConfigurationRuleAction[];
  priority: number;
}

interface ConfigurationAddOn {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  defaultIncluded: boolean;
  priceOverrideCents?: number;
}

interface ConfigurationTemplateDetail {
  id: string;
  productId: string;
  productTitle: string;
  name: string;
  description: string | null;
  status: string;
  optionCount: number;
  ruleCount: number;
  addOnCount: number;
  updatedAt: string;
  layout: unknown;
  options: ConfigurationOption[];
  rules: ConfigurationRule[];
  addOns: ConfigurationAddOn[];
}

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function ConfiguratorTemplateDetailContent({ id }: Props) {
  let template: ConfigurationTemplateDetail;
  try {
    template = await api.get<ConfigurationTemplateDetail>(
      `/v1/commerce/configurator-templates/${id}`
    );
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Settings2 className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{template.name}</h1>
            <Badge color={statusTone(template.status)} variant="soft" size="sm">
              {statusLabel(template.status)}
            </Badge>
          </div>
          <p className="text-base-content/70 text-sm">
            Product:{' '}
            <Link
              href={`/commerce/products/${template.productId}`}
              className="hover:text-module underline"
            >
              {template.productTitle}
            </Link>
            {template.description ? ` · ${template.description}` : ''}
          </p>
        </div>
        <TemplateStatusBar templateId={template.id} status={template.status} />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Options</h3>
            <p className="opacity-70">
              {template.options.length} option{template.options.length === 1 ? '' : 's'} that the
              customer picks from.
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Type</th>
                <th>Required</th>
                <th>Choices</th>
              </tr>
            </thead>
            <tbody>
              {template.options.map((o) => (
                <tr key={o.key}>
                  <td>
                    <span className="font-mono text-xs">{o.key}</span>
                  </td>
                  <td>{o.label}</td>
                  <td>
                    <Badge color="neutral" variant="soft" size="sm">
                      {statusLabel(o.type)}
                    </Badge>
                  </td>
                  <td>{o.required ? 'yes' : 'no'}</td>
                  <td>{o.choices.length}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Rules</h3>
            <p className="opacity-70">
              {template.rules.length} rule{template.rules.length === 1 ? '' : 's'} that hide/require
              options or adjust price as selections change.
            </p>
          </div>
          {template.rules.length === 0 ? (
            <p className="text-base-content/70 text-sm">No rules — every option is independent.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Match</th>
                  <th>Conditions</th>
                  <th>Actions</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {template.rules.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>
                      <Badge color="neutral" variant="soft" size="sm">
                        {statusLabel(r.match)}
                      </Badge>
                    </td>
                    <td>{r.conditions.length}</td>
                    <td>{r.actions.length}</td>
                    <td>{r.priority}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Add-ons</h3>
            <p className="opacity-70">
              Optional variants that ride along with the resolved selection — e.g. installation
              kits, gift wrap.
            </p>
          </div>
          {template.addOns.length === 0 ? (
            <p className="text-base-content/70 text-sm">No add-ons.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Add-on</th>
                  <th>Default included</th>
                  <th>Price override</th>
                </tr>
              </thead>
              <tbody>
                {template.addOns.map((a) => (
                  <tr key={a.variantId}>
                    <td>
                      <div className="flex flex-col gap-0">
                        <p className="text-sm">{a.productTitle ?? a.variantId.slice(0, 8)}</p>
                        {a.variantSku && (
                          <p className="text-base-content/70 font-mono text-xs">{a.variantSku}</p>
                        )}
                      </div>
                    </td>
                    <td>{a.defaultIncluded ? 'yes' : 'no'}</td>
                    <td>
                      {a.priceOverrideCents != null
                        ? `$${(a.priceOverrideCents / 100).toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Edit definition</h3>
            <p className="opacity-70">
              JSON editor — paste in an updated template payload. The visual rule editor is on the
              roadmap; until then, this is the source of truth.
            </p>
          </div>
          <TemplateJsonEditor
            templateId={template.id}
            initial={{
              name: template.name,
              description: template.description ?? undefined,
              layout: template.layout,
              options: template.options,
              rules: template.rules,
              addOns: template.addOns,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
