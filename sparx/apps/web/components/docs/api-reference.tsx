/**
 * API-reference primitives — the second docs archetype. A reference page is a
 * two-column layout: parameter/return/error descriptions on the left, sticky
 * request/response examples on the right. It reuses the same sidebar shell as
 * guides (provided by app/docs/layout.tsx); only the content area differs.
 *
 * Nested object parameters render inline and indented (always visible) rather
 * than behind a toggle — docs read better when nothing is hidden.
 */
import type { ReactNode } from 'react';
import { Breadcrumb, Badge, type BadgeTone, type Crumb } from './prose';

export function ApiReference({
  breadcrumb,
  title,
  method,
  url,
  description,
  left,
  right,
}: {
  breadcrumb?: Crumb[];
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  description: ReactNode;
  /** Left column: parameters, returns, errors. */
  left: ReactNode;
  /** Right column (sticky): request + response cards. */
  right: ReactNode;
}) {
  const tone: BadgeTone =
    method === 'GET' ? 'get' : method === 'DELETE' ? 'del' : method === 'POST' ? 'post' : 'gray';
  return (
    <div className="docs-main">
      <div className="docs-api-head">
        {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
        <div className="docs-title-row">
          <h1 className="docs-title">
            {title}
            <span className="docs-spark">.</span>
          </h1>
        </div>
        <div className="docs-api-route">
          <Badge tone={tone}>{method}</Badge>
          <span className="path">{url}</span>
        </div>
        <p className="docs-api-desc">{description}</p>
      </div>

      <div className="docs-api-cols">
        <div className="docs-api-left">{left}</div>
        <div className="docs-api-right">{right}</div>
      </div>
    </div>
  );
}

/** Uppercase section divider in a reference page ("Body parameters", "Returns"). */
export function ApiSection({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <>
      <h2 className="docs-sec">{title}</h2>
      {children}
    </>
  );
}

export function ApiParam({
  name,
  type,
  required,
  children,
  nested,
}: {
  name: ReactNode;
  type?: ReactNode;
  required?: boolean;
  /** Description. */
  children: ReactNode;
  /** Nested child <ApiParam>s for object/array-of-object params. */
  nested?: ReactNode;
}) {
  return (
    <div className="docs-param">
      <div className="docs-param-head">
        <span className="docs-param-name">{name}</span>
        {type ? <span className="docs-param-type">{type}</span> : null}
        {required ? (
          <span className="docs-param-req">Required</span>
        ) : (
          <span className="docs-param-opt">Optional</span>
        )}
      </div>
      <p className="docs-param-desc">{children}</p>
      {nested ? <div className="docs-param-children">{nested}</div> : null}
    </div>
  );
}

/** An error-row variant: just a code+message label and a description. */
export function ApiError({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="docs-param">
      <div className="docs-param-head">
        <span className="docs-param-name">{label}</span>
      </div>
      <p className="docs-param-desc">{children}</p>
    </div>
  );
}
