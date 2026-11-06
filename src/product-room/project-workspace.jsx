import { recordContext, projectDrawingContext } from "./drawing-revision.js";
import { DrawingReference } from "./drawing-reference.jsx";
import { InspectionReference } from "./inspection-reference.jsx";
import { RequestItemsSummary } from "./request-items-view.jsx";
import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  reviewInquiry,
  reviewRevision,
  reviewNextStep,
  compareQuotes,
  projectStatus,
  projectContextKey,
  sameProjectValue,
  QUOTE_SCOPES,
  quoteScopeLabel,
  INQUIRY_INTENTS,
  inquiryIntentLabel,
} from "./project-domain.js";
import { prepareInquirySubmission, confirmInquirySubmission } from "./inquiry-session.js";
import { inquiryField, inquiryFields } from "./inquiry-profile.js";
import { sampleInquiryValues } from "./project-fixtures.js";
import { prepareSampleInquiry } from "./inquiry-sample.js";
import {
  pendingProjectChange,
  pendingClarification,
  changeIsResolved,
  reviewCustomerReply,
} from "./seller-domain.js";
import { ProjectConversation } from "./project-conversation.jsx";
import {
  Button,
  ActionGroup,
  Field,
  Status,
  Evidence,
  Notice,
  Section,
  EmptyState,
  VersionSelector,
  Comparison,
} from "./ui/components.jsx";
import "./project-workspace.css";
import "./workspace-presentation.css";
import { updateBuyerLocation } from "./navigation.js";
import { readWalkthroughSession, withWalkthroughSession } from "../walkthrough/session.js";
import { registerWalkthroughAction } from "../walkthrough/actions.js";

const copy = (value) => JSON.parse(JSON.stringify(value));
const contextualURL = input => {
  const url = new URL(input,location.href), session = readWalkthroughSession();
  return session ? withWalkthroughSession(url,session).href : url.href;
};
const money = (value) =>
  value == null
    ? "Pending review"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Just now";
const fieldLabels = {
  application: "Application",
  quantity: "Quantity",
  targetWeeks: "Requested timing",
  stroke: "Required stroke",
  load: "Required load",
  notes: "Your notes",
  company: "Company",
  name: "Name",
  email: "Email",
};
function ConfiguredInquiryField({ context, values, ...props }) {
  const field = inquiryField(context, props.name, values);
  if (!field?.enabled) return null;
  return <Field {...props} label={field.label} hint={field.hint || undefined}
    unit={field.unit || undefined} required={field.required} optional={!field.required} />;
}
const hasInquiryFields = (context, ids) => ids.some(id => inquiryField(context, id)?.enabled);

/** Optional inputs stay available without competing with the initial request. */
function TechnicalDetails({ context, values, errors, children }) {
  const keys = ["stroke", "load", "notes"];
  const [open, setOpen] = useState(() => keys.some(key => values[key]?.trim() || inquiryField(context, key)?.required));
  const needsAttention = keys.some(key => errors[key]) || Boolean(errors.requirements);
  useEffect(() => { if (needsAttention) setOpen(true); }, [needsAttention]);
  const filled = keys.filter(key => values[key]?.trim()).length;
  return <details className="pw-optional-fields" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span>Technical details</span><small>{filled ? `${filled} added` : "Optional"}</small></summary>
    <div className="pw-optional-fields-body">{children}</div>
  </details>;
}

function savedStatus(project) {
  const state = projectStatus(project),
    latest = project.quotes.at(-1);
  const awaiting = Boolean(pendingProjectChange(project));
  const question = pendingClarification(project);
  const currentNext =
    latest && project.nextSteps.some((step) => step.quoteId === latest.id);
  return {
    label: state.label,
    action: question
      ? "Reply to question"
      : awaiting
      ? "View conversation"
      : latest && latest.version > 1 && !currentNext
        ? "Compare quotation"
        : latest && !currentNext
          ? "Review quotation"
          : "View project",
    tone: question ? "active" : awaiting
      ? "pending"
      : currentNext
        ? "complete"
        : latest
          ? "active"
          : "neutral",
  };
}

function ContextSummary({
  context,
  onExplore,
  onRemove,
  onAdopt,
  disabled = false,
  compact = false,
  showInspection = true,
}) {
  const referenceLabels = {
    part: "viewed component",
    document: "reference document",
    chapter: "explanation",
  };
  return (
    <div className={`pw-context ${compact ? "pw-context-compact" : ""}`}>
      {showInspection && <InspectionReference context={context} onOpen={onExplore} disabled={disabled} />}
      <div>
        {!(context.inspection && showInspection) && <>
          <p className="pw-eyebrow">PRODUCT CONTEXT</p>
          <strong>{context.productTitle || "Crank-slider mechanism"}</strong>
        </>}
        {["part", "document", "chapter"].map(
          (key) =>
            context[key] && (
              <div className="pw-context-reference" key={key}>
                <p>
                  {context[key].title}{context[key].revision ? ` · ${context[key].revision}` : ""}{" "}
                  <span className="pw-muted">· {referenceLabels[key]}</span>
                </p>
                {onRemove && !(key === "part" && context.drawing) && (
                  <Button
                    variant="quiet"
                    disabled={disabled}
                    aria-label={`Remove ${referenceLabels[key]}`}
                    onClick={() => onRemove(key)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ),
        )}
        {context.drawing && (
          <div className="pw-drawing-reference">
            <p className="pw-eyebrow">SELECTED DRAWING DETAIL</p>
            <strong>{context.drawing.regionLabel}</strong>
            <dl className="pw-drawing-facts">
              <div><dt>Drawing</dt><dd>{context.drawing.title}</dd></div>
              <div><dt>Revision</dt><dd>{context.drawing.revisionLabel || context.drawing.revision}</dd></div>
              <div><dt>Sheet</dt><dd>{context.drawing.sheetTitle}</dd></div>
            </dl>
            <p className="pw-muted">Saved as viewing context. Dimensions and tolerances remain subject to confirmation.</p>
            <details>
              <summary>Exact drawing reference</summary>
              <p>Drawing: {context.drawing.id}<br />Sheet: {context.drawing.sheetId}<br />Region: {context.drawing.regionId}<br />Part: {context.drawing.partId}<br />Asset: {context.drawing.assetId}<br />Asset revision: {context.drawing.assetRevision}{context.drawing.mappingRevision && <><br />Mapping revision: {context.drawing.mappingRevision}</>}</p>
              <a href={context.drawing.sourceURL} target="_blank" rel="noopener noreferrer">View source <span aria-hidden="true">↗</span></a>
            </details>
          </div>
        )}
      </div>
      {onExplore && !context.inspection && (
        <Button
          variant="quiet"
          disabled={disabled}
          onClick={() => onExplore(context)}
        >
          {context.drawing ? "View selected detail" : "View in 3D"} <span aria-hidden="true">↗</span>
        </Button>
      )}
      {onAdopt && (
        <Button variant="secondary" disabled={disabled} onClick={onAdopt}>
          Use current product reference
        </Button>
      )}
      <p className="pw-muted pw-release-reference">
        {context.roomReleaseId ? (context.roomSnapshot?.source === "preview" ? "Draft product preview" : `Product version ${context.roomSnapshot?.version}`) : context.drawing ? "Exact model and drawing references saved." : "Earlier project · Product version not recorded."}
      </p>
      {context.roomSnapshot && (
        <details className="pw-release-evidence">
          <summary>Product information at inquiry</summary>
          <p>{context.roomSnapshot.content.description}</p>
          {context.roomSnapshot.content.specGroups?.map(group => (
            <div key={group.id}><strong>{group.title}</strong><dl className="pw-facts">
              {group.facts.map((fact, index) => <div key={index}><dt>{fact.label}</dt><dd>{fact.value}<small>{fact.source}</small></dd></div>)}
            </dl></div>
          ))}
          <strong>Reference documents</strong>
          <ul>{context.roomSnapshot.content.documents.map(doc => <li key={doc.id}>{doc.title} · {doc.revision}</li>)}</ul>
          <small>Saved with this inquiry. Later product edits do not change this information.</small>
        </details>
      )}
      {!compact && (
        <details>
          <summary>Model reference</summary>
          <p>
            {context.modelId} · {context.modelRevision}
            {context.roomReleaseId && <><br />{context.roomReleaseId}</>}
          </p>
          <p>
            Viewing context helps locate the discussion. It does not confirm a
            requirement or engineering suitability.
          </p>
        </details>
      )}
    </div>
  );
}

/** Reference disclosure changes presentation only; the saved context is unchanged. */
function InquiryReference({ context, children, onExplore, disabled = false, showInspection = true, showDisclosure = true }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  if (!showDisclosure) return children;
  return <div className={`pw-inquiry-reference ${expanded ? "is-open" : ""}`}>
    {showInspection && <InspectionReference context={context} onOpen={onExplore} disabled={disabled} />}
    <button type="button" className="pw-reference-toggle" aria-expanded={expanded}
      aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
      <span>{!context.inspection && <small>Product reference</small>}<strong>{context.inspection ? "Reference details" : context.drawing?.regionLabel || context.part?.title || context.productTitle}</strong>
        <small>{context.drawing ? `${context.drawing.title} · ${context.drawing.revisionLabel || context.drawing.revision}` : context.roomSnapshot ? `Product version ${context.roomSnapshot.version}` : context.modelRevision}</small></span>
      <span aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button>
    <div id={contentId} className="pw-inquiry-reference-content">{children}</div>
  </div>;
}

function InquiryDocument({ draft, onExplore }) {
  const values = draft.values;
  return (
    <div className="pw-document">
      {draft.context.inspection ? <InquiryReference context={draft.context} onExplore={onExplore}>
        <ContextSummary context={draft.context} showInspection={false} compact />
      </InquiryReference> : <ContextSummary context={draft.context} onExplore={onExplore} compact />}
      <Section title={`${inquiryField(draft.context, "application").label} & requirements`}>
        <p className="pw-application">{values.application}</p>
        <dl className="pw-facts">
          <div><dt>Purpose</dt><dd>{inquiryIntentLabel(values)}</dd></div>
          <div><dt>Requested quote scope</dt><dd>{quoteScopeLabel(values, draft.context)}</dd></div>
          {["quantity", "targetWeeks", "stroke", "load"].filter(key => inquiryField(draft.context, key)?.enabled || values[key]).map((key) => (
            <div key={key}>
              <dt>{inquiryField(draft.context, key)?.label || fieldLabels[key]}</dt>
              <dd>
                {values[key]
                  ? `${values[key]}${key === "quantity" ? " units" : key === "targetWeeks" ? " weeks requested" : key === "stroke" ? " mm" : ""}`
                  : "To discuss"}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
      <RequestItemsSummary items={draft.requestItems} onOpen={onExplore} />
      <Section title="Confirmed customer inputs">
        {draft.requirements?.filter((r) => r.confirmed).length ? (
          <ul className="pw-requirements">
            {draft.requirements
              .filter((r) => r.confirmed)
              .map((r) => (
                <li key={r.id}>
                  <Evidence kind="customer">Customer confirmed</Evidence>
                  <strong>{r.label}</strong>
                  <p>
                    {r.value} {r.unit}
                  </p>
                  {r.part && <small>{r.part.title}</small>}
                </li>
              ))}
          </ul>
        ) : (
          <p className="pw-muted">
            No component requirement confirmed. Any viewed component remains
            reference context only.
          </p>
        )}
      </Section>
      {values.notes && (
        <Section title={inquiryField(draft.context, "notes").label}>
          <p className="pw-preserve">{values.notes}</p>
        </Section>
      )}
      {hasInquiryFields(draft.context, ["name", "company", "email"]) && <Section title="Contact">
        <dl className="pw-contact">
          {["name", "company", "email"].filter(key => inquiryField(draft.context, key)?.enabled || values[key]).map((key) => (
            <div key={key}>
              <dt>{inquiryField(draft.context, key)?.label || fieldLabels[key]}</dt>
              <dd>{values[key] || "Not provided"}</dd>
            </div>
          ))}
        </dl>
      </Section>}
    </div>
  );
}
function ProjectProgress({ project }) {
  const latest = project.quotes.at(-1),
    pendingChanges = Boolean(pendingProjectChange(project));
  const active =
    latest &&
    project.nextSteps.some((step) => step.quoteId === latest.id) &&
    !pendingChanges
      ? 3
      : latest
        ? 2
        : 1;
  return (
    <ol className="pw-progress" aria-label="Project progress">
      {["Inquiry", "Quotation", "Next step"].map((label, index) => (
        <li
          key={label}
          className={
            index + 1 < active
              ? "is-complete"
              : index + 1 === active
                ? "is-current"
                : ""
          }
          aria-current={index + 1 === active ? "step" : undefined}
        >
          <span>{index + 1 < active ? "✓" : `0${index + 1}`}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
function Workspace({ route, repository, navigate, onExplore, sellerURL, lifecycle }) {
  const isPreview = repository.mode === "preview";
  const inquiryOnly = repository.capabilities?.inquiryOnly === true;
  const [projects, setProjects] = useState([]),
    [drafts, setDrafts] = useState([]),
    [project, setProject] = useState(null),
    [draft, setDraftState] = useState(null);
  const [loading, setLoading] = useState(true),
    [leaving, setLeaving] = useState(false),
    [pending, setPending] = useState(""),
    [error, setError] = useState(null),
    [notice, setNotice] = useState(""),
    [errors, setErrors] = useState({});
  const [stage, setStageState] = useState("details"),
    [review, setReview] = useState(null),
    [tab, setTabState] = useState("quotation"),
    [quoteId, setQuoteIdState] = useState(null);
  const [mode, setModeState] = useState(null),
    [modeStage, setModeStageState] = useState("details"),
    [changeValues, setChangeValues] = useState({}),
    [nextValues, setNextValues] = useState({
      intent: "discussion",
      message: "",
    }),
    [modeReview, setModeReview] = useState(null);
  const [replyValues, setReplyValues] = useState({ body: "", replyTo: "" }),
    [updateAvailable, setUpdateAvailable] = useState(false);
  const [compare, setCompare] = useState(true),
    [allComparisonFields, setAllComparisonFieldsState] = useState(false),
    [saveState, setSaveState] = useState("");
  const activeOperation = useRef(null),
    draftRef = useRef(null),
    saveQueue = useRef(Promise.resolve()),
    autoTimer = useRef(null),
    alive = useRef(true),
    loadId = useRef(0),
    busy = useRef(false),
    heading = useRef(null),
    perQuoteDrafts = useRef({});
  const uiReady = useRef(false);
  const setStage = value => { setStageState(value); updateBuyerLocation({stage:value}); };
  const setTab = value => { setTabState(value); updateBuyerLocation({tab:value}); };
  const setQuoteId = value => { setQuoteIdState(value); updateBuyerLocation({quoteId:value}); };
  const setMode = value => { setModeState(value); updateBuyerLocation({mode:value,stage:undefined}); };
  const setModeStage = value => { setModeStageState(value); updateBuyerLocation({stage:value}); };
  const setAllComparisonFields = value => {
    const next = typeof value === 'function' ? value(allComparisonFields) : value;
    setAllComparisonFieldsState(next); updateBuyerLocation({compare:next ? 'all' : undefined});
  };
  lifecycle.route = route;
  lifecycle.requestDirty = Boolean(
    mode &&
      (mode === "message" ? replyValues.body.trim() : mode === "next"
        ? nextValues.message.trim()
        : changeValues.notes?.trim() ||
          (project?.quotes.find((item) => item.id === quoteId) &&
            (String(
              project.quotes.find((item) => item.id === quoteId).quantity,
            ) !== changeValues.quantity ||
              String(
                project.quotes.find((item) => item.id === quoteId)
                  .requestedWeeks || "",
              ) !== changeValues.targetWeeks))),
  );
  const setDraft = (value) => {
    draftRef.current =
      typeof value === "function" ? value(draftRef.current) : value;
    setDraftState(draftRef.current);
  };
  function revealHeading() {
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      const container = heading.current?.closest('.room-workspace');
      const top = container?.querySelector('.pw-topline') || container;
      if (top) {
        const headerBottom = document.querySelector('[data-workspace-header], .room-header')?.getBoundingClientRect().bottom || 0;
        window.scrollTo({top:Math.max(0,window.scrollY + top.getBoundingClientRect().top - headerBottom - 12),behavior:'instant'});
      }
    });
  }
  function report(e, focus = false) {
    setError(
      e?.message ||
        "This action could not be completed. Your input is still here. Please try again.",
    );
    setErrors(e?.fields || {});
    if (route.view === "project" && ["STALE_REVIEW", "CONFLICT"].includes(e?.code)) setUpdateAvailable(true);
    if (focus)
      requestAnimationFrame(() => {
        const target =
          document.querySelector('.room-workspace [aria-invalid="true"]') ||
          document.querySelector('.room-workspace [role="alert"]');
        if (target) {
          for (let parent = target.parentElement; parent; parent = parent.parentElement) {
            if (parent.tagName === "DETAILS") parent.open = true;
          }
          if (!target.matches("input,select,textarea")) target.tabIndex = -1;
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "center", behavior: "instant" });
        }
      });
  }
  function persistDraft() {
    clearTimeout(autoTimer.current);
    autoTimer.current = null;
    const operation = saveQueue.current
      .catch(() => {})
      .then(async () => {
        if (!draftRef.current) return null;
        const source = copy(draftRef.current),
          saved = await repository.saveDraft(source);
        if (draftRef.current?.id === saved.id) {
          const editedDuringSave =
            !sameProjectValue(draftRef.current.values, source.values) ||
            !sameProjectValue(draftRef.current.requirements, source.requirements);
          setDraft({
            ...draftRef.current,
            revision: saved.revision,
            updatedAt: saved.updatedAt,
          });
          if (alive.current)
            setSaveState(
              editedDuringSave
                ? "Unsaved changes"
                : (isPreview ? "Draft saved in this preview" : "Draft saved in this browser"),
            );
        }
        return saved;
      });
    saveQueue.current = operation;
    return operation;
  }
  lifecycle.beforeLeave = async (nextRoute) => {
    const sameWorkspace = nextRoute?.view === route.view && nextRoute?.projectId === route.projectId;
    if (sameWorkspace && (!mode || nextRoute.mode === mode)) {
      if (route.view === 'inquiry' && draftRef.current) {
        try { await persistDraft(); } catch (error) { report(error,true); return false; }
      }
      return true;
    }
    lifecycle.leaving = true;
    setLeaving(true);
    if (activeOperation.current) await activeOperation.current;
    if (lifecycle.requestDirty) {
      report(
        new Error(
          "Your request has not been confirmed. Review and confirm it, or return to the quotation to leave this form.",
        ),
        true,
      );
      lifecycle.leaving = false;
      setLeaving(false);
      return false;
    }
    if (
      !draftRef.current ||
      (!draftRef.current.revision &&
        !Object.entries(draftRef.current.values).some(([key, value]) => value && (key !== "quoteScope" || value !== "discuss")))
    )
      return true;
    try {
      await persistDraft();
      return true;
    } catch (error) {
      report(error, true);
      setSaveState("Draft not saved");
      lifecycle.leaving = false;
      setLeaving(false);
      return false;
    }
  };
  function updateDraft(key, value) {
    if (busy.current || lifecycle.leaving) return;
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [key]: value },
      requirements:
        key === "stroke"
          ? current.requirements.filter(
              (item) => item.id !== "stroke-confirmed",
            )
          : current.requirements,
    }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    scheduleSave();
  }
  async function changeDraftContext(nextContext) {
    if (!draftRef.current || stage !== "details" || lifecycle.leaving) return;
    if (
      projectContextKey(draftRef.current.context) !== projectContextKey(nextContext)
    )
      return;
    await run("context", async () => {
      const source = draftRef.current;
      const requirements = source.requirements.filter(
        (item) =>
          !(
            item.id === "stroke-confirmed" &&
            item.part &&
            !sameProjectValue(item.part, nextContext.part)
          ),
      );
      const confirmationCleared =
        requirements.length !== source.requirements.length;
      const scopeCleared = source.values.quoteScope === "part" && !sameProjectValue(source.context.part, nextContext.part);
      setDraft({ ...source, context: copy(nextContext), requirements, values: scopeCleared ? { ...source.values, quoteScope: "discuss" } : source.values });
      setNotice("");
      setSaveState("Saving draft…");
      try {
        await persistDraft();
      } catch (error) {
        setSaveState("Draft not saved");
        throw error;
      }
      setNotice(
        scopeCleared
          ? "Product reference updated. Quote scope is now Help define scope; choose Selected component if you want to quote this component."
          : confirmationCleared
          ? "Product reference updated. Your entered values are unchanged; confirm the stroke requirement again for the new reference."
          : "Product reference updated. Your entered requirements and contact details are unchanged.",
      );
    });
  }
  function removeDraftReference(key) {
    if (!["part", "document", "chapter"].includes(key) || !draftRef.current)
      return;
    if (key === "part" && draftRef.current.context.drawing) return;
    const next = copy(draftRef.current.context);
    delete next[key];
    void changeDraftContext(next);
  }
  function scheduleSave() {
    setSaveState("Unsaved changes");
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      setSaveState("Saving draft…");
      persistDraft().catch((e) => {
        if (alive.current) {
          setSaveState("Draft not saved");
          report(e);
        }
      });
    }, 500);
  }
  async function run(key, fn) {
    if (busy.current) return;
    const startedOn = route;
    let release;
    activeOperation.current = new Promise((resolve) => {
      release = resolve;
    });
    busy.current = true;
    setPending(key);
    setError(null);
    setErrors({});
    try {
      return await fn();
    } catch (e) {
      if (lifecycle.route === startedOn) report(e, true);
    } finally {
      busy.current = false;
      activeOperation.current = null;
      release();
      if (alive.current) setPending("");
    }
  }
  async function load() {
    const id = ++loadId.current;
    uiReady.current = false;
    setLoading(true);
    setLeaving(false);
    lifecycle.leaving = false;
    setError(null);
    setNotice("");
    setModeState(null);
    setReplyValues({ body: "", replyTo: "" });
    setUpdateAvailable(false);
    setProject(null);
    setQuoteIdState(null);
    setProjects([]);
    setDrafts([]);
    setStageState("details");
    setReview(null);
    try {
      if (autoTimer.current) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
        await persistDraft();
      }
      await saveQueue.current.catch(() => {});
      if (route.view === "inquiry") {
        const next = await repository.getDraft(route.context);
        if (id !== loadId.current) return;
        setDraft(next);
        if (route.stage === 'review') {
          try { setReview(reviewInquiry(next)); setStageState('review'); }
          catch { setNotice('Check your saved requirements before reviewing again.'); updateBuyerLocation({stage:undefined},{replace:true}); }
        }
        if (next.revision > 0 && !sameProjectValue(next.context, route.context))
          setNotice(
            "Your saved draft keeps its original product reference. The recently viewed component, document or 3D view has not replaced it.",
          );
        setSaveState(
          next.updatedAt
            ? (isPreview ? "Draft saved in this preview" : "Draft saved in this browser")
            : "Your draft saves as you type",
        );
      } else {
        draftRef.current = null;
        setDraftState(null);
        if (route.view === "project") {
          const next = await repository.getProject(route.projectId);
          if (id !== loadId.current) return;
          if (!next)
            throw new Error(
              "This project is not available in this browser. Return to My projects to choose a saved project.",
            );
          setProject(next);
          const selectedQuote = next.quotes.find(item => item.id === route.quoteId) || next.quotes.at(-1);
          setQuoteIdState(selectedQuote?.id || null);
          setTabState(inquiryOnly ? "inquiry" : route.tab || (pendingClarification(next) || pendingProjectChange(next) ? "activity" : next.quotes.length ? "quotation" : "inquiry"));
          setAllComparisonFieldsState(route.compare === 'all');
          const snapshot = history.state?.annoraBuyerDraft;
          const resumable = snapshot?.projectId === next.id && snapshot?.mode === route.mode && (route.mode === 'message' || snapshot?.quoteId === selectedQuote?.id);
          const requestedMode = route.mode;
          const availableMode = requestedMode === 'message' ? !!pendingClarification(next) : ['revision','next'].includes(requestedMode) && selectedQuote?.id === next.quotes.at(-1)?.id && !pendingProjectChange(next) && !pendingClarification(next) && (requestedMode !== 'next' || !next.nextSteps.some(item => item.quoteId === selectedQuote?.id));
          if (requestedMode && availableMode) {
            const changes = resumable ? snapshot.changeValues : {quantity:String(selectedQuote?.quantity || ''),targetWeeks:String(selectedQuote?.requestedWeeks || ''),notes:''};
            const nextStep = resumable ? snapshot.nextValues : {intent:'discussion',message:''};
            const reply = resumable ? snapshot.replyValues : {body:'',replyTo:pendingClarification(next)?.id || ''};
            setModeState(requestedMode); setModeStageState('details');
            setChangeValues(changes);setNextValues(nextStep);setReplyValues(reply);
            if (route.stage === 'review') {
              if (resumable && snapshot.projectRevision === next.revision) {
                try {
                  setModeReview(requestedMode === 'message' ? reviewCustomerReply(next,reply) : requestedMode === 'revision' ? reviewRevision(next,selectedQuote.id,changes) : reviewNextStep(next,selectedQuote.id,nextStep));
                  setModeStageState('review');
                } catch { setNotice('Check your saved message before reviewing it again.'); updateBuyerLocation({stage:undefined},{replace:true}); }
              } else {
                setNotice(resumable ? 'The project changed. Your message is kept; check the latest details before reviewing again.' : 'Add your message, then review it before confirming.');
                updateBuyerLocation({stage:undefined},{replace:true});
              }
            }
          } else if (requestedMode) {
            setNotice('This action is no longer available for this version. Review the current project state.');
            updateBuyerLocation({mode:undefined,stage:undefined},{replace:true});
          }
        } else {
          const [items, working] = await Promise.all([
            repository.listProjects(),
            repository.listDrafts(),
          ]);
          if (id !== loadId.current) return;
          setProjects(items);
          setDrafts(working);
        }
      }
    } catch (e) {
      if (id === loadId.current) report(e);
    } finally {
      if (id === loadId.current) {
        setLoading(false);
        uiReady.current = true;
        revealHeading();
      }
    }
  }
  useEffect(() => {
    void load();
  }, [route]);
  useEffect(() => {
    if (!uiReady.current || loading || !mode || !project) return;
    const snapshot = {projectId:project.id,projectRevision:project.revision,quoteId,mode,changeValues,nextValues,replyValues};
    history.replaceState({...history.state,annoraBuyerDraft:copy(snapshot)},'',location.href);
  }, [loading,mode,project,quoteId,changeValues,nextValues,replyValues]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(autoTimer.current);
      ++loadId.current;
    };
  }, []);
  useEffect(() => {
    const warn = (event) => {
      if (
        lifecycle.requestDirty ||
        saveState === "Unsaved changes" ||
        saveState === "Saving draft…" ||
        saveState === "Draft not saved"
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState, mode, changeValues, nextValues, replyValues]);
  useEffect(() => {
    let disposed = false;
    async function refresh() {
      if (document.hidden || busy.current || lifecycle.leaving || loading || isPreview) return;
      try {
        if (route.view === "project" && project) {
          const next = await repository.getProject(project.id);
          if (disposed || next.revision === project.revision) return;
          // Keep a form's source revision intact. The final write will also reject
          // a stale review, so background updates never replace a customer's input.
          if (mode) { setUpdateAvailable(true); return; }
          const viewingLatest = quoteId === project.quotes.at(-1)?.id;
          setProject(next);
          if (viewingLatest || !quoteId) setQuoteId(next.quotes.at(-1)?.id || null);
          setNotice("Project updated with the latest shared activity.");
          setUpdateAvailable(false);
        } else if (route.view === "projects") {
          const [items, working] = await Promise.all([repository.listProjects(), repository.listDrafts()]);
          if (!disposed) { setProjects(items); setDrafts(working); }
        }
      } catch (error) { if (!disposed) report(error); }
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [route, repository, project, mode, quoteId, loading]);
  const goto = (next) => navigate(next);
  const quote =
    project?.quotes.find((item) => item.id === quoteId) ||
    project?.quotes.at(-1);
  const projectContext = project ? recordContext(project, quote) : undefined;
  lifecycle.getContext = () => {
    if (!["inquiry", "project"].includes(route.view)) return null;
    if (loading || !uiReady.current) throw new Error("Wait for the saved inquiry reference to finish loading, then try again.");
    const context = route.view === "inquiry" ? draftRef.current?.context : projectContext;
    if (!context) throw new Error("The saved inquiry reference could not be read. Try loading the project again.");
    return copy(context);
  };
  lifecycle.cancelLeave = () => { lifecycle.leaving = false; setLeaving(false); };
  const previousQuote = quote?.previousQuoteId
    ? project?.quotes.find((item) => item.id === quote.previousQuoteId)
    : null;
  const linkedChanges =
    project && quote
      ? project.changes.filter((item) => item.quoteId === quote.id)
      : [];
  const latestQuote = project?.quotes.at(-1);
  const isLatest = quote?.id === latestQuote?.id;
  const waitingChange = linkedChanges.find(
    (item) => !changeIsResolved(project, item.id),
  );
  const question = project ? pendingClarification(project) : null;
  const currentNextStep = project?.nextSteps.filter(item => item.quoteId === quote?.id).at(-1);
  const nextStepConfirmation = currentNextStep && project?.messages?.find(item => item.kind === "next-step-confirmation" && item.nextStepId === currentNextStep.id);
  const status = project ? savedStatus(project) : null;
  const defaultContext = route.context;
  const canAdoptCurrentReference =
    draft &&
    route.context &&
    projectContextKey(draft.context) === projectContextKey(route.context) &&
    ["part", "document", "chapter", "drawing", "inspection"].some(
      (key) =>
        !sameProjectValue(draft.context[key], route.context[key]),
    );
  function openMode(nextMode) {
    setMode(nextMode);
    setModeStage("details");
    setModeReview(null);
    setErrors({});
    setError(null);
    setChangeValues(
      perQuoteDrafts.current[quote.id] || {
        quantity: String(quote.quantity),
        targetWeeks: String(quote.requestedWeeks || ""),
        notes: "",
      },
    );
    setNextValues({ intent: "discussion", message: "" });
    revealHeading();
  }
  function updateChange(key, value) {
    const next = { ...changeValues, [key]: value };
    setChangeValues(next);
    perQuoteDrafts.current[quote.id] = next;
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  async function acceptProject(next, text) {
    if (lifecycle.route !== route || lifecycle.leaving) return;
    setProject(next);
    setNotice(text || "");
    setMode(null);
    setModeReview(null);
    setReplyValues({ body: "", replyTo: "" });
    setUpdateAvailable(false);
    setQuoteId(next.quotes.at(-1)?.id || null);
    setTab(next.quotes.length ? "quotation" : "inquiry");
    revealHeading();
  }
  async function refreshReviewedProject() {
    return run("refresh-project", async () => {
      const next = await repository.getProject(project.id);
      setProject(next);
      setQuoteId(next.quotes.at(-1)?.id || null);
      setModeReview(null);
      setModeStage("details");
      setUpdateAvailable(false);
      setNotice("Latest project loaded. Your entered message is unchanged; check it against the updated details before reviewing again.");
      revealHeading();
    });
  }
  const header = (eyebrow, title, description, actions) => (
    <header className="pw-heading">
      <div>
        <p className="pw-eyebrow">{eyebrow}</p>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description && <p className="pw-lede">{description}</p>}
      </div>
      {actions && <div className="pw-heading-actions">{actions}</div>}
    </header>
  );
  const feedback = (
    <>
      {updateAvailable && <div className="pw-feedback"><Notice title="This project has new activity"><p>Your input is kept here. Load the latest details before reviewing this message again.</p><Button variant="secondary" onClick={refreshReviewedProject} disabled={!!pending} pending={pending === "refresh-project"}>Refresh project & keep input</Button></Notice></div>}
      {error && (
        <div className="pw-feedback">
          <Notice kind="error" title="Your action needs attention" role="alert">
            {error}
          </Notice>
        </div>
      )}
      {notice && (
        <div className="pw-feedback">
          <Notice kind="success" title={notice} role="status" />
        </div>
      )}
    </>
  );
  const demo = (
    <p className="pw-demo">
      <span aria-hidden="true">◌</span> {isPreview ? "Draft preview · Customer records disappear when this preview closes." : "Demonstration · Saved in this browser."}
      No request, quotation or message is sent.
    </p>
  );
  const sellerLink = project && !isPreview && !inquiryOnly ? (
    <a className="ar-button pw-role-link" data-variant="quiet" href={contextualURL(sellerURL ? sellerURL(project, { tab: tab === 'activity' ? 'conversation' : tab, quoteId: quote?.id || null }) : `../studio/#project?id=${encodeURIComponent(project.id)}&tab=${tab === 'activity' ? 'conversation' : tab}${quote?.id ? `&quote=${encodeURIComponent(quote.id)}` : ''}`)}>
      View as seller <span aria-hidden="true">↗</span>
    </a>
  ) : null;
  function openReply() {
    if (!question) return;
    setReplyValues({body:"",replyTo:question.id});
    setMode("message");
    setModeStage("details");
    setModeReview(null);
    setError(null);
    setErrors({});
    revealHeading();
  }
  function closeMode() {
    if (busy.current) return;
    setMode(null);
    setError(null);
    setModeReview(null);
    lifecycle.requestDirty = false;
    if (updateAvailable) void load();
    else revealHeading();
  }
  // The presenter control uses these same review and confirmation handlers as
  // the native forms. Preparing a review never performs a final business action.
  function prepareInquiryReview({ fillSample = false } = {}) {
    return run("review", async () => {
      if (fillSample) {
        setDraft(prepareSampleInquiry(draftRef.current));
        setNotice("Fictional sample details fill empty fields. Review the complete request before confirming.");
      }
      const { draft: saved, review: packet } = await prepareInquirySubmission({ repository, draft: draftRef.current, saveDraft: persistDraft });
      setDraft(saved);
      setReview(packet);
      setStage("review");
      revealHeading();
    });
  }
  function confirmInquiry() {
    return run("confirm", async () => {
      const saved = await confirmInquirySubmission({ repository, review });
      if (draftRef.current?.id === review.draft.id) {
        setSaveState("");
        draftRef.current = null;
      }
      if (lifecycle.route === route && !lifecycle.leaving) goto({view:"project",projectId:saved.id});
    });
  }
  function prepareRequestReview(requestMode = mode, values) {
    return run(requestMode === "message" ? "review-reply" : "review-change", async () => {
      const source = values || (requestMode === "message" ? replyValues : requestMode === "revision" ? changeValues : nextValues);
      const packet = requestMode === "message" ? reviewCustomerReply(project,source)
        : requestMode === "revision" ? reviewRevision(project,quote.id,source)
        : reviewNextStep(project,quote.id,source);
      if (requestMode !== mode) setMode(requestMode);
      if (requestMode === "message") setReplyValues(source);
      else if (requestMode === "revision") { setChangeValues(source); perQuoteDrafts.current[quote.id] = source; }
      else setNextValues(source);
      setModeReview(packet);
      setModeStage("review");
      revealHeading();
    });
  }
  function confirmRequest() {
    return run(mode === "message" ? "send-reply" : "confirm-change", async () => {
      const next = mode === "message" ? await repository.sendCustomerReply(modeReview)
        : mode === "revision" ? await repository.requestRevision(modeReview)
        : await repository.confirmNextStep(modeReview);
      lifecycle.requestDirty = false;
      await acceptProject(next, mode === "message" ? "Your reply is saved in the shared demo project."
        : mode === "revision" ? "Change request saved against this quotation." : "Next-step request recorded in this demo.");
      if (mode === "message") setTab("activity");
    });
  }
  function prepareGuidedRequest(requestMode) {
    if (requestMode === "message") {
      const values = mode === "message" && replyValues.body.trim() ? replyValues : {
        body:"Please review the mounting interface and application load with us before confirming suitability.",replyTo:question.id,
      };
      return prepareRequestReview(requestMode,values);
    }
    if (requestMode === "revision") {
      const previous = mode === "revision" ? changeValues : perQuoteDrafts.current[quote.id];
      const edited = previous && (previous.notes?.trim() || String(previous.quantity) !== String(quote.quantity) || String(previous.targetWeeks || "") !== String(quote.requestedWeeks || ""));
      return prepareRequestReview(requestMode, edited ? previous : {
        quantity:String(Math.max(30,quote.quantity + 5)),targetWeeks:"5",
        notes:"Please review a larger batch and an earlier delivery window. Confirm the mounting interface and required load before any commitment.",
      });
    }
    return prepareRequestReview(requestMode, mode === "next" && nextValues.message.trim() ? nextValues : {
      intent:"engineering-review",message:"Please arrange a review of the mounting interface and application load.",
    });
  }
  useEffect(() => {
    if (repository.mode !== "walkthrough") return;
    const blocked = Boolean(loading || pending || leaving);
    let action = null;
    if (loading) action = {id:"buyer-loading",label:"Opening project…",disabled:true,run:()=>{}};
    else if (updateAvailable) action = {id:"buyer-refresh",label:"Refresh & keep input",note:"Load the latest project before reviewing your preserved message.",run:refreshReviewedProject};
    else if (route.view === "inquiry" && draft) action = stage === "review" ? {
      id:"inquiry-confirm",label:"Confirm & continue",note:"Confirm the inquiry shown below. It stays in this fictional demo project.",confirmation:true,run:confirmInquiry,
    } : {
      id:"inquiry-review",label:"Use sample & review",note:"Fill empty fields with fictional details, then show the full inquiry for your confirmation.",run:()=>prepareInquiryReview({fillSample:true}),
    };
    else if (route.view === "project" && project) {
      if (mode && modeStage === "review") action = {
        id:`${mode === "message" ? "reply" : mode === "revision" ? "change" : "next"}-confirm`,label:"Confirm & continue",
        note:mode === "message" ? "Confirm the reply shown below." : mode === "revision" ? "Confirm the requested changes shown below." : "Confirm the engineering discussion request shown below.",
        confirmation:true,run:confirmRequest,
      };
      else if (mode) action = {
        id:`${mode === "message" ? "reply" : mode === "revision" ? "change" : "next"}-review`,label:"Review & continue",
        note:"Use your entered message, or prepare the fictional sample, then review it before confirming.",run:()=>prepareGuidedRequest(mode),
      };
      else if (quote && !isLatest) action = {id:"latest-quotation",label:"Open latest quotation",note:"Earlier versions stay unchanged. Continue with the latest quotation.",run:()=>{setQuoteId(latestQuote.id);setTab("quotation");setError(null);revealHeading();}};
      else if (question) action = {id:"reply-review",label:"Review sample reply",note:"Prepare a fictional reply to the seller’s question, then review it.",run:()=>prepareGuidedRequest("message")};
      else if (quote && !waitingChange && !currentNextStep) action = quote.version > 1 ? {
        id:"next-review",label:"Review next step",note:"Compare the revisions, then review a request for an engineering discussion.",run:()=>prepareGuidedRequest("next"),
      } : {
        id:"change-review",label:"Review sample changes",note:"Review a request for 30 assemblies and an earlier delivery window.",run:()=>prepareGuidedRequest("revision"),
      };
      else if (nextStepConfirmation) action = {id:"completed-conversation",label:"View agreed next step",note:"The buyer’s request and seller’s confirmation stay in one project.",run:()=>{setTab("activity");revealHeading();}};
    }
    if (!action) return;
    return registerWalkthroughAction("buyer-workspace",{...action,busy:blocked,disabled:blocked || Boolean(action.disabled)});
  });
  if (loading)
    return (
      <div className="room-ui room-workspace">
        <div className="pw-loading" role="status">
          Opening your workspace…
        </div>
      </div>
    );
  if (route.view === "projects")
    return (
      <div className="room-ui room-workspace">
        {header(
          "YOUR PRODUCT CONVERSATIONS",
          "My projects.",
          inquiryOnly ? "Continue a draft or reopen the exact model and drawing reference saved with an inquiry." : "Pick up a request, review a quotation, or continue the conversation.",
          <Button
            onClick={() => goto(repository.mode === "walkthrough" && projects.length ? {view:"project",projectId:projects[0].id} : { view: "inquiry", context: defaultContext })}
          >
            {repository.mode === "walkthrough" && projects.length ? "Continue project" : "Start an inquiry"} <span aria-hidden="true">→</span>
          </Button>,
        )}
        {feedback}
        {!!drafts.length && (
          <Section
            title="Continue a draft"
            description="Unsubmitted requirements, kept separate from your saved inquiries."
          >
            <div className="pw-project-list">
              {drafts.map((item) => (
                <article className="pw-project-row" key={item.id}>
                  <div>
                    <Status tone="neutral">Draft</Status>
                    <h2>{item.context.productTitle}</h2>
                    <p>
                      {item.values.application || "Requirements not added yet"}
                    </p>
                  </div>
                  <p className="pw-updated">{date(item.updatedAt)}</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      goto({ view: "inquiry", context: item.context })
                    }
                  >
                    Continue inquiry <span aria-hidden="true">→</span>
                  </Button>
                </article>
              ))}
            </div>
          </Section>
        )}
        <Section
          title="Saved projects"
          description={
            projects.length
              ? `${projects.length} project${projects.length === 1 ? "" : "s"} · ${inquiryOnly ? "saved drawing inquiries" : "inquiries and quotation history"}`
              : undefined
          }
        >
          {projects.length ? (
            <div className="pw-project-list">
              {projects.map((item) => {
                const state = savedStatus(item);
                return (
                  <article className="pw-project-row" key={item.id}>
                    <div>
                      <Status tone={state.tone}>{state.label}</Status>
                      <h2>{item.context.productTitle}</h2>
                      <p>
                        {item.inquiry.values.company ||
                          item.inquiry.values.application}
                      </p>
                      <small className="pw-mono">{item.id}</small>
                    </div>
                    <p className="pw-updated">
                      Updated {date(item.updatedAt)}
                      <small>
                        {item.quotes.length
                          ? `Quotation v${item.quotes.at(-1).version}`
                          : inquiryOnly ? `Drawing ${item.context.drawing?.revision || "reference saved"}` : "No quotation yet"}
                      </small>
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        goto({ view: "project", projectId: item.id })
                      }
                    >
                      {state.action} <span aria-hidden="true">→</span>
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Your next conversation starts here."
              description={inquiryOnly ? "Select a detail in 3D or on the drawing, add your question, then review and confirm the inquiry." : "Bring a requirement from the 3D model, review your inquiry, then keep quotations and replies together."}
            >
              <Button
                variant="secondary"
                onClick={() =>
                  goto({ view: "inquiry", context: defaultContext })
                }
              >
                Prepare an inquiry <span aria-hidden="true">→</span>
              </Button>
            </EmptyState>
          )}
        </Section>
        {demo}
      </div>
    );
  if (route.view === "inquiry" && draft) {
    const reviewed = stage === "review";
    return (
      <div
        className={`room-ui room-workspace ${reviewed ? "pw-reviewed-inquiry" : "pw-editing-inquiry"}`}
      >
        <div className="pw-topline">
          <Button
            variant="quiet"
            onClick={() =>
              run("leave", async () => {
                await persistDraft();
                goto({ view: "projects", context: draft.context });
              })
            }
          >
            ← My projects
          </Button>
          <span role="status">{saveState}</span>
        </div>
        {header(
          "YOUR INQUIRY",
          reviewed ? "Check your request." : "Tell us what you need.",
          reviewed
            ? "Review the exact details that will stay with this project."
            : "Start with what you know. Engineering details can stay open.",
        )}
        <ol
          className="pw-progress pw-inquiry-progress"
          aria-label="Inquiry steps"
        >
          <li
            className={reviewed ? "is-complete" : "is-current"}
            aria-current={reviewed ? undefined : "step"}
          >
            <span>{reviewed ? "✓" : "01"}</span>Your requirements
          </li>
          <li
            className={reviewed ? "is-current" : ""}
            aria-current={reviewed ? "step" : undefined}
          >
            <span>02</span>Review & confirm
          </li>
        </ol>
        {feedback}
        <div className="pw-layout">
          <div className="pw-main-column">
            {reviewed ? (
              <InquiryDocument draft={draft} onExplore={onExplore} />
            ) : (
              <form
                id="pw-inquiry-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void prepareInquiryReview();
                }}
              >
                <fieldset
                  className="pw-form-fields"
                  disabled={!!pending || leaving}
                >
                  <Section
                    title="Application"
                    description={draft.context.drawing ? "What should we review about this part or drawing detail?" : "What should this mechanism help you do?"}
                    actions={
                      <Button
                        variant="quiet"
                        disabled={!!pending}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            values: { ...current.values, ...Object.fromEntries(Object.entries(sampleInquiryValues(current.context)).map(([key, value]) => [key, inquiryField(current.context, key)?.enabled ? value : ""])), intent: current.values.intent || "quotation" },
                            requirements: [],
                          }));
                          setNotice(
                            "Fictional sample details added. Review and change them before continuing.",
                          );
                          scheduleSave();
                        }}
                      >
                        Use sample details
                      </Button>
                    }
                  >
                    <Field label="I want to" name="intent" value={draft.values.intent || ""}
                      options={[...(draft.values.intent ? [] : [["", "Not specified"]]), ...INQUIRY_INTENTS.map(item => [item.value, item.label])]}
                      onChange={event => updateDraft("intent", event.target.value)} error={errors.intent} />
                    <Field
                      label="Requested quote scope"
                      name="quoteScope"
                      value={draft.values.quoteScope || ""}
                      options={[["", "Not specified"], ...QUOTE_SCOPES.filter(item => item.value !== "part" || draft.context.part).map(item => [item.value, item.value === "part" ? `Selected component · ${draft.context.part.title}` : item.label])]}
                      onChange={event => updateDraft("quoteScope", event.target.value)}
                      error={errors.quoteScope}
                      hint="A viewed component is a reference. Choose what you want quoted."
                    />
                    <ConfiguredInquiryField
                      context={draft.context}
                      label="Application"
                      name="application"
                      required
                      textarea
                      rows={3}
                      maxLength={2000}
                      value={draft.values.application}
                      onChange={(e) =>
                        updateDraft("application", e.target.value)
                      }
                      error={errors.application}
                      hint="Describe the task, installation or process."
                    />
                    <div className="pw-field-grid">
                      <ConfiguredInquiryField
                      context={draft.context}
                        values={draft.values}
                        label="Quantity"
                        name="quantity"
                        required
                        type="number"
                        min="1"
                        max="100000"
                        step="1"
                        inputMode="numeric"
                        value={draft.values.quantity}
                        onChange={(e) =>
                          updateDraft("quantity", e.target.value)
                        }
                        error={errors.quantity}
                        unit="units"
                      />
                      <ConfiguredInquiryField
                      context={draft.context}
                        label="Requested timing"
                        name="targetWeeks"
                        optional
                        type="number"
                        min="1"
                        max="104"
                        step="1"
                        inputMode="numeric"
                        value={draft.values.targetWeeks}
                        onChange={(e) =>
                          updateDraft("targetWeeks", e.target.value)
                        }
                        error={errors.targetWeeks}
                        unit="weeks"
                        hint="A request, not a confirmed delivery date."
                      />
                    </div>
                  </Section>
                  {hasInquiryFields(draft.context, ["stroke", "load", "notes"]) && <TechnicalDetails context={draft.context} values={draft.values} errors={errors}>
                    <p className="pw-help">Leave anything you do not know open for discussion.</p>
                    <div className="pw-field-grid">
                      <ConfiguredInquiryField
                      context={draft.context}
                        label="Required stroke"
                        name="stroke"
                        optional
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        unit="mm"
                        error={errors.stroke}
                        value={draft.values.stroke}
                        onChange={(e) => updateDraft("stroke", e.target.value)}
                        placeholder="e.g. 70"
                        hint="Your required travel, in millimeters."
                      />
                      <ConfiguredInquiryField
                      context={draft.context}
                        label="Required load"
                        name="load"
                        optional
                        maxLength={200}
                        error={errors.load}
                        value={draft.values.load}
                        onChange={(e) => updateDraft("load", e.target.value)}
                        placeholder="To discuss"
                        hint="Include the unit and operating conditions."
                      />
                    </div>
                    <ConfiguredInquiryField
                      context={draft.context}
                      label="Notes or questions"
                      name="notes"
                      optional
                      textarea
                      rows={3}
                      maxLength={2000}
                      error={errors.notes}
                      value={draft.values.notes}
                      onChange={(e) => updateDraft("notes", e.target.value)}
                    />
                    {inquiryField(draft.context, "stroke")?.enabled && <label className="pw-check">
                      <input
                        type="checkbox"
                        disabled={!!pending || !draft.values.stroke.trim()}
                        checked={draft.requirements.some(
                          (item) => item.id === "stroke-confirmed",
                        )}
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            requirements: event.target.checked
                              ? [
                                  ...current.requirements.filter(
                                    (r) => r.id !== "stroke-confirmed",
                                  ),
                                  {
                                    id: "stroke-confirmed",
                                    label: "Required carriage stroke",
                                    value: current.values.stroke,
                                    unit: "mm",
                                    source: "customer",
                                    confirmed: true,
                                    ...(current.context.part
                                      ? { part: current.context.part }
                                      : {}),
                                  },
                                ]
                              : current.requirements.filter(
                                  (r) => r.id !== "stroke-confirmed",
                                ),
                          }));
                          scheduleSave();
                        }}
                      />
                      <span>
                        <strong>
                          Include my stroke requirement for engineering review
                        </strong>
                        <small>
                          Enter your stroke above, then confirm. Editing it
                          clears this confirmation. The model's 70 mm reference
                          does not verify suitability.
                        </small>
                      </span>
                    </label>}
                    {errors.requirements && (
                      <p className="pw-field-error">{errors.requirements}</p>
                    )}
                  </TechnicalDetails>}
                  {hasInquiryFields(draft.context, ["name", "company", "email"]) && <Section
                    title="Contact details"
                    description="Use fictional contact details for this demonstration."
                  >
                    <div className="pw-field-grid">
                      <ConfiguredInquiryField
                      context={draft.context}
                        label="Name"
                        name="name"
                        optional
                        maxLength={120}
                        error={errors.name}
                        autoComplete="name"
                        value={draft.values.name}
                        onChange={(e) => updateDraft("name", e.target.value)}
                      />
                      <ConfiguredInquiryField
                      context={draft.context}
                        label="Company"
                        name="company"
                        optional
                        maxLength={160}
                        error={errors.company}
                        autoComplete="organization"
                        value={draft.values.company}
                        onChange={(e) => updateDraft("company", e.target.value)}
                      />
                    </div>
                    <ConfiguredInquiryField
                      context={draft.context}
                      label="Email"
                      name="email"
                      optional
                      type="email"
                      maxLength={254}
                      autoComplete="email"
                      value={draft.values.email}
                      onChange={(e) => updateDraft("email", e.target.value)}
                      error={errors.email}
                    />
                  </Section>}
                </fieldset>
              </form>
            )}
          </div>
          <aside className="pw-sidebar">
            <InquiryReference context={draft.context} disabled={Boolean(pending) || leaving} showInspection={!reviewed} showDisclosure={!(reviewed && draft.context.inspection)}
              onExplore={reviewed ? undefined : async context => {
                await run("leave", async () => { await persistDraft(); onExplore(context); });
              }}>
            {!(reviewed && draft.context.inspection) && <ContextSummary
              context={draft.context}
              showInspection={false}
              disabled={Boolean(pending) || leaving}
              onRemove={reviewed ? undefined : removeDraftReference}
              onAdopt={
                !reviewed && canAdoptCurrentReference
                  ? () => changeDraftContext(route.context)
                  : undefined
              }
              onExplore={
                reviewed
                  ? undefined
                  : async (context) => {
                      await run("leave", async () => {
                        await persistDraft();
                        onExplore(context);
                      });
                    }
              }
            />}
            <div className="pw-side-note">
              <p className="pw-eyebrow">
                {reviewed ? "BEFORE YOU CONFIRM" : "WHAT HAPPENS NEXT"}
              </p>
              <h2>
                {inquiryOnly
                  ? "Keep the exact reference."
                  : reviewed
                  ? "One request. A lasting record."
                  : "Keep the conversation together."}
              </h2>
              <p>
                {inquiryOnly
                  ? reviewed ? "Confirmation saves this inquiry with its selected part, drawing revision and detail. It stays in this preview only." : "Review your question and drawing reference, then confirm to save the inquiry in this browser."
                  : reviewed
                  ? "Confirmation saves this exact inquiry as a project. Later changes and quotations stay linked to it."
                  : "Review your inquiry, then the seller prepares and issues a quotation in the same project."}
              </p>
              <Evidence kind="review">Engineering review required</Evidence>
            </div>
            </InquiryReference>
          </aside>
        </div>
        <div className="pw-bottom-actions">
          {reviewed ? (
            <ActionGroup align="between">
              <Button
                variant="secondary"
                disabled={!!pending}
                onClick={() => {
                  setStage("details");
                  setReview(null);
                  revealHeading();
                }}
              >
                Edit requirements
              </Button>
              <Button
                pending={pending === "confirm"}
                pendingLabel="Saving inquiry…"
                disabled={!!pending}
                onClick={confirmInquiry}
              >
                Confirm demo inquiry <span aria-hidden="true">→</span>
              </Button>
            </ActionGroup>
          ) : (
            <ActionGroup align="between">
              <Button
                variant="quiet"
                pending={pending === "save"}
                disabled={!!pending}
                onClick={() =>
                  run("save", async () => {
                    await persistDraft();
                    setNotice(
                      isPreview ? "Draft saved for this preview session. Closing it discards these test projects." : "Draft saved. You can continue it from My projects.",
                    );
                  })
                }
              >
                Save draft
              </Button>
              <Button
                type="submit"
                form="pw-inquiry-form"
                pending={pending === "review"}
                pendingLabel="Preparing review…"
                disabled={!!pending}
              >
                Review inquiry <span aria-hidden="true">→</span>
              </Button>
            </ActionGroup>
          )}
        </div>
        {demo}
      </div>
    );
  }
  if (route.view === "project" && project) {
    if (mode === "message") {
      const isReview = modeStage === "review";
      const source = project.messages?.find(item => item.id === replyValues.replyTo);
      return <div className="room-ui room-workspace">
        <div className="pw-topline"><Button variant="quiet" onClick={closeMode} disabled={!!pending}>← Back to project</Button><span>{project.id}</span></div>
        {header("REPLY TO THE SELLER",isReview ? "Review your reply." : "Add the missing detail.",isReview ? "This reply stays with the seller’s question and your project." : "Your quotation stays unchanged when you send a clarification.")}
        <ol className="pw-progress pw-inquiry-progress" aria-label="Reply steps">
          <li className={isReview ? "is-complete" : "is-current"} aria-current={!isReview ? "step" : undefined}><span>{isReview ? "✓" : "01"}</span>Your reply</li>
          <li className={isReview ? "is-current" : ""} aria-current={isReview ? "step" : undefined}><span>02</span>Review & confirm</li>
        </ol>
        {feedback}
        <div className="pw-layout"><div className="pw-main-column">
          <Section title="The seller asked"><p className="pw-preserve pw-message">{source?.body || "The original question is unavailable. Return to the project to refresh."}</p></Section>
          <form id="pw-reply-form" className="pw-reply-form" noValidate onSubmit={event=>{
            event.preventDefault();
            void prepareRequestReview("message");
          }}>
            {isReview ? <Section title="Your reply"><p className="pw-preserve">{modeReview?.body ?? replyValues.body}</p></Section> :
              <Field label="Your reply" required textarea rows={5} maxLength={4000} value={replyValues.body} disabled={!!pending || leaving}
                onChange={event=>{setReplyValues({...replyValues,body:event.target.value});setErrors({});}} error={errors.body} hint="Answer the question or explain what still needs to be discussed." />}
          </form>
        </div><aside className="pw-sidebar"><ContextSummary context={recordContext(project, mode === "message" ? question : quote)} compact /></aside></div>
        <div className="pw-bottom-actions"><ActionGroup>
          {isReview ? <><Button variant="secondary" disabled={!!pending} onClick={()=>setModeStage("details")}>Edit reply</Button>
            <Button disabled={!!pending || updateAvailable} pending={pending==="send-reply"} onClick={confirmRequest}>Confirm demo reply <span aria-hidden="true">→</span></Button></> :
            <><Button variant="quiet" disabled={!!pending} onClick={closeMode}>Cancel</Button><Button type="submit" form="pw-reply-form" disabled={!!pending || updateAvailable} pending={pending==="review-reply"}>Review reply <span aria-hidden="true">→</span></Button></>}
        </ActionGroup></div>
        {demo}
      </div>;
    }
    if (mode && quote) {
      const isRevision = mode === "revision",
        isReview = modeStage === "review";
      return (
        <div className="room-ui room-workspace">
          <div className="pw-topline">
            <Button
              variant="quiet"
              onClick={closeMode}
            >
              ← Back to quotation
            </Button>
            <span>
              {project.id} · v{quote.version}
            </span>
          </div>
          {header(
            isRevision ? "QUOTE CHANGE REQUEST" : "CONTINUE THE CONVERSATION",
            isReview
              ? "Review your message."
              : isRevision
                ? "What would you like to change?"
                : "Choose the next step.",
            isReview
              ? `This request will stay linked to quotation v${quote.version}.`
              : "This message stays in this session until you review and confirm it.",
          )}
          {feedback}
          <ol
            className="pw-progress pw-inquiry-progress"
            aria-label="Request steps"
          >
            <li className={isReview ? "is-complete" : "is-current"}>
              <span>{isReview ? "✓" : "01"}</span>Your request
            </li>
            <li className={isReview ? "is-current" : ""}>
              <span>02</span>Review & confirm
            </li>
          </ol>
          <div className="pw-layout">
            <div className="pw-main-column">
              <form
                id="pw-change-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void prepareRequestReview();
                }}
              >
                <fieldset
                  className="pw-form-fields"
                  disabled={!!pending || leaving}
                >
                  {isReview ? (
                    <Section
                      title={
                        isRevision
                          ? "Your requested changes"
                          : "Your next-step request"
                      }
                    >
                      {isRevision ? (
                        <Comparison
                          rows={[
                            {
                              label: "Quantity",
                              before: `${quote.quantity} units`,
                              after: `${changeValues.quantity} units`,
                            },
                            {
                              label: "Requested timing",
                              before: quote.requestedWeeks
                                ? `${quote.requestedWeeks} weeks`
                                : "To discuss",
                              after: changeValues.targetWeeks
                                ? `${changeValues.targetWeeks} weeks`
                                : "To discuss",
                            },
                          ]}
                          beforeLabel={`Quote v${quote.version}`}
                          afterLabel="Your request"
                          caption="Review requested changes"
                        />
                      ) : (
                        <p className="pw-application">
                          {nextValues.intent === "discussion"
                            ? "Schedule a discussion"
                            : "Request engineering review"}
                        </p>
                      )}
                      <p className="pw-eyebrow">YOUR MESSAGE</p>
                      <p className="pw-preserve pw-message">
                        {isRevision ? changeValues.notes : nextValues.message}
                      </p>
                      <Notice title="A request for review">
                        This does not accept a quotation, place an order or
                        confirm technical suitability.
                      </Notice>
                    </Section>
                  ) : isRevision ? (
                    <Section
                      title="Requested changes"
                      description="The current quotation stays unchanged."
                    >
                      <div className="pw-field-grid">
                        <Field
                          label="Quantity"
                          type="number"
                          min="1"
                          step="1"
                          unit="units"
                          required
                          value={changeValues.quantity}
                          onChange={(e) =>
                            updateChange("quantity", e.target.value)
                          }
                          error={errors.quantity}
                        />
                        <Field
                          label="Requested timing"
                          type="number"
                          min="1"
                          step="1"
                          unit="weeks"
                          optional
                          value={changeValues.targetWeeks}
                          onChange={(e) =>
                            updateChange("targetWeeks", e.target.value)
                          }
                          error={errors.targetWeeks}
                        />
                      </div>
                      <Field
                        label="What needs to change?"
                        optional
                        textarea
                        rows={5}
                        value={changeValues.notes}
                        onChange={(e) => updateChange("notes", e.target.value)}
                        error={errors.notes}
                        hint="Add a question, or change quantity or timing above."
                      />
                      <Button
                        variant="quiet"
                        onClick={() => {
                          const values = {
                            quantity: String(Math.max(30, quote.quantity + 5)),
                            targetWeeks: "5",
                            notes:
                              "Please review a larger batch and an earlier delivery window. Confirm the mounting interface and required load before any commitment.",
                          };
                          setChangeValues(values);
                          perQuoteDrafts.current[quote.id] = values;
                        }}
                      >
                        Use sample changes
                      </Button>
                    </Section>
                  ) : (
                    <Section title="Next step">
                      <Field
                        label="What would help you move forward?"
                        options={[
                          {
                            value: "discussion",
                            label: "Schedule a discussion",
                          },
                          {
                            value: "engineering-review",
                            label: "Request engineering review",
                          },
                        ]}
                        value={nextValues.intent}
                        onChange={(e) =>
                          setNextValues({
                            ...nextValues,
                            intent: e.target.value,
                          })
                        }
                      />
                      <Field
                        label="Message"
                        required
                        textarea
                        rows={5}
                        value={nextValues.message}
                        onChange={(e) =>
                          setNextValues({
                            ...nextValues,
                            message: e.target.value,
                          })
                        }
                        error={errors.message}
                        placeholder="What should the team review or discuss?"
                      />
                    </Section>
                  )}
                </fieldset>
              </form>
            </div>
            <aside className="pw-sidebar">
              <ContextSummary context={recordContext(project, mode === "message" ? question : quote)} compact />
              <div className="pw-side-note">
                <p className="pw-eyebrow">SOURCE QUOTATION</p>
                <h2>Version {quote.version}</h2>
                <dl className="pw-side-facts">
                  <div>
                    <dt>Quantity</dt>
                    <dd>{quote.quantity} units</dd>
                  </div>
                  <div>
                    <dt>Priced subtotal</dt>
                    <dd>{money(quote.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>Final total</dt>
                    <dd>Pending review</dd>
                  </div>
                </dl>
                <Evidence kind="sample">Illustrative commercial data</Evidence>
              </div>
            </aside>
          </div>
          <div className="pw-bottom-actions">
            <ActionGroup align="between">
              {isReview ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={!!pending}
                    onClick={() => {
                      setModeStage("details");
                      setModeReview(null);
                      revealHeading();
                    }}
                  >
                    Edit request
                  </Button>
                  <Button
                    disabled={!!pending || updateAvailable}
                    pending={pending === "confirm-change"}
                    pendingLabel="Saving request…"
                    onClick={confirmRequest}
                  >
                    Confirm demo request <span aria-hidden="true">→</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="quiet" onClick={closeMode}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="pw-change-form"
                    disabled={!!pending || updateAvailable}
                    pending={pending === "review-change"}
                  >
                    Review request <span aria-hidden="true">→</span>
                  </Button>
                </>
              )}
            </ActionGroup>
          </div>
          {demo}
        </div>
      );
    }
    return (
      <div className="room-ui room-workspace">
        <div className="pw-topline">
          <Button
            variant="quiet"
            onClick={() => goto({ view: "projects", context: project.context })}
          >
            ← My projects
          </Button>
          <span>{project.id}</span>
        </div>
        {header(
          "YOUR PROJECT",
          project.context.productTitle,
          project.inquiry.values.application,
          <Status tone={status.tone}>{status.label}</Status>,
        )}
        {!inquiryOnly && <ProjectProgress project={project} />}
        <div className="pw-shared-status"><p><strong>{inquiryOnly ? "Inquiry saved" : projectStatus(project).owner === "You" ? "Your next step" : "Seller’s next step"}</strong><span>{inquiryOnly ? "Your confirmed question and exact drawing reference stay together in this preview." : projectStatus(project).next}</span></p>{sellerLink}</div>
        {feedback}
        {!inquiryOnly && <div className="pw-project-navigation">
          <label className="pw-view-choice">
            <span>Project view</span>
            <select value={tab} onChange={event => setTab(event.target.value)} aria-controls="pw-project-content">
              <option value="inquiry">Saved inquiry</option>
              <option value="quotation">Quotation</option>
              <option value="activity">Conversation</option>
            </select>
          </label>
          {tab === "quotation" && quote && <VersionSelector
            versions={project.quotes}
            value={quote.id}
            onChange={id => { setQuoteId(id); setAllComparisonFields(false); setError(null); }}
          />}
        </div>}
        <div role="region" id="pw-project-content"
          aria-label={inquiryOnly || tab === "inquiry" ? "Saved inquiry" : tab === "quotation" ? "Quotation" : "Conversation"}>
          {tab === "inquiry" && (
            <div className="pw-layout">
              <div className="pw-main-column">
                <div className="pw-record-head">
                  <Evidence kind="customer">Saved inquiry</Evidence>
                  <span>
                    {project.inquiry.id} · {date(project.inquiry.createdAt)}
                  </span>
                </div>
                {project.activeDrawingContext && <DrawingReference context={projectDrawingContext(project)} label="Reviewed reference for the next quotation" onOpen={onExplore} />}
                <InquiryDocument
                  draft={{ ...project.inquiry, context: project.context }}
                  onExplore={onExplore}
                />
              </div>
              <aside className="pw-sidebar">
                <div className="pw-side-note">
                  <p className="pw-eyebrow">{question ? "YOUR REPLY NEEDED" : "NEXT STEP"}</p>
                  <h2>{inquiryOnly ? "Return to the detail." : question ? "A question from the seller." : project.quotes.length ? "Your quotation is ready." : "Awaiting a quotation."}</h2>
                  <p>{inquiryOnly ? "Reopen the selected part and drawing region with the same revision. This preview stores the inquiry in this browser; it does not send it to a seller." : question ? question.body : project.quotes.length ? "Review the proposed scope and continue the same project." : "Your confirmed inquiry is available in the seller workspace. A quotation appears here after the seller reviews and issues it."}</p>
                  {inquiryOnly && <Button variant="secondary" onClick={() => onExplore(project.context)}>View selected detail <span aria-hidden="true">↗</span></Button>}
                  {question ? <Button onClick={openReply}>Reply to question <span aria-hidden="true">→</span></Button>
                    : project.quotes.length > 0 && <Button onClick={() => setTab("quotation")}>Review quotation <span aria-hidden="true">→</span></Button>}
                </div>
              </aside>
            </div>
          )}
          {tab === "quotation" &&
            (!quote ? (
              <EmptyState
                title="Awaiting a quotation."
                description="The seller prepares a draft, reviews it, and issues a fixed version. Only issued quotations appear here."
              >
                {question && <Button onClick={openReply}>Reply to question</Button>}
              </EmptyState>
            ) : (
              <>
                <div className="pw-quote-toolbar">
                  <Evidence kind="sample">
                    {quote.source === "sample" ? "Legacy sample quotation · not an offer" : "Seller-issued demo quotation · not an offer"}
                  </Evidence>
                </div>
                    <section className="pw-next-action" aria-label="Quotation next action">
                      <div className="pw-next-copy">
                      <p className="pw-eyebrow">
                        {!isLatest
                          ? "PRESERVED VERSION"
                          : question ? "YOUR REPLY NEEDED" : waitingChange
                            ? "CHANGE REQUEST SAVED"
                            : currentNextStep ? "NEXT STEP" : "YOUR NEXT MOVE"}
                      </p>
                      <h2>
                        {!isLatest
                          ? "An earlier quotation."
                          : waitingChange || question
                            ? question ? "A question needs your reply." : "Your changes are under review."
                            : currentNextStep ? nextStepConfirmation ? "Your next step is confirmed." : "Awaiting seller confirmation." : "Move the conversation forward."}
                      </h2>
                      <p>
                        {!isLatest
                          ? `Version ${quote.version} remains available as a fixed record. Use the latest quotation to request a change or next step.`
                          : waitingChange || question
                            ? question ? question.body : `Your request is linked to v${quote.version}. The seller can reply, clarify details, or issue a revised quotation.`
                            : currentNextStep ? nextStepConfirmation?.body || "The seller can review your request and confirm the next discussion or engineering review." : "Request a revision, or ask for a discussion or engineering review. You will confirm before recording either request."}
                      </p>
                      </div>
                      <div className="pw-next-controls">
                      {!isLatest ? (
                        <Button
                          onClick={() => {
                            setQuoteId(latestQuote.id);
                            setError(null);
                          }}
                        >
                          Open latest quotation{" "}
                          <span aria-hidden="true">→</span>
                        </Button>
                      ) : waitingChange || question ? (
                        <>
                          <Button onClick={() => question ? openReply() : setTab("activity")}>
                            {question ? "Reply to question" : "View conversation"} <span aria-hidden="true">→</span>
                          </Button>
                        </>
                      ) : currentNextStep ? (
                        <><Button variant="secondary" onClick={() => setTab("activity")}>View conversation <span aria-hidden="true">→</span></Button>
                        <Button variant="quiet" onClick={() => openMode("revision")}>Request a change</Button></>
                      ) : (
                        <>
                          <Button onClick={() => openMode("next")}>
                            Choose next step <span aria-hidden="true">→</span>
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => openMode("revision")}
                          >
                            Request a change
                          </Button>
                        </>
                      )}
                      <Evidence kind="review">
                        No order or acceptance is created
                      </Evidence>
                    </div>
                    </section>
                <div className="pw-layout">
                  <div className="pw-main-column">
                    <article className="pw-quote-document">
                      <div className="pw-quote-title">
                        <div>
                          <p className="pw-eyebrow">
                            QUOTATION / VERSION {quote.version}
                          </p>
                          <h2>{project.context.productTitle}</h2>
                        </div>
                        <p>
                          {quote.id}
                          <span>{date(quote.createdAt)}</span>
                        </p>
                      </div>
                      {previousQuote && (
                        <Section
                          title={`What changed from v${previousQuote.version}`}
                          actions={
                            <Button
                              variant="quiet"
                              aria-expanded={compare}
                              onClick={() => setCompare((value) => !value)}
                            >
                              {compare ? "Hide comparison" : "Show comparison"}
                            </Button>
                          }
                        >
                          {compare && (
                            <><Comparison
                              rows={compareQuotes(previousQuote, quote, project).filter(row => allComparisonFields || row.changed)}
                              beforeLabel={`v${previousQuote.version} · previous`}
                              afterLabel={`v${quote.version} · current`}
                              caption="Quotation version comparison"
                            />
                            <Button variant="quiet" aria-expanded={allComparisonFields} onClick={()=>setAllComparisonFields(value=>!value)}>
                              {allComparisonFields ? "Show changed fields only" : "Include unchanged fields"}
                            </Button></>
                          )}
                        </Section>
                      )}
                      <p className="pw-application">{quote.scope}</p>
                      <div className="pw-price-list">
                        <div className="pw-price-row pw-price-labels">
                          <span>Proposed scope</span>
                          <span>Amount · USD</span>
                        </div>
                        {quote.lineItems.map((line, index) => (
                          <div
                            className="pw-price-row"
                            key={`${line.label}-${index}`}
                          >
                            <div>
                              <strong>{line.label}</strong>
                              {(line.quantity != null || index === 0) && (
                                <small>
                                  {line.quantity ?? quote.quantity} units ·{" "}
                                  {money(line.unitPrice !== undefined ? line.unitPrice : quote.unitPrice)} each
                                </small>
                              )}
                            </div>
                            <span>{money(line.amount)}</span>
                          </div>
                        ))}
                        <div className="pw-price-row pw-subtotal">
                          <span>Priced subtotal</span>
                          <strong>{money(quote.subtotal)}</strong>
                        </div>
                        <div className="pw-price-row">
                          <span>Final total</span>
                          <span>Pending review</span>
                        </div>
                      </div>
                      <p className="pw-help">
                        Freight, taxes and unpriced engineering work remain
                        open. Unknown costs are not included as zero.
                      </p>
                      <Section title="Timing & scope">
                        <dl className="pw-facts">
                          <div>
                            <dt>Your requested timing</dt>
                            <dd>
                              {quote.requestedWeeks
                                ? `${quote.requestedWeeks} weeks`
                                : "To discuss"}
                              <small>Not confirmed</small>
                            </dd>
                          </div>
                          <div>
                            <dt>{quote.source === "sample" ? "Illustrative lead time" : "Proposed lead time"}</dt>
                            <dd>{quote.proposedLeadTime}</dd>
                          </div>
                        </dl>
                        <ul className="pw-bullets">
                          {quote.assumptions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </Section>
                      {!!quote.exclusions?.length && <Section title="Not included"><ul className="pw-bullets">{quote.exclusions.map((item,index)=><li key={index}>{item}</li>)}</ul></Section>}
                      {quote.validity && <Section title="Quotation validity"><p className="pw-preserve">{quote.validity}</p></Section>}
                      <Section
                        title="Open items"
                        description="Clear ownership for what still needs to be resolved."
                      >
                        <ul className="pw-open-items">
                          {quote.openItems.map((item) => (
                            <li key={item.id}>
                              <div>
                                <strong>{item.label}</strong>
                                <small>{item.status}</small>
                              </div>
                              <span>{item.owner}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    </article>
                  </div>
                  <aside className="pw-sidebar">
                    <InquiryReference context={projectContext} onExplore={onExplore}>
                      <ContextSummary context={projectContext} onExplore={onExplore} compact showInspection={false} />
                    </InquiryReference>
                    {currentNextStep && (
                      <div className="pw-next-receipt">
                        <p className="pw-eyebrow">YOUR REQUEST</p>
                        <p>{currentNextStep.message}</p>
                      </div>
                    )}
                  </aside>
                </div>
              </>
            ))}
          {tab === "activity" && (
            <ProjectConversation
              project={project}
              onQuote={(id) => { setQuoteId(id); setTab("quotation"); }}
              onReply={openReply}
              onExplore={onExplore}
            />
          )}
        </div>
        {demo}
      </div>
    );
  }
  return (
    <div className="room-ui room-workspace">
      {header(
        "PRODUCT ROOM",
        "This project needs another look.",
        isPreview ? "Projects created here stay in this preview session only." : "Your saved projects are kept in this browser.",
      )}
      {feedback}
      <ActionGroup align="start">
        <Button
          variant="secondary"
          onClick={() => goto({ view: "projects", context: route.context })}
        >
          My projects
        </Button>
        <Button onClick={() => load()}>Try again</Button>
      </ActionGroup>
      {demo}
    </div>
  );
}
/** A host-owned route and repository boundary. No renderer or camera ownership. */
export function mountProjectWorkspace(
  element,
  { repository, onExplore = () => {}, onNavigate, sellerURL } = {},
) {
  if (!repository)
    throw new TypeError("Product Room needs a project repository.");
  const root = createRoot(element),
    lifecycle = {};
  let disposed = false;
  const api = {
    open(route) {
      if (disposed) return;
      lifecycle.leaving = false;
      root.render(
        <Workspace
          route={{ ...route }}
          repository={repository}
          onExplore={onExplore}
          sellerURL={sellerURL}
          lifecycle={lifecycle}
          navigate={(next) => (onNavigate ? onNavigate(next) : api.open(next))}
        />,
      );
    },
    beforeLeave(nextRoute) {
      return lifecycle.beforeLeave
        ? lifecycle.beforeLeave(nextRoute)
        : Promise.resolve(true);
    },
    getContext() {
      if (!lifecycle.getContext) throw new Error("Wait for the saved inquiry reference to finish loading, then try again.");
      return lifecycle.getContext();
    },
    cancelLeave() { lifecycle.cancelLeave?.(); },
    dispose() {
      disposed = true;
      root.unmount();
    },
  };
  return api;
}
