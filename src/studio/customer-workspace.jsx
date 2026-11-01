import React, { useEffect, useRef, useState } from "react";
import {
  ActionGroup,
  Button,
  EmptyState,
  Evidence,
  Field,
  Glyph,
  Notice,
  Section,
  Status,
  VersionSelector,
} from "../product-room/ui/components.jsx";
import {
  pendingProjectChange,
  pendingClarification,
  quoteDraftErrors,
  quoteDraftPreview,
  quoteProductTitle,
  reviewAcknowledgement,
  reviewQuote,
  reviewReply,
  sellerProjectStatus,
} from "../product-room/seller-domain.js";
import { contextForRelease } from "../product-room/release-content.js";
import { copy, date, routeHash } from "./navigation.js";
import { BUNDLED_RELEASE } from "./seed.js";
import {
  readWalkthroughSession,
  withWalkthroughSession,
} from "../walkthrough/session.js";
import { registerWalkthroughAction } from "../walkthrough/actions.js";
import {
  buyerURL,
  Conversation,
  InquiryDetails,
  money,
  ProductReference,
  QuoteSummary,
  ResponseFields,
  responseFor,
  ResponseSummary,
  SmallLink,
} from "./customer-views.jsx";
import "./customer-workspace.css";
import { recordContext, projectDrawingContext } from "../product-room/drawing-revision.js";
import { DrawingReference } from "../product-room/drawing-reference.jsx";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nextStep = (p) =>
  p.nextSteps.findLast(
    (step) =>
      step.quoteId === p.quotes.at(-1)?.id &&
      !p.messages?.some(
        (m) => m.nextStepId === step.id && m.kind === "next-step-confirmation",
      ),
  );
const customerName = (p) =>
  p.inquiry.values.company || p.inquiry.values.name || "Unnamed customer";

export function CustomerWorkspace({
  repository,
  productRepository,
  route,
  onNavigate,
  onGo,
  guardRef,
  buyerHref = buyerURL,
  buyerHomeHref = "../product-room/?model=kinetic-01#inquiry",
  sampleContext = null,
  renderDrawingRevision,
}) {
  const [drawingEditing, setDrawingEditing] = useState(false), [drawingEpoch, setDrawingEpoch] = useState(0);
  const drawingBusy = useRef(false);
  const [projects, setProjects] = useState([]),
    [project, setProject] = useState(null),
    [filter, setFilter] = useState("attention"),
    [tab, setTabState] = useState("inquiry"),
    [mode, setModeState] = useState("detail");
  const [draft, setDraft] = useState(null),
    [saved, setSaved] = useState(null),
    [response, setResponse] = useState(null),
    [baseline, setBaseline] = useState(null),
    [review, setReview] = useState(null),
    [quoteId, setQuoteIdState] = useState("");
  const [busy, setBusy] = useState("loading"),
    [error, setError] = useState(""),
    [errors, setErrors] = useState({}),
    [message, setMessage] = useState(""),
    [stale, setStale] = useState(false),
    [leave, setLeave] = useState(null);
  const busyRef = useRef("loading"),
    dirtyRef = useRef(false),
    currentRef = useRef({}),
    dialog = useRef(null),
    errorRef = useRef(null),
    generation = useRef(0),
    viewGeneration = useRef(0),
    hydratedView = useRef("");
  const dirty = drawingEditing || (
    mode === "edit" || mode === "quote-review"
      ? !same(draft, saved) || !same(response, baseline)
      : ["reply", "ack", "reply-review", "ack-review"].includes(mode)
        ? !same(response, baseline)
        : false);
  dirtyRef.current = dirty;
  currentRef.current = {
    route,
    project,
    draft,
    saved,
    response,
    baseline,
    mode,
    review,
    tab,
    quoteId,
  };
  const change = project ? pendingProjectChange(project) : null,
    clarification = project ? pendingClarification(project) : null,
    acknowledgement = project ? nextStep(project) : null;
  const responseMismatch = Boolean(
    change &&
      draft &&
      (draft.changeId !== change.id || response?.changeId !== change.id),
  );
  const obsoleteDrawingDraft = Boolean(project?.context.drawing && draft && !same(recordContext(project, draft).drawing, projectDrawingContext(project).drawing));
  const status = project ? sellerProjectStatus(project) : null;
  const quote =
    project?.quotes.find((q) => q.id === quoteId) || project?.quotes.at(-1);
  const walkthrough = readWalkthroughSession();
  const workKey = (id) =>
    `annora.seller.work.${repository.mode === "drawing-preview" ? "drawing-preview" : walkthrough || "default"}.${id}`;
  function moveView(patch, replace = false) {
    const current = currentRef.current;
    const next = {
      page: "project",
      id: current.project?.id || route.id,
      tab: current.tab,
      mode: current.mode,
      quote: current.quoteId,
      draft: current.route.draft || "",
      ...patch,
    };
    hydratedView.current = routeHash(next);
    onGo(next, replace);
  }
  function setTab(value) {
    setTabState(value);
    moveView({ tab: value, mode: "detail" });
  }
  function setQuoteId(value) {
    setQuoteIdState(value);
    moveView({ quote: value });
  }
  function setMode(value, replace = false) {
    setModeState(value);
    moveView({ mode: value }, replace);
  }
  function closeEditor() {
    resetEditor();
    moveView({ mode: "detail" });
  }
  function rememberMessage() {
    if (
      !project ||
      !["reply", "reply-review", "ack", "ack-review"].includes(mode)
    )
      return;
    try {
      sessionStorage.setItem(
        workKey(project.id),
        JSON.stringify({
          projectRevision: project.revision,
          response,
          baseline,
        }),
      );
    } catch {}
  }
  useEffect(rememberMessage, [
    project?.id,
    project?.revision,
    mode,
    response,
    baseline,
  ]);
  async function restoreView(record, next) {
    const turn = ++viewGeneration.current;
    hydratedView.current = routeHash(next);
    setTabState(next.tab || "inquiry");
    setQuoteIdState(
      record?.quotes.some((q) => q.id === next.quote) ? next.quote : "",
    );
    const wanted = next.mode || "detail";
    if (!record || wanted === "detail") {
      resetEditor();
      return;
    }
    if (["edit", "quote-review"].includes(wanted)) {
      const value = await repository.getQuoteDraft(record.id);
      if (turn !== viewGeneration.current) return;
      if (next.draft && next.draft !== value.id) {
        resetEditor();
        setTabState("quotation");
        onGo({ ...next, mode: "detail", tab: "quotation", draft: "" }, true);
        setMessage(
          "That editing session has ended. The latest issued quotation and any saved draft are available here.",
        );
        return;
      }
      const answer =
        value.replyDraft ||
        (pendingProjectChange(record)
          ? responseFor(pendingProjectChange(record))
          : null);
      setDraft(value);
      setSaved(copy(value));
      setResponse(answer);
      setBaseline(copy(answer));
      setStale(Boolean(value.rebasedFromRevision));
      if (wanted === "quote-review") {
        try {
          setReview(reviewQuote(record, value, answer));
          setModeState(wanted);
        } catch {
          setReview(null);
          setModeState("edit");
          onGo({ ...next, mode: "edit" }, true);
          setMessage("Review the current draft before issuing this quotation.");
        }
      } else {
        setReview(null);
        setModeState(wanted);
      }
      return;
    }
    let cached;
    try {
      cached = JSON.parse(sessionStorage.getItem(workKey(record.id)));
    } catch {}
    const ack = wanted.startsWith("ack"),
      step = nextStep(record);
    if (ack && !step) {
      resetEditor();
      onGo({ ...next, mode: "detail", tab: "conversation" }, true);
      return;
    }
    const value =
      cached?.projectRevision === record.revision &&
      cached?.response &&
      (ack
        ? cached.response.nextStepId === step?.id
        : Boolean(cached.response.kind))
        ? cached.response
        : ack
          ? { nextStepId: step.id, body: "" }
          : responseFor(pendingProjectChange(record));
    setResponse(value);
    setBaseline(
      cached?.projectRevision === record.revision
        ? cached.baseline
        : copy(value),
    );
    setReview(null);
    setStale(false);
    if (wanted.endsWith("review")) {
      try {
        setReview(
          ack
            ? reviewAcknowledgement(record, value)
            : reviewReply(record, value),
        );
        setModeState(wanted);
      } catch {
        const editing = ack ? "ack" : "reply";
        setModeState(editing);
        onGo({ ...next, mode: editing }, true);
      }
    } else setModeState(wanted);
  }
  function resetEditor() {
    setDrawingEditing(false);
    setDrawingEpoch(value => value + 1);
    setModeState("detail");
    setDraft(null);
    setSaved(null);
    setResponse(null);
    setBaseline(null);
    setReview(null);
    setErrors({});
    dirtyRef.current = false;
  }
  async function refresh() {
    const id =
      currentRef.current.route.page === "project"
        ? currentRef.current.route.id
        : "";
    const [list, record] = await Promise.all([
      repository.listSellerProjects(),
      id ? repository.getSellerProject(id) : null,
    ]);
    setProjects(list);
    setProject(record);
    setStale(false);
    return record;
  }
  async function task(name, fn) {
    if (busyRef.current) return;
    busyRef.current = name;
    setBusy(name);
    setError("");
    setErrors({});
    setMessage("");
    try {
      return await fn();
    } catch (problem) {
      setError(
        problem.message ||
          "This action could not be saved. Your input is still here.",
      );
      setErrors(problem.fields || {});
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      busyRef.current = "";
      setBusy("");
    }
  }
  useEffect(() => {
    const turn = ++generation.current;
    let active = true;
    resetEditor();
    setError("");
    setMessage("");
    setProject(null);
    setTabState("inquiry");
    setQuoteIdState("");
    busyRef.current = "loading";
    setBusy("loading");
    Promise.all([
      repository.listSellerProjects(),
      route.page === "project" ? repository.getSellerProject(route.id) : null,
    ])
      .then(async ([list, record]) => {
        if (active && turn === generation.current) {
          setProjects(list);
          setProject(record);
          setStale(false);
          await restoreView(record, route);
        }
      })
      .catch((problem) => {
        if (active) setError(problem.message);
      })
      .finally(() => {
        if (active) {
          busyRef.current = "";
          setBusy("");
        }
      });
    return () => {
      active = false;
    };
  }, [repository, route.page, route.id]);
  useEffect(() => {
    if (
      !project ||
      busyRef.current === "loading" ||
      hydratedView.current === routeHash(route)
    )
      return;
    busyRef.current = "restore-view";
    setBusy("restore-view");
    restoreView(project, route)
      .catch((problem) => setError(problem.message))
      .finally(() => {
        busyRef.current = "";
        setBusy("");
      });
  }, [route.tab, route.mode, route.quote, route.draft, project?.id]);
  useEffect(() => {
    guardRef.current = (next) => {
      if (busyRef.current || drawingBusy.current) return true;
      const current = currentRef.current;
      const editingBack =
        next.page === "project" &&
        next.id === current.route.id &&
        ((current.mode === "quote-review" && next.mode === "edit") ||
          (current.mode === "reply-review" && next.mode === "reply") ||
          (current.mode === "ack-review" && next.mode === "ack"));
      if (dirtyRef.current && !editingBack) {
        setLeave({ route: next });
        return true;
      }
      return false;
    };
    const unload = (event) => {
      if (
        dirtyRef.current ||
        (busyRef.current && busyRef.current !== "loading")
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const update = async (event) => {
      // Focus is not itself evidence of a concurrent edit. Compare the project
      // and saved draft revisions before interrupting an editor or review.
      if (busyRef.current) return;
      const before = currentRef.current;
      if (!before.project) {
        refresh().catch((problem) => setError(problem.message));
        return;
      }
      try {
        const fresh = await repository.getSellerProject(before.project.id);
        if (currentRef.current.project?.id !== fresh.id || busyRef.current)
          return;
        const projectChanged = fresh.revision !== before.project.revision;
        const draftChanged = !same(
          fresh.quoteDraft || null,
          before.project.quoteDraft || null,
        );
        if (!projectChanged && !draftChanged) return;
        if (dirtyRef.current || currentRef.current.mode !== "detail")
          setStale(true);
        else {
          setProject(fresh);
          setProjects(await repository.listSellerProjects());
        }
      } catch (problem) {
        setError(problem.message);
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      guardRef.current = null;
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, [repository, guardRef]);
  useEffect(() => {
    if (leave && !dialog.current.open) dialog.current.showModal();
    else if (!leave && dialog.current.open) dialog.current.close();
  }, [leave]);
  function localGo(action) {
    if (busyRef.current || drawingBusy.current) return;
    if (dirtyRef.current) {
      setLeave({ action });
      return;
    }
    action();
  }
  function finishLeave() {
    const target = leave;
    setLeave(null);
    try {
      if (project) sessionStorage.removeItem(workKey(project.id));
    } catch {}
    resetEditor();
    if (target.route) onGo(target.route);
    else target.action?.();
  }
  async function saveCurrent(current = currentRef.current) {
    const value = await repository.saveQuoteDraft({
      ...current.draft,
      replyDraft: current.response,
    });
    setDraft(value);
    setSaved(copy(value));
    setResponse(copy(value.replyDraft || null));
    setBaseline(copy(value.replyDraft || null));
    currentRef.current.draft = value;
    currentRef.current.saved = copy(value);
    const fresh = await repository.getSellerProject(value.projectId);
    setProject(fresh);
    setProjects(await repository.listSellerProjects());
    currentRef.current.project = fresh;
    dirtyRef.current = false;
    return value;
  }
  function openDraft() {
    task("open-draft", async () => {
      const fresh = await repository.getSellerProject(project.id);
      const value = await repository.getQuoteDraft(project.id);
      const requested = pendingProjectChange(fresh);
      const answer =
        value.replyDraft || (requested ? responseFor(requested) : null);
      setProject(fresh);
      setDraft(value);
      setSaved(copy(value));
      setResponse(answer);
      setBaseline(copy(answer));
      setModeState("edit");
      moveView({ mode: "edit", draft: value.id });
      setReview(null);
      setStale(Boolean(value.rebasedFromRevision));
    });
  }
  function openReply(kind = "reply") {
    const value = responseFor(change, kind);
    if (kind === "clarification") value.kind = "clarification";
    setResponse(value);
    setBaseline(copy(value));
    setMode("reply");
    setReview(null);
    setError("");
  }
  function openAcknowledgement() {
    const value = { nextStepId: acknowledgement.id, body: "" };
    setResponse(value);
    setBaseline(copy(value));
    setMode("ack");
    setReview(null);
  }
  function reviewCurrent() {
    return task("review", async () => {
      const value = await saveCurrent();
      const packet = reviewQuote(project, value, value.replyDraft);
      setReview(packet);
      setMode("quote-review");
      setStale(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function issue() {
    return task("issue", async () => {
      const result = await repository.issueQuote(review);
      setProject(result);
      setProjects(await repository.listSellerProjects());
      setQuoteIdState(result.quotes.at(-1).id);
      resetEditor();
      setTabState("quotation");
      moveView(
        { mode: "detail", tab: "quotation", quote: result.quotes.at(-1).id },
        true,
      );
      setMessage(
        `Quotation version ${result.quotes.at(-1).version} is now visible in the buyer view in this browser.`,
      );
    });
  }
  function reviewMessage() {
    return task("review-message", async () => {
      const packet =
        mode === "ack"
          ? reviewAcknowledgement(project, response)
          : reviewReply(
              project,
              response.kind === "clarification"
                ? { ...response, resolutions: [] }
                : response,
            );
      setReview(packet);
      setMode(mode === "ack" ? "ack-review" : "reply-review");
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function sendMessage() {
    return task("send", async () => {
      if (mode === "ack-review") await repository.acknowledgeNextStep(review);
      else await repository.sendReply(review);
      resetEditor();
      await refresh();
      setTabState("conversation");
      moveView({ mode: "detail", tab: "conversation" }, true);
      try {
        sessionStorage.removeItem(workKey(project.id));
      } catch {}
      setMessage("Your response is visible in the buyer view in this browser.");
    });
  }
  // The presenter uses the same editor, saved draft and sealed review packet as
  // the normal seller flow. Sample preparation never issues a quotation.
  function reviewWalkthroughQuote() {
    return task("prepare-walkthrough-review", async () => {
      const fresh = await repository.getSellerProject(project.id);
      let value = await repository.getQuoteDraft(project.id);
      const requested = pendingProjectChange(fresh);
      let answer = value.replyDraft || (requested ? responseFor(requested) : null);
      // An existing draft may contain the presenter's own edits. Only a new,
      // unsaved draft receives the prescribed fictional terms.
      if (value.revision === 0) {
        const quantity = String(requested?.values.quantity || fresh.inquiry.values.quantity);
        value = {
          ...value,
          values: {
            ...value.values,
            quantity,
            proposedLeadTime: "6–8 weeks after technical review",
            lineItems: [
              { id: "assembly", label: `${quoteProductTitle(fresh)} - illustrative allowance`, quantity, unitPrice: Number(quantity) >= 30 ? "175" : "185" },
              { id: "setup", label: "Example setup allowance", quantity: "1", unitPrice: "250" },
              { id: "freight", label: "Freight and applicable tax", quantity: "1", unitPrice: "" },
            ],
          },
        };
        if (answer) {
          const resolutions = {
            quantity: { status: "accepted", response: `${quantity} identical assemblies included.` },
            timing: { status: "alternative", response: `We propose 6–8 weeks after technical review; ${requested.values.targetWeeks ? `the requested ${requested.values.targetWeeks} weeks is not confirmed` : "the requested timing remains to be agreed"}.` },
            notes: { status: "alternative", response: "The common mounting interface will be reviewed with engineering before any commitment." },
          };
          answer = {
            ...answer,
            body: `Updated to ${quantity} assemblies. Lead time remains 6–8 weeks after technical review.`,
            resolutions: answer.resolutions.map((item) => ({ ...item, ...resolutions[item.topic] })),
          };
        }
      }
      setProject(fresh);
      setDraft(value);
      setSaved(copy(value));
      setResponse(answer);
      setBaseline(copy(answer));
      setModeState("edit");
      setTabState("quotation");
      setReview(null);
      moveView({ mode: "edit", tab: "quotation", draft: value.id });
      const savedDraft = await saveCurrent({ draft: value, response: answer });
      const packet = reviewQuote(fresh, savedDraft, savedDraft.replyDraft);
      setReview(packet);
      setModeState("quote-review");
      moveView({ mode: "quote-review", tab: "quotation", draft: savedDraft.id });
      setStale(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function reviewWalkthroughAcknowledgement() {
    return task("prepare-walkthrough-response", async () => {
      const value = mode === "ack" && response?.nextStepId === acknowledgement?.id
        ? { ...response }
        : { nextStepId: acknowledgement.id, body: "" };
      if (!value.body.trim()) {
        value.body = "We will review the mounting interface and application load together in an engineering discussion.";
      }
      const packet = reviewAcknowledgement(project, value);
      setResponse(value);
      if (mode !== "ack") setBaseline({ nextStepId: value.nextStepId, body: "" });
      setReview(packet);
      setModeState("ack-review");
      setTabState("conversation");
      moveView({ mode: "ack-review", tab: "conversation" });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  useEffect(() => {
    if (!walkthrough || repository.mode !== "walkthrough" || route.page !== "project" || !project) return;
    let action = null;
    if (mode === "quote-review") {
      action = { id: "seller-confirm-quotation", label: "Confirm & continue", note: "Issue the reviewed quotation to the buyer in this demo.", confirmation: true, run: issue };
    } else if (mode === "ack-review" || mode === "reply-review") {
      action = { id: "seller-confirm-response", label: "Confirm & continue", note: mode === "ack-review" ? "Confirm the reviewed next step in this demo." : "Save the reviewed reply in this demo.", confirmation: true, run: sendMessage };
    } else if (mode === "edit") {
      action = { id: "seller-review-current-quotation", label: "Review quotation", note: "Keep your current draft and check it before issuing.", run: reviewCurrent };
    } else if (mode === "ack" || mode === "detail" && acknowledgement) {
      action = { id: "seller-review-acknowledgement", label: "Review next step", note: "Prepare the engineering discussion for review. Nothing is confirmed yet.", run: reviewWalkthroughAcknowledgement };
    } else if (mode === "reply") {
      action = { id: "seller-review-current-reply", label: "Review response", note: "Review your reply before making it visible to the buyer.", run: reviewMessage };
    } else if (mode === "detail" && !clarification && (change || !project.quotes.length || project.quoteDraft)) {
      action = { id: "seller-review-sample-quotation", label: project.quoteDraft ? "Review saved draft" : "Prepare & review", note: project.quoteDraft ? "Open your saved quotation for review. Your terms are preserved." : "Prepare a fictional quotation and review it before issue.", run: reviewWalkthroughQuote };
    }
    if (!action) return;
    return registerWalkthroughAction("seller-workspace", {
      ...action,
      confirmation: Boolean(action.confirmation),
      busy: Boolean(busy),
      disabled: Boolean(busy) || Boolean(leave) || stale || Boolean(mode === "edit" && responseMismatch),
    });
  });
  function sample() {
    task("sample", async () => {
      if (repository.mode === "drawing-preview" && !sampleContext) return;
      if (sampleContext) {
        const result = await repository.createSampleInquiry(sampleContext);
        onGo({ page: "project", id: result.id });
        return;
      }
      const release = walkthrough
        ? BUNDLED_RELEASE
        : await productRepository.getPublished("kinetic-01");
      const result = await repository.createSampleInquiry(
        contextForRelease(release, {
          part: { id: "rod", title: "Connecting rod" },
        }),
      );
      onGo({ page: "project", id: result.id });
    });
  }
  function editValue(key, value) {
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [key]: value },
    }));
    setErrors({});
    setMessage("");
  }
  function editLine(index, key, value) {
    setDraft((current) => ({
      ...current,
      values: {
        ...current.values,
        lineItems: current.values.lineItems.map((line, i) =>
          i === index ? { ...line, [key]: value } : line,
        ),
      },
    }));
    setErrors({});
  }
  const field = (key, label, props = {}) => (
    <Field
      key={key}
      label={label}
      value={draft.values[key]}
      onChange={(event) => editValue(key, event.target.value)}
      error={errors[key]}
      {...props}
    />
  );
  const filtered = projects.filter(
    (p) => filter === "all" || sellerProjectStatus(p).filter === filter,
  );
  let preview = null;
  try {
    if (draft && project) preview = quoteDraftPreview(draft, project);
  } catch {}

  return (
    <div className="customer-workspace">
      {error && (
        <div className="customer-feedback" ref={errorRef} tabIndex="-1">
          <Notice kind="error" title="We could not complete that action.">
            {error}
          </Notice>
          {Object.keys(errors).length > 0 && (
            <ul className="customer-errors">
              {Object.entries(errors).map(([key, value]) => (
                <li key={key}>{value}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message && (
        <div className="customer-feedback" role="status">
          <Notice kind="success">{message}</Notice>
        </div>
      )}
      {stale && (
        <div className="customer-feedback">
          <Notice title="Project activity may have changed.">
            Your current edits are preserved. Refresh the project before
            reviewing another action.
          </Notice>
          <Button
            variant="quiet"
            onClick={() =>
              localGo(() =>
                task("reload", async () => {
                  closeEditor();
                  await refresh();
                }),
              )
            }
          >
            Reload project
          </Button>
        </div>
      )}
      {busy === "loading" ? (
        <div className="studio-loading" role="status">
          <span className="ar-spinner" />
          <p>Opening customer projects…</p>
        </div>
      ) : route.page === "projects" ? (
        <div className="customer-list-page">
          <div className="studio-page-heading">
            <div>
              <p className="ar-eyebrow">SALES WORKSPACE</p>
              <h1>Customer projects</h1>
              <p>
                Receive inquiries. Prepare quotations. Keep the conversation
                moving.
              </p>
            </div>
            {(repository.mode !== "drawing-preview" || sampleContext) && <Button
              variant="secondary"
              pending={busy === "sample"}
              disabled={Boolean(busy) || drawingEditing}
              onClick={sample}
              icon="plus"
            >
              Open sample inquiry
            </Button>}
          </div>
          <div className="customer-list-toolbar">
            <div
              className="customer-filters"
              aria-label="Filter customer projects"
            >
              {[
                ["attention", "Needs your attention"],
                ["waiting", "Waiting for customer"],
                ["all", "All projects"],
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                  <span>
                    {
                      projects.filter(
                        (p) =>
                          id === "all" || sellerProjectStatus(p).filter === id,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <span className="customer-fine">Confirmed inquiries only</span>
          </div>
          <div className="customer-project-list">
            {filtered.length === 0 ? (
              <EmptyState
                title={
                  projects.length
                    ? "No projects in this view."
                    : "Your next customer conversation starts here."
                }
                description={
                  projects.length
                    ? "Choose another filter to see the rest of your projects."
                    : "Confirm an inquiry in Product Room, or open a fictional sample to try the full seller workflow."
                }
              >
                <a
                  className="ar-button"
                  data-variant="secondary"
                  href={
                    walkthrough
                      ? withWalkthroughSession(
                          new URL(
                            buyerHomeHref,
                            location.href,
                          ),
                          walkthrough,
                        ).href
                      : buyerHomeHref
                  }
                >
                  Open buyer inquiry
                  <Glyph name="arrow" />
                </a>
              </EmptyState>
            ) : (
              <>
                <div className="customer-list-labels">
                  <span>Customer / product</span>
                  <span>Current activity</span>
                  <span>Quotation</span>
                  <span>Next action</span>
                </div>
                {filtered.map((p) => {
                  const s = sellerProjectStatus(p),
                    q = p.quotes.at(-1);
                  return (
                    <article className="customer-project-row" key={p.id}>
                      <div>
                        <h2>{customerName(p)}</h2>
                        <p>{p.context.productTitle}</p>
                        <span className="customer-id">{p.id}</span>
                      </div>
                      <div>
                        <Status
                          tone={s.filter === "attention" ? "active" : "neutral"}
                        >
                          {s.label}
                        </Status>
                        <small>{date(p.updatedAt)}</small>
                      </div>
                      <div className="customer-quote-cell">
                        <strong>
                          {q ? `Version ${q.version}` : "Not issued"}
                        </strong>
                        <small>
                          {p.quoteDraft
                            ? "Seller draft saved"
                            : q
                              ? money(q.subtotal) + " priced"
                              : "Awaiting preparation"}
                        </small>
                      </div>
                      <div>
                        <span className="customer-next-owner">
                          {s.owner} to act
                        </span>
                        <Button
                          variant="secondary"
                          icon="arrow"
                          onClick={() =>
                            onNavigate({ page: "project", id: p.id })
                          }
                        >
                          {s.filter === "attention"
                            ? "Open project"
                            : "View project"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </>
            )}
          </div>
          <div className="customer-list-footnote">
            <Evidence kind="sample">
              Demo workspace · saved in this browser
            </Evidence>
            <p>
              Buyer and seller views share the same project. Nothing is emailed
              or delivered outside this demo.
            </p>
          </div>
        </div>
      ) : project ? (
        <>
          <div className="customer-project-heading">
            <div className="customer-heading-left">
              <button
                className="studio-back"
                aria-label="Back to customer projects"
                onClick={() => onNavigate({ page: "projects" })}
              >
                <Glyph name="back" />
              </button>
              <div>
                <p className="studio-breadcrumb">
                  Customer projects <span>/</span> {project.id}
                </p>
                <h1>{customerName(project)}</h1>
                <p>{project.context.productTitle}</p>
              </div>
            </div>
            <SmallLink
              href={buyerHref(project)}
              onClick={(event) => {
                if (dirtyRef.current || busyRef.current) {
                  event.preventDefault();
                  localGo(() => location.assign(buyerHref(project)));
                }
              }}
            >
              View as buyer
            </SmallLink>
          </div>
          {mode === "detail" ? (
            <>
              <div className="customer-next-action">
                <div>
                  <Status
                    tone={status.filter === "attention" ? "active" : "neutral"}
                  >
                    {status.label}
                  </Status>
                  <p>
                    <strong>{status.owner} to act</strong>
                    <span>{status.next}</span>
                  </p>
                </div>
                <ActionGroup>
                  {acknowledgement ? (
                    <Button
                      onClick={openAcknowledgement}
                      disabled={Boolean(busy) || drawingEditing}
                    >
                      Confirm next step
                    </Button>
                  ) : clarification ? (
                    <Button
                      variant="secondary"
                      onClick={() => setTab("conversation")}
                    >
                      View conversation
                    </Button>
                  ) : change ? (
                    <Button
                      onClick={() => openReply()}
                      disabled={Boolean(busy) || drawingEditing}
                    >
                      Respond to changes
                    </Button>
                  ) : status.owner === "Customer" &&
                    project.quotes.length > 0 &&
                    !project.quoteDraft ? (
                    <Button
                      variant="secondary"
                      disabled={Boolean(busy) || drawingEditing}
                      onClick={() =>
                        setTab(
                          status.label === "Next step confirmed"
                            ? "conversation"
                            : "quotation",
                        )
                      }
                    >
                      {status.label === "Next step confirmed"
                        ? "View conversation"
                        : "View quotation"}
                    </Button>
                  ) : (
                    <Button
                      onClick={openDraft}
                      pending={busy === "open-draft"}
                      disabled={Boolean(busy) || drawingEditing}
                      icon="arrow"
                    >
                      {project.quoteDraft
                        ? "Continue quotation"
                        : project.quotes.length
                          ? "Revise quotation"
                          : "Prepare quotation"}
                    </Button>
                  )}
                </ActionGroup>
              </div>
              <div className="customer-project-layout">
                <div className="customer-project-main">
                  <nav
                    className="customer-tabs"
                    aria-label="Customer project sections"
                  >
                    {["inquiry", "quotation", "conversation"].map((id) => (
                      <button
                        key={id}
                        aria-current={tab === id ? "page" : undefined}
                        onClick={() => localGo(() => setTab(id))}
                      >
                        {id[0].toUpperCase() + id.slice(1)}
                        {id === "quotation" && project.quotes.length > 0 && (
                          <span>{project.quotes.length}</span>
                        )}
                      </button>
                    ))}
                  </nav>
                  <div className="customer-tab-body">
                    {tab === "inquiry" && (
                      <>
                        <InquiryDetails project={project} />
                        {renderDrawingRevision?.({ key: `${project.id}:${drawingEpoch}`, project, disabled: Boolean(busy), onEditing: setDrawingEditing, onWorking: value => { drawingBusy.current = value; }, onChanged: async () => { await refresh(); setMessage("Project drawing confirmed. Earlier quotations and discussions retain their original references."); } })}
                        <ActionGroup align="start">
                          <Button
                            variant="secondary"
                            onClick={() => openReply("clarification")}
                            disabled={Boolean(busy) || drawingEditing || Boolean(clarification)}
                          >
                            Ask for clarification
                          </Button>
                        </ActionGroup>
                      </>
                    )}
                    {tab === "quotation" &&
                      (quote ? (
                        <>
                          <div className="customer-quotation-tools">
                            <VersionSelector
                              versions={project.quotes}
                              value={quote.id}
                              onChange={setQuoteId}
                            />
                            <Button
                              variant="secondary"
                              onClick={openDraft}
                              disabled={Boolean(busy) || drawingEditing || Boolean(clarification)}
                            >
                              {project.quoteDraft
                                ? "Continue draft"
                                : "Prepare next version"}
                            </Button>
                          </div>
                          {project.quoteDraft && (
                            <Notice title="Seller draft saved">
                              The buyer still sees the latest issued quotation.
                              Continue the draft when you are ready.
                            </Notice>
                          )}
                          <DrawingReference context={recordContext(project, quote)} label={`Quotation v${quote.version} drawing`} href={buyerHref({ ...project, context: recordContext(project, quote) }, true)} />
                          <QuoteSummary
                            project={project}
                            quote={quote}
                            productTitle={quoteProductTitle(project)}
                            drawing={recordContext(project, quote).drawing}
                            previous={project.quotes.find(
                              (q) => q.version === quote.version - 1,
                            )}
                          />
                        </>
                      ) : (
                        <EmptyState
                          title={
                            project.quoteDraft
                              ? "Your quotation draft is saved."
                              : "No quotation issued yet."
                          }
                          description={
                            project.quoteDraft
                              ? "Continue the saved draft, review it, then issue the customer-facing version."
                              : "Prepare a draft, review the complete quotation, then make it visible to the customer."
                          }
                        >
                          <Button
                            onClick={openDraft}
                            disabled={Boolean(busy) || drawingEditing || Boolean(clarification)}
                          >
                            {project.quoteDraft
                              ? "Continue quotation"
                              : "Prepare quotation"}
                          </Button>
                        </EmptyState>
                      ))}
                    {tab === "conversation" && (
                      <>
                        <ActionGroup align="start">
                          <Button
                            variant="secondary"
                            onClick={() => openReply()}
                            disabled={Boolean(busy) || drawingEditing}
                          >
                            Reply to customer
                          </Button>
                          {change && !clarification && (
                            <Button
                              variant="quiet"
                              onClick={openDraft}
                              disabled={Boolean(busy) || drawingEditing}
                            >
                              Revise quotation
                            </Button>
                          )}
                        </ActionGroup>
                        <Conversation project={project} buyerHref={buyerHref} />
                      </>
                    )}
                  </div>
                </div>
                <aside>
                  <ProductReference project={tab === "quotation" && quote ? { ...project, context: recordContext(project, quote) } : project} buyerHref={buyerHref} />
                </aside>
              </div>
            </>
          ) : mode === "edit" ? (
            <div className="customer-editor-page">
              {obsoleteDrawingDraft && <Notice title="This draft still references an earlier drawing">Review and explicitly replace this draft for the current drawing before saving or issuing it. Issued quotations remain unchanged.<Button variant="secondary" onClick={() => localGo(() => { closeEditor(); setTab("inquiry"); })}>Review project drawing</Button></Notice>}
              <div className="customer-editor-heading">
                <div>
                  <p className="ar-eyebrow">
                    SELLER DRAFT · NOT VISIBLE TO CUSTOMER
                  </p>
                  <h2>
                    {project.quotes.length
                      ? `Prepare version ${project.quotes.length + 1}`
                      : "Prepare your quotation"}
                  </h2>
                </div>
                <span className="studio-save-state">
                  <i data-dirty={dirty || undefined} />
                  {dirty
                    ? "Unsaved edits"
                    : draft.revision
                      ? "Draft saved"
                      : "New draft"}
                </span>
              </div>
              <fieldset
                disabled={Boolean(busy) || drawingEditing}
                className="customer-editor-fields"
              >
                <Section
                  title="Scope"
                  description="Describe the offer and its boundaries."
                >
                  <div className="studio-form-grid">
                    {field("quantity", "Quoted quantity", {
                      inputMode: "numeric",
                    })}
                    {field("validity", "Quotation validity", {
                      optional: true,
                      placeholder: "For example, 30 days from issue",
                    })}
                    {field("scope", "Included scope", {
                      textarea: true,
                      rows: 4,
                      className: "studio-span-all",
                    })}
                    {field("exclusions", "Exclusions", {
                      textarea: true,
                      rows: 3,
                      optional: true,
                      hint: "One item per line.",
                      className: "studio-span-all",
                    })}
                  </div>
                </Section>
                <Section
                  title="Pricing"
                  description="Enter known amounts. Leave a unit price blank when it remains to confirm."
                  className="customer-document-section"
                  actions={
                    <Button
                      variant="quiet"
                      onClick={() => {
                        setDraft((d) => ({
                          ...d,
                          values: {
                            ...d.values,
                            lineItems: [
                              {
                                id: "assembly",
                                label: `${quoteProductTitle(project)} - illustrative allowance`,
                                quantity: d.values.quantity,
                                unitPrice:
                                  Number(d.values.quantity) >= 30
                                    ? "175"
                                    : "185",
                              },
                              {
                                id: "setup",
                                label: "Example setup allowance",
                                quantity: "1",
                                unitPrice: "250",
                              },
                              {
                                id: "freight",
                                label: "Freight and applicable tax",
                                quantity: "1",
                                unitPrice: "",
                              },
                            ],
                          },
                        }));
                        setMessage(
                          "Invented sample prices filled. Review and edit them before issuing.",
                        );
                      }}
                    >
                      Fill demo pricing
                    </Button>
                  }
                >
                  <div className="customer-line-editor">
                    {draft.values.lineItems.map((line, index) => (
                      <div key={line.id} className="customer-line-edit-row">
                        <Field
                          label={`Item ${index + 1}`}
                          value={line.label}
                          error={errors[`lineItems.${index}.label`]}
                          onChange={(e) =>
                            editLine(index, "label", e.target.value)
                          }
                        />
                        <Field
                          label="Quantity"
                          value={line.quantity}
                          inputMode="decimal"
                          error={errors[`lineItems.${index}.quantity`]}
                          onChange={(e) =>
                            editLine(index, "quantity", e.target.value)
                          }
                        />
                        <Field
                          label="Unit price (USD)"
                          value={line.unitPrice}
                          inputMode="decimal"
                          placeholder="To confirm"
                          error={errors[`lineItems.${index}.unitPrice`]}
                          onChange={(e) =>
                            editLine(index, "unitPrice", e.target.value)
                          }
                        />
                        <div className="customer-line-amount">
                          <span>Amount</span>
                          <strong>
                            {money(
                              line.quantity &&
                                line.unitPrice !== "" &&
                                Number.isFinite(
                                  Number(line.quantity) *
                                    Number(line.unitPrice),
                                )
                                ? Number(line.quantity) * Number(line.unitPrice)
                                : null,
                            )}
                          </strong>
                        </div>
                        <Button
                          variant="quiet"
                          aria-label={`Remove item ${index + 1}`}
                          disabled={draft.values.lineItems.length === 1}
                          onClick={() =>
                            editValue(
                              "lineItems",
                              draft.values.lineItems.filter(
                                (_, i) => i !== index,
                              ),
                            )
                          }
                          icon="close"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="customer-pricing-footer">
                    <Button
                      variant="secondary"
                      icon="plus"
                      onClick={() =>
                        editValue("lineItems", [
                          ...draft.values.lineItems,
                          {
                            id: crypto.randomUUID(),
                            label: "",
                            quantity: "1",
                            unitPrice: "",
                          },
                        ])
                      }
                    >
                      Add item
                    </Button>
                    <div>
                      <span>Priced subtotal · USD</span>
                      <strong>
                        {preview ? money(preview.subtotal) : "Check line items"}
                      </strong>
                    </div>
                  </div>
                </Section>
                <Section
                  title="Delivery & assumptions"
                  className="customer-document-section"
                >
                  <div className="customer-request-summary">
                    <strong>Customer requested</strong>
                    <span>
                      {change?.values.targetWeeks ||
                      project.inquiry.values.targetWeeks
                        ? `${change?.values.targetWeeks || project.inquiry.values.targetWeeks} weeks`
                        : "Timing to discuss"}{" "}
                      · Requested timing is not a delivery commitment.
                    </span>
                  </div>
                  <div className="studio-form-grid">
                    {field("proposedLeadTime", "Proposed lead time", {
                      className: "studio-span-all",
                      placeholder:
                        "For example, 6–8 weeks after technical review",
                    })}
                    {field("assumptions", "Assumptions & open questions", {
                      textarea: true,
                      rows: 4,
                      className: "studio-span-all",
                      hint: "One item per line.",
                    })}
                  </div>
                </Section>
                {change && response && (
                  <Section
                    title="Reply with this quotation"
                    description="Explain how each requested change is handled. This reply and the new quotation are issued together."
                    className="customer-document-section"
                  >
                    {responseMismatch ? (
                      <>
                        <Notice title="A newer change request needs a fresh response.">
                          Your saved explanation below belongs to an earlier
                          request. It has not been assigned to the new request.
                          Starting a fresh response keeps all quotation fields
                          and replaces only this draft explanation.
                        </Notice>
                        <div className="customer-document-section">
                          <p className="ar-eyebrow">
                            PREVIOUS DRAFT RESPONSE · READ ONLY
                          </p>
                          <ResponseSummary value={response} />
                        </div>
                        <ActionGroup align="start">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const next = responseFor(change);
                              setDraft((current) => ({
                                ...current,
                                changeId: change.id,
                                replyDraft: next,
                              }));
                              setResponse(next);
                              setErrors({});
                              setMessage(
                                "A fresh response is ready for the latest change request. Quotation fields are unchanged. Save the draft to keep it.",
                              );
                            }}
                          >
                            Start response to latest request
                          </Button>
                        </ActionGroup>
                      </>
                    ) : (
                      <ResponseFields
                        value={response}
                        setValue={setResponse}
                        change={change}
                        errors={errors}
                        allowKind={false}
                      />
                    )}
                  </Section>
                )}
              </fieldset>
              <div className="customer-editor-actions">
                <Button
                  variant="quiet"
                  onClick={() => localGo(closeEditor)}
                  disabled={Boolean(busy) || drawingEditing}
                  icon="back"
                >
                  Back to project
                </Button>
                <ActionGroup>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      task("save", async () => {
                        await saveCurrent();
                        setMessage(
                          "Quotation draft saved. The buyer view is unchanged.",
                        );
                      })
                    }
                    pending={busy === "save"}
                    disabled={Boolean(busy) || drawingEditing}
                  >
                    Save draft
                  </Button>
                  <Button
                    onClick={reviewCurrent}
                    pending={busy === "review"}
                    disabled={Boolean(busy) || responseMismatch || obsoleteDrawingDraft}
                    icon="arrow"
                  >
                    Review quotation
                  </Button>
                </ActionGroup>
              </div>
            </div>
          ) : mode === "quote-review" ? (
            <div className="customer-review-page">
              <div className="customer-review-heading">
                <p className="ar-eyebrow">REVIEW BEFORE ISSUE</p>
                <h2>Check what the customer will receive.</h2>
                <p>
                  Version {project.quotes.length + 1} · {customerName(project)}
                </p>
              </div>
              <DrawingReference context={recordContext(project, draft)} label="Drawing included in this quotation" href={buyerHref({ ...project, context: recordContext(project, draft) }, true)} />
              <QuoteSummary project={project} quote={preview} previous={project.quotes.at(-1)} productTitle={quoteProductTitle(project)} drawing={recordContext(project, draft).drawing} />
              {response && <ResponseSummary value={response} />}
              <div className="customer-confirmation">
                <Notice title="Ready to make this version visible?">
                  Issuing saves this exact quotation in the buyer view in this
                  browser. The previous version stays unchanged.
                </Notice>
                <ActionGroup align="between">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMode("edit");
                      setReview(null);
                    }}
                    disabled={Boolean(busy) || drawingEditing}
                    icon="back"
                  >
                    Back to editing
                  </Button>
                  <Button
                    onClick={issue}
                    pending={busy === "issue"}
                    pendingLabel="Issuing…"
                    disabled={Boolean(busy) || drawingEditing}
                    icon="arrow"
                  >
                    Issue demo quotation
                  </Button>
                </ActionGroup>
              </div>
            </div>
          ) : (
            <div className="customer-message-page">
              <div className="customer-review-heading">
                <p className="ar-eyebrow">
                  {mode.endsWith("review")
                    ? "REVIEW YOUR RESPONSE"
                    : "CUSTOMER CONVERSATION"}
                </p>
                <h2>
                  {mode.startsWith("ack")
                    ? "Confirm the next step."
                    : mode === "reply-review"
                      ? "Check your response."
                      : "Reply to the customer."}
                </h2>
                <p>
                  {customerName(project)} · {project.id}
                </p>
              </div>
              {mode === "reply" || mode === "ack" ? (
                <>
                  <fieldset
                    disabled={Boolean(busy) || drawingEditing}
                    className="customer-editor-fields"
                  >
                    {mode === "reply" ? (
                      <ResponseFields
                        value={response}
                        setValue={setResponse}
                        change={change}
                        errors={errors}
                      />
                    ) : (
                      <>
                        <div className="customer-request-summary">
                          <strong>
                            {acknowledgement?.intent === "engineering-review"
                              ? "Engineering review requested"
                              : "Discussion requested"}
                          </strong>
                          <p>{acknowledgement?.message}</p>
                        </div>
                        <Field
                          label="Confirmed next step"
                          textarea
                          rows="5"
                          value={response.body}
                          onChange={(e) =>
                            setResponse({ ...response, body: e.target.value })
                          }
                          hint="Describe the agreed next action. This does not confirm an order."
                          error={errors.body}
                        />
                      </>
                    )}
                  </fieldset>
                  <ActionGroup align="between">
                    <Button
                      variant="quiet"
                      onClick={() => localGo(closeEditor)}
                      disabled={Boolean(busy) || drawingEditing}
                      icon="back"
                    >
                      Back to project
                    </Button>
                    <Button
                      onClick={reviewMessage}
                      pending={busy === "review-message"}
                      disabled={Boolean(busy) || drawingEditing}
                      icon="arrow"
                    >
                      Review response
                    </Button>
                  </ActionGroup>
                </>
              ) : (
                <>
                  <ResponseSummary value={response} />
                  <Notice>
                    Confirming makes this message visible in the buyer view.{" "}
                    {mode === "reply-review"
                      ? "This action does not create a new quotation."
                      : "This records the next step, not an order."}
                  </Notice>
                  <ActionGroup align="between">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setMode(mode === "ack-review" ? "ack" : "reply")
                      }
                      disabled={Boolean(busy) || drawingEditing}
                      icon="back"
                    >
                      Back to editing
                    </Button>
                    <Button
                      onClick={sendMessage}
                      pending={busy === "send"}
                      pendingLabel="Saving…"
                      disabled={Boolean(busy) || drawingEditing}
                    >
                      Confirm demo response
                    </Button>
                  </ActionGroup>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="customer-list-page">
          <EmptyState
            title="This project could not be opened."
            description="Choose an available project from this browser."
          >
            <Button
              variant="secondary"
              onClick={() => onNavigate({ page: "projects" })}
            >
              Customer projects
            </Button>
          </EmptyState>
        </div>
      )}
      <dialog
        className="studio-dialog"
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setLeave(null);
        }}
        aria-labelledby="customer-leave-title"
      >
        <p className="ar-eyebrow">UNSAVED EDITS</p>
        <h2 id="customer-leave-title">Keep working on this draft?</h2>
        <p>
          Your unsaved edits will be discarded if you leave. Previously saved
          quotations and messages stay unchanged.
        </p>
        <ActionGroup>
          <Button
            variant="quiet"
            onClick={() => setLeave(null)}
            disabled={Boolean(busy)}
          >
            Keep editing
          </Button>
          <Button
            variant="secondary"
            onClick={finishLeave}
            disabled={Boolean(busy)}
          >
            Discard edits
          </Button>
          {mode === "edit" && (
            <Button
              onClick={() =>
                task("leave", async () => {
                  await saveCurrent();
                  finishLeave();
                })
              }
              pending={busy === "leave"}
              disabled={Boolean(busy)}
            >
              Save & continue
            </Button>
          )}
        </ActionGroup>
      </dialog>
    </div>
  );
}
