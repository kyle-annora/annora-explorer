import { QuoteScopeSummary } from "../product-room/quote-scope-summary.jsx";
import React, { useState } from "react";
import {
  Button,
  Comparison,
  Evidence,
  Field,
  Glyph,
  Section,
  Status,
} from "../product-room/ui/components.jsx";
import { compareQuotes, quoteScopeLabel, inquiryIntentLabel, inquiryQuantityLabel } from "../product-room/project-domain.js";
import { inquiryField } from "../product-room/inquiry-profile.js";
import { STUDIO_ASSETS } from "./seed.js";
import { date, readRoute } from "./navigation.js";
import {
  readWalkthroughSession,
  withWalkthroughSession,
} from "../walkthrough/session.js";
import { recordContext } from "../product-room/drawing-revision.js";
import { DrawingReference } from "../product-room/drawing-reference.jsx";
import { InspectionReference } from "../product-room/inspection-reference.jsx";
import { RequestItemsSummary } from "../product-room/request-items-view.jsx";
import crankImage from "../product-room/assets/crank.png";
import { setProjectReferenceIdentity } from "../product-room/project-reference-navigation.js";

export const money = (value) =>
  value === null || value === undefined
    ? "To confirm"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
export function buyerURL(project, explore = false) {
  const url = new URL("../product-room/", location.href);
  const example = new URLSearchParams(location.search).get('followUpDemo');
  if (example) url.searchParams.set('followUpDemo', example);
  const optionsExample = new URL(location.href).searchParams.get('optionDemo');
  if (optionsExample) url.searchParams.set('optionDemo',optionsExample);
  const impactExample = new URL(location.href).searchParams.get('impactDemo');
  if (impactExample) url.searchParams.set('impactDemo', impactExample);
  url.searchParams.set("model", project.context.modelId);
  if (explore) {
    url.searchParams.set("returnRole", "seller");
    url.searchParams.set("returnView", location.hash);
    url.hash = `explore&project=${encodeURIComponent(project.id)}`;
    setProjectReferenceIdentity(url, project, project.context);
  } else {
    const route = readRoute();
    const query = new URLSearchParams({ project: project.id });
    if (route.tab)
      query.set("tab", route.tab === "conversation" ? "activity" : route.tab);
    if (route.quote) query.set("quote", route.quote);
    url.hash = `project&${query}`;
  }
  const session = readWalkthroughSession();
  return (session ? withWalkthroughSession(url, session) : url).href;
}
export function SmallLink({ href, children, ...props }) {
  return (
    <a href={href} className="studio-text-link" {...props}>
      {children}
      <Glyph name={props.target === "_blank" ? "external" : "arrow"} />
    </a>
  );
}
export function QuoteSummary({ quote, previous, productTitle = "Crank-slider assembly", drawing = null, showComparison = true, comparisonExpanded = false, project }) {
  const [expandedFor, setExpandedFor] = useState(null);
  const comparisonKey = `${previous?.id}:${quote?.id}:${quote?.version}`;
  const showUnchanged = expandedFor === comparisonKey;
  const comparisonRows =
    previous && quote ? compareQuotes(previous, quote, project) : [];
  const changedRows = comparisonRows.filter((row) => row.changed);
  if (!quote) return null;
  return (
    <div className="customer-quote-summary">
      <div className="customer-quote-masthead">
        <div>
          <p className="ar-eyebrow">
            QUOTATION{quote.version ? ` · VERSION ${quote.version}` : ""}
          </p>
          <h2>{productTitle}</h2>
          <p>
            {quote.source === "sample"
              ? "Preserved sample quotation"
              : "Seller-prepared demonstration quotation"}
          </p>
        </div>
        <div className="customer-subtotal">
          <span>Priced subtotal · USD</span>
          <strong>{money(quote.subtotal)}</strong>
          <small>Final total remains to confirm</small>
        </div>
      </div>
      {drawing && <p className="customer-fine">Drawing reference: {drawing.title} · {drawing.revisionLabel || drawing.revision} · {drawing.sheetTitle} · {drawing.regionLabel}{drawing.mappingRevision ? ` · ${drawing.mappingRevision}` : ""}. Preserved with this project; dimensions remain to confirm.</p>}
      {showComparison && previous && (
        <details className="customer-disclosure customer-comparison" key={comparisonKey} open={comparisonExpanded || undefined}>
          <summary>Compare with version {previous.version}<span>{changedRows.length} changes</span></summary>
          <div>
          <p className="customer-fine">
            {changedRows.length
              ? `${changedRows.length} changed fields. Unchanged terms are kept in the full quotation below.`
              : "No commercial fields changed."}
          </p>
          <Comparison
            rows={showUnchanged ? comparisonRows : changedRows}
            beforeLabel={`Version ${previous.version}`}
            afterLabel={quote.version ? `Version ${quote.version}` : "Draft"}
          />
          <Button
            variant="quiet"
            aria-expanded={showUnchanged}
            onClick={() => setExpandedFor(showUnchanged ? null : comparisonKey)}
          >
            {showUnchanged ? "Show changes only" : "Include unchanged fields"}
          </Button>
          </div>
        </details>
      )}
      <section className="customer-document-section">
        <h3>Scope</h3>
        {project && <p className="customer-fine">Customer requested scope: {quoteScopeLabel(project.inquiry.values, project.context)}.</p>}
        <p className="customer-preserve">{quote.scope}</p>
      </section>
      <QuoteScopeSummary selection={quote.scopeSelection} questionScope={quote.questionScope} impactScope={quote.impactScope} lineItems={quote.lineItems} project={project} />
      <section className="customer-document-section">
        <h3>Pricing</h3>
        <div className="customer-price-table">
          <div className="customer-price-labels">
            <span>Item</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span>Amount</span>
          </div>
          {quote.lineItems.map((item, index) => (
            <div className="customer-price-row" key={item.id || index}>
              <strong>{item.label}</strong>
              <span data-label="Quantity">{item.quantity ?? "To confirm"}</span>
              <span data-label="Unit price">{money(item.unitPrice)}</span>
              <span data-label="Amount">{money(item.amount)}</span>
            </div>
          ))}
        </div>
        <p className="customer-fine">
          Unpriced items are excluded from the subtotal. No payment or order is
          created.
        </p>
      </section>
      <div className="customer-document-grid">
        <section>
          <h3>Requested timing</h3>
          <p>
            {quote.requestedWeeks
              ? `${quote.requestedWeeks} weeks`
              : "To discuss"}
          </p>
        </section>
        <section>
          <h3>Proposed lead time</h3>
          <p>{quote.proposedLeadTime}</p>
        </section>
      </div>
      {quote.assumptions?.length > 0 && (
        <section className="customer-document-section">
          <h3>Assumptions</h3>
          <ul>
            {quote.assumptions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {quote.exclusions?.length > 0 && (
        <section className="customer-document-section">
          <h3>Exclusions</h3>
          <ul>
            {quote.exclusions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {quote.validity && (
        <section className="customer-document-section">
          <h3>Validity</h3>
          <p>{quote.validity}</p>
        </section>
      )}
      {quote.openItems?.length > 0 && (
        <details className="customer-disclosure">
          <summary>
            Items to confirm <span>{quote.openItems.length}</span>
          </summary>
          <ul>
            {quote.openItems.map((item) => (
              <li key={item.id}>
                {item.label} <small>· {item.owner}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="customer-document-footer">
        <Evidence kind="sample">
          Fictional demonstration · this browser only
        </Evidence>
        {quote.createdAt && <span>{date(quote.createdAt)}</span>}
      </div>
    </div>
  );
}
export function InquiryDetails({ project, buyerHref = buyerURL }) {
  const { values, requirements } = project.inquiry;
  const fields = [
    ["Company", values.company, "company"],
    ["Contact", values.name, "name"],
    ["Email", values.email, "email"],
    ["Quantity", inquiryQuantityLabel(values), "quantity"],
    [
      "Requested timing",
      values.targetWeeks ? `${values.targetWeeks} weeks` : "",
      "targetWeeks",
    ],
    ["Stroke", values.stroke ? `${values.stroke} mm` : "", "stroke"],
    ["Load", values.load, "load"],
  ].filter(([, value, id]) => inquiryField(project.context, id)?.enabled || value);
  return (
    <Section
      title="Customer inquiry"
      description="The details confirmed by the customer. Original product references stay with this project."
    >
      <div className="customer-application">
        <span className="customer-label">Application</span>
        <p>{values.application}</p>
      </div>
      <dl className="customer-facts">
        <div><dt>Inquiry intent</dt><dd>{inquiryIntentLabel(values)}</dd></div>
        <div><dt>Requested quote scope</dt><dd>{quoteScopeLabel(values, project.context)}</dd></div>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "To discuss"}</dd>
          </div>
        ))}
      </dl>
      {values.notes && (
        <div className="customer-document-section">
          <h3>Customer notes</h3>
          <p className="customer-preserve">{values.notes}</p>
        </div>
      )}
      <RequestItemsSummary items={project.inquiry.requestItems} hrefFor={item => {
        const url = new URL(buyerHref({ ...project, context: item.context }, true));
        url.searchParams.set("project", project.id);
        url.searchParams.set("requestItem", item.id);
        if (item.context.drawing) url.searchParams.set("view", "drawings");
        return url.href;
      }} />
      {requirements?.length > 0 && (
        <div className="customer-document-section">
          <h3>Confirmed requirements</h3>
          {requirements.map((item) => (
            <div className="customer-requirement" key={item.id}>
              <strong>{item.label}</strong>
              <span>
                {item.value} {item.unit}
              </span>
              <Evidence
                kind={item.source === "customer" ? "customer" : "model"}
              >
                {item.source === "customer"
                  ? "Customer input"
                  : "Model reference · customer confirmed"}
              </Evidence>
            </div>
          ))}
        </div>
      )}
      <p className="customer-fine">
        Inquiry {project.inquiry.id} · {date(project.inquiry.createdAt)}
      </p>
    </Section>
  );
}
export function ProductReference({ project, buyerHref = buyerURL }) {
  const context = project.context,
    snapshot = context.roomSnapshot;
  const docs = snapshot?.content.documents || [];
  const associated = context.part
    ? snapshot?.content.partContent?.find(
        (part) => part.nodeId === context.part.id,
      )?.documentIds || []
    : [];
  const selectedDocs = docs.filter(
    (doc) => doc.id === context.document?.id || associated.includes(doc.id),
  );
  const visibleDocs = selectedDocs.length ? selectedDocs : docs;
  return (
    <>
    <InspectionReference context={context} href={buyerHref(project, true)} />
    <details className="customer-reference">
      <summary>
        <span>Product reference<small>{context.part?.title || context.productTitle}{context.drawing ? ` · ${context.drawing.revisionLabel || context.drawing.revision}` : snapshot ? ` · Version ${snapshot.version}` : ""}</small></span>
        <Glyph name="document" />
      </summary>
      <div className="customer-reference-body">
        {!context.inspection && !context.drawing && context.modelId === "kinetic-01" && <img
          src={crankImage}
          alt="Crank-slider mechanism"
          width="240"
          height="150"
        />}
        <h3>{context.productTitle}</h3>
        <dl>
          <div>
            <dt>Component</dt>
            <dd>{context.part?.title || "Whole assembly"}</dd>
          </div>
          {context.drawing && <>
            <div><dt>Drawing</dt><dd>{context.drawing.title}</dd></div>
            <div><dt>Source edition</dt><dd>{context.drawing.revisionLabel || context.drawing.revision}</dd></div>
            <div><dt>Sheet</dt><dd>{context.drawing.sheetTitle}</dd></div>
            <div><dt>Selected detail</dt><dd>{context.drawing.regionLabel}</dd></div>
            {context.drawing.mappingRevision && <div><dt>Mapping edition</dt><dd>{context.drawing.mappingRevision}</dd></div>}
          </>}
          <div>
            <dt>Product content</dt>
            <dd>
              {snapshot
                ? `Version ${snapshot.version}`
                : "Original project reference"}
            </dd>
          </div>
        </dl>
        {!context.inspection && <SmallLink href={buyerHref(project, true)}>{context.drawing ? "View selected drawing detail" : "View in 3D"}</SmallLink>}
        {context.drawing && <>
          <p className="customer-fine">Pinned viewing context. Dimensions, tolerances and manufacturing suitability remain to confirm.</p>
          <details><summary>Exact drawing reference</summary>
            <p className="customer-preserve">Model: {context.modelId}<br />Model revision: {context.modelRevision}<br />Drawing: {context.drawing.id}<br />Sheet: {context.drawing.sheetId}<br />Region: {context.drawing.regionId}<br />Part: {context.drawing.partId}<br />Asset: {context.drawing.assetId}<br />Asset revision: {context.drawing.assetRevision}</p>
            <SmallLink href={context.drawing.sourceURL} target="_blank" rel="noopener noreferrer">View original source</SmallLink>
          </details>
        </>}
        {visibleDocs.length > 0 && (
          <div className="customer-reference-docs">
            <span className="customer-label">Linked documents</span>
            {visibleDocs.map((doc) => {
              const asset = STUDIO_ASSETS.find((a) => a.id === doc.assetId);
              return asset ? (
                <a key={doc.id} href={asset.url} target="_blank" rel="noopener">
                  <Glyph name="document" />
                  <span>
                    {doc.title}
                    <small>{doc.revision}</small>
                  </span>
                  <Glyph name="external" />
                </a>
              ) : (
                <p key={doc.id}>
                  {doc.title}
                  <small>{doc.revision} · Reference retained</small>
                </p>
              );
            })}
          </div>
        )}
        <p className="customer-fine">
          Pinned to the inquiry. New product releases do not change this
          reference.
        </p>
      </div>
    </details>
    </>
  );
}
export function responseFor(change, kind = "reply") {
  const topics = change
    ? [
        ["quantity", "Quantity", `${change.values.quantity} units`],
        [
          "timing",
          "Delivery timing",
          change.values.targetWeeks
            ? `${change.values.targetWeeks} weeks`
            : "To discuss",
        ],
        ...(change.values.notes
          ? [["notes", "Customer note", change.values.notes]]
          : []),
      ]
    : [];
  return {
    kind: change ? "change-response" : kind,
    body: "",
    changeId: change?.id || null,
    resolutions: topics.map(([topic]) => ({
      topic,
      status: "needs-info",
      response: "",
    })),
  };
}
export function ResponseFields({
  value,
  setValue,
  change,
  errors = {},
  allowKind = true,
}) {
  const labels = {
    quantity: "Quantity",
    timing: "Delivery timing",
    notes: "Customer note",
  };
  return (
    <div className="studio-form-stack">
      {allowKind && (
        <Field
          label="Reply type"
          value={value.kind}
          options={
            change
              ? [
                  ["change-response", "Respond to requested changes"],
                  ["clarification", "Ask for clarification"],
                ]
              : [
                  ["reply", "Reply to customer"],
                  ["clarification", "Ask for clarification"],
                ]
          }
          onChange={(event) => setValue({ ...value, kind: event.target.value })}
        />
      )}
      {change && (
        <div className="customer-request-summary">
          <strong>Customer requested</strong>
          <span>
            {change.values.quantity} units ·{" "}
            {change.values.targetWeeks
              ? `${change.values.targetWeeks} weeks requested`
              : "Timing to discuss"}
          </span>
          {change.values.notes && <p>{change.values.notes}</p>}
        </div>
      )}
      <Field
        label={
          value.kind === "clarification"
            ? "Question for the customer"
            : "Message to the customer"
        }
        textarea
        rows="4"
        value={value.body}
        error={errors.body}
        onChange={(event) => setValue({ ...value, body: event.target.value })}
        maxLength="4000"
      />
      {change && value.kind !== "clarification" && (
        <div className="customer-response-topics">
          <h3>Respond to each requested change</h3>
          <p className="customer-fine">
            An explanation can leave a point open. A reply alone does not create
            a new quotation.
          </p>
          {value.resolutions.map((item, index) => (
            <div key={item.topic} className="customer-response-topic">
              <Field
                label={`${labels[item.topic]} outcome`}
                options={[
                  ["needs-info", "Needs more information"],
                  ["accepted", "Accepted"],
                  ["alternative", "Alternative proposed"],
                ]}
                value={item.status}
                onChange={(event) =>
                  setValue({
                    ...value,
                    resolutions: value.resolutions.map((r, i) =>
                      i === index ? { ...r, status: event.target.value } : r,
                    ),
                  })
                }
              />
              <Field
                label={`${labels[item.topic]} response`}
                textarea
                rows="2"
                value={item.response}
                onChange={(event) =>
                  setValue({
                    ...value,
                    resolutions: value.resolutions.map((r, i) =>
                      i === index ? { ...r, response: event.target.value } : r,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export function ResponseSummary({ value }) {
  const labels = {
    quantity: "Quantity",
    timing: "Delivery timing",
    notes: "Customer note",
  };
  const status = {
    accepted: "Accepted",
    alternative: "Alternative proposed",
    "needs-info": "Needs more information",
  };
  return (
    <div className="customer-response-summary">
      <h3>
        {value.kind === "clarification"
          ? "Question for the customer"
          : "Message to the customer"}
      </h3>
      <p className="customer-preserve">{value.body}</p>
      {value.kind !== "clarification" &&
        value.resolutions?.map((item) => (
          <div key={item.topic}>
            <strong>{labels[item.topic]}</strong>
            <Status tone={item.status === "needs-info" ? "pending" : "neutral"}>
              {status[item.status]}
            </Status>
            <p>{item.response}</p>
          </div>
        ))}
    </div>
  );
}
export function Conversation({ project, buyerHref = buyerURL }) {
  const events = [
    {
      id: project.inquiry.id,
      createdAt: project.inquiry.createdAt,
      label: "Customer submitted an inquiry",
      role: "Customer",
      body: project.inquiry.values.application,
    },
    ...(project.drawingRevisions || []).map(change => ({ ...change, label: `Drawing reference reviewed · ${change.fromContext.drawing.revisionLabel || change.fromContext.drawing.revision} → ${change.context.drawing.revisionLabel || change.context.drawing.revision}`, role: "Seller", body: change.note })),
    ...project.quotes.map((q) => ({
      ...q,
      label: `Quotation version ${q.version} issued`,
      role: q.source === "sample" ? "Sample supplier" : "Seller",
      body: q.scope,
    })),
    ...project.changes.map((c) => ({
      ...c,
      label: `Changes requested · quotation v${c.quoteVersion}`,
      role: "Customer",
      body: `${c.values.quantity} units · ${c.values.targetWeeks ? `${c.values.targetWeeks} weeks requested` : "Timing to discuss"}${c.values.notes ? `\n${c.values.notes}` : ""}`,
    })),
    ...project.replies.map((r) => ({
      ...r,
      label: "Preserved sample supplier reply",
      role: "Sample supplier",
      body: r.topics.map((t) => `${t.label}: ${t.response}`).join("\n\n"),
    })),
    ...(project.messages || []).map((m) => ({
      ...m,
      label: {
        clarification: "Clarification requested",
        "customer-reply": "Customer clarification",
        "next-step-confirmation": "Next step confirmed",
        "change-response": "Response to requested changes",
        reply: "Seller reply",
      }[m.kind],
      role: m.authorRole === "buyer" ? "Customer" : "Seller",
    })),
    ...project.nextSteps.map((n) => ({
      ...n,
      label:
        n.intent === "discussion"
          ? "Discussion requested"
          : "Engineering review requested",
      role: "Customer",
      body: n.message,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Section
      title="Conversation"
      description="Shared replies, requested changes and quotation history."
    >
      <ol className="customer-timeline">
        {events.map((event) => (
          <li key={event.id}>
            <div className="customer-event-meta">
              <strong>{event.role}</strong>
              <time dateTime={event.createdAt}>{date(event.createdAt)}</time>
            </div>
            <h3>{event.label}</h3>
            <p className="customer-preserve">{event.body}</p>
            <DrawingReference context={recordContext(project, event)} href={buyerHref({ ...project, context: recordContext(project, event) }, true)} compact />
            {event.resolutions?.length > 0 && (
              <ResponseSummary value={{ ...event, body: "" }} />
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}
