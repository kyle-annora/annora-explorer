import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ActionGroup,
  Button,
  Comparison,
  Evidence,
  Glyph,
  Notice,
  Section,
  Status,
} from "../product-room/ui/components.jsx";
import { createStudioRepository } from "./repository.js";
import { validateStudioDraft } from "./domain.js";
import { STUDIO_PRODUCT_ID } from "./seed.js";
import {
  copy,
  date,
  sections,
  readRoute,
  routeHash,
  roomURL,
} from "./navigation.js";
import { Check, LinkButton, IssueList, UnsavedDialog } from "./ui.jsx";
import {
  ProductFields,
  PartsFields,
  PresentationFields,
  InquiryFields,
} from "./editor.jsx";
import { Preview } from "./preview.jsx";
import crankImage from "../product-room/assets/crank.png";
import "./styles.css";
import { CustomerWorkspace } from "./customer-workspace.jsx";
import { createDemoProjectRepository } from "../product-room/project-repository.js";
import {
  readWalkthroughSession,
  hasWalkthroughRequest,
  createWalkthroughRepository,
  walkthroughStorageKey,
} from "../walkthrough/session.js";

function Studio({ repository, projectRepository }) {
  const customerGuard = useRef(null);
  const [route, setRoute] = useState(readRoute),
    [products, setProducts] = useState([]),
    [draft, setDraft] = useState(null),
    [saved, setSaved] = useState(null),
    [releases, setReleases] = useState([]);
  const [busy, setBusy] = useState("loading"),
    [error, setError] = useState(""),
    [errorIssues, setErrorIssues] = useState([]),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(null),
    [review, setReview] = useState(null),
    [receipt, setReceipt] = useState(null),
    [confirmed, setConfirmed] = useState(false),
    [leave, setLeave] = useState(null);
  const busyRef = useRef("loading"),
    draftRef = useRef(null),
    savedRef = useRef(null),
    routeRef = useRef(route),
    navigationRef = useRef(0),
    main = useRef(null),
    errorRef = useRef(null);
  draftRef.current = draft;
  savedRef.current = saved;
  routeRef.current = route;
  const dirty = Boolean(
    draft && saved && JSON.stringify(draft) !== JSON.stringify(saved),
  );
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const issues = useMemo(
    () => (draft ? validateStudioDraft(draft) : []),
    [draft],
  );
  const issueSection = (section) =>
    ({
      identity: "product",
      facts: "product",
      documents: "parts",
      parts: "parts",
      questions: "presentation",
      inquiry: "inquiry",
      presentation: "presentation",
      product: "product",
    })[section] || "product";

  function go(next, replace = false) {
    if (next.externalURL) {
      location.assign(next.externalURL);
      return;
    }
    ++navigationRef.current;
    history[replace ? "replaceState" : "pushState"]({}, "", routeHash(next));
    setRoute(next);
    window.dispatchEvent(new CustomEvent("annora:routechange"));
    setError("");
    setErrorIssues([]);
    setMessage("");
    setConfirmed(false);
    requestAnimationFrame(() => {
      main.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function navigate(next) {
    if (customerGuard.current?.(next)) return;
    if (busyRef.current) return;
    if (
      dirtyRef.current &&
      routeRef.current.page === "edit" &&
      next.page !== "edit"
    ) {
      setLeave(next);
      return;
    }
    go(next);
  }
  async function task(name, fn) {
    if (busyRef.current) return;
    busyRef.current = name;
    setBusy(name);
    setError("");
    setErrorIssues([]);
    setMessage("");
    try {
      return await fn();
    } catch (problem) {
      setError(
        problem.message ||
          "The action could not be completed. Your edits are still here.",
      );
      setErrorIssues(problem.issues || []);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      busyRef.current = "";
      setBusy("");
    }
  }
  async function refreshProducts() {
    const [list, history] = await Promise.all([
      repository.listProducts(),
      repository.listReleases(STUDIO_PRODUCT_ID),
    ]);
    setProducts(list);
    setReleases(history);
  }
  async function saveCurrent() {
    let result = draftRef.current;
    if (dirtyRef.current || !result.revision)
      result = await repository.saveDraft(result);
    draftRef.current = result;
    savedRef.current = copy(result);
    setDraft(result);
    setSaved(copy(result));
    dirtyRef.current = false;
    await refreshProducts();
    return result;
  }
  function change(edit) {
    if (busyRef.current) return;
    setDraft((current) => {
      const next = copy(current);
      edit(next);
      return next;
    });
    setMessage("");
    setReview(null);
  }
  function save() {
    return task("save", async () => {
      await saveCurrent();
      setMessage("Draft saved in this browser. The current Room is unchanged.");
    });
  }
  function openPreview() {
    return task("preview", async () => {
      const value = await saveCurrent();
      const result = await repository.createPreview(value);
      setPreview(result);
      setReceipt(null);
      go({ page: "preview", id: result.id });
    });
  }
  function openReview() {
    return task("review", async () => {
      const value = await repository.getDraft(STUDIO_PRODUCT_ID);
      if (
        !preview ||
        value.id !== preview.draftId ||
        value.revision !== preview.draftRevision
      )
        throw new Error(
          "The draft changed after this preview. Return to the editor and preview the latest version before release.",
        );
      const result = await repository.reviewRelease(value);
      setReview(result);
      setReceipt(null);
      go({ page: "release" });
    });
  }
  function publish() {
    if (!confirmed) return;
    return task("publish", async () => {
      const result = await repository.publishDemo(review);
      setReceipt(result);
      setReview(null);
      await refreshProducts();
      go({ page: "release", id: result.id });
    });
  }
  function download(id) {
    return task("export", async () => {
      const data = await repository.exportRelease(id);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `annora-${STUDIO_PRODUCT_ID}-release-${receipt?.version || "package"}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage(
        "Release package exported. Hosted publication uses your deployment pipeline.",
      );
    });
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      repository.getDraft(STUDIO_PRODUCT_ID),
      repository.listProducts(),
      repository.listReleases(STUDIO_PRODUCT_ID),
    ])
      .then(async ([value, list, history]) => {
        if (!active) return;
        setDraft(value);
        setSaved(copy(value));
        setProducts(list);
        setReleases(history);
        const initial = readRoute();
        if (initial.page === "preview" && initial.id)
          setPreview(await repository.getPreview(initial.id));
        else if (initial.page === "release" && initial.id)
          setReceipt(await repository.getRelease(initial.id));
        else if (initial.page === "preview" || initial.page === "release")
          go({ page: "edit", section: "product" }, true);
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
    const unload = (event) => {
      if (
        dirtyRef.current ||
        (busyRef.current && busyRef.current !== "loading")
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const back = () => {
      const next = readRoute();
      if (customerGuard.current?.(next)) {
        history.replaceState({}, "", routeHash(routeRef.current));
        return;
      }
      if (
        busyRef.current ||
        (dirtyRef.current &&
          routeRef.current.page === "edit" &&
          next.page !== "edit")
      ) {
        history.replaceState({}, "", routeHash(routeRef.current));
        if (!busyRef.current) setLeave(next);
        return;
      }
      const turn = ++navigationRef.current;
      setError("");
      setErrorIssues([]);
      setMessage("");
      setRoute(next);
      window.dispatchEvent(new CustomEvent("annora:routechange"));
      setConfirmed(false);
      if (next.page === "preview") setPreview(null);
      if (next.page === "release") {
        setReceipt(null);
        if (next.id) setReview(null);
      }
      const promise =
        next.page === "preview" && next.id
          ? repository.getPreview(next.id)
          : next.page === "release" && next.id
            ? repository.getRelease(next.id)
            : null;
      if (promise)
        promise
          .then((value) => {
            if (!active || turn !== navigationRef.current) return;
            if (next.page === "preview") setPreview(value);
            else setReceipt(value);
          })
          .catch((problem) => {
            if (active && turn === navigationRef.current)
              setError(problem.message);
          });
    };
    const presentationNavigate = (event) => {
      if (!event.detail?.url) return;
      event.detail.handled = true;
      navigate({ externalURL: event.detail.url });
    };
    window.addEventListener(
      "annora:walkthrough-navigate",
      presentationNavigate,
    );
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", back);
    return () => {
      active = false;
      window.removeEventListener(
        "annora:walkthrough-navigate",
        presentationNavigate,
      );
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("popstate", back);
    };
  }, [repository]);

  const current = products.find((product) => product.id === STUDIO_PRODUCT_ID);
  const editSection = route.section || "product";
  const openEdit = (section) =>
    navigate({ page: "edit", section: issueSection(section) });
  const screen = route.page;
  const customerScreen = ["projects", "project"].includes(screen);
  return (
    <div className="room-ui studio-app">
      <a className="studio-skip" href="#studio-main">
        Skip to content
      </a>
      <header className="studio-header">
        <a
          href="#products"
          className="studio-brand"
          onClick={(event) => {
            event.preventDefault();
            navigate({ page: "products" });
          }}
        >
          <span className="studio-brand-mark">///</span>
          <span>
            ANNORA <small>STUDIO</small>
          </span>
        </a>
        <nav className="studio-workspace-nav" aria-label="Studio workspaces">
          <a
            href="#products"
            aria-current={!customerScreen ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate({ page: "products" });
            }}
          >
            Products
          </a>
          <a
            href="#projects"
            aria-current={customerScreen ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate({ page: "projects" });
            }}
          >
            Customer projects
          </a>
        </nav>
        <div className="studio-header-end">
          <span className="studio-demo-label">
            <span />
            Local demo
          </span>
          <a className="studio-text-link" href={roomURL({ page: "explore" })}>
            Product Room <Glyph name="external" />
          </a>
        </div>
      </header>
      <main
        ref={main}
        tabIndex="-1"
        id="studio-main"
        className={`studio-main studio-screen-${screen}`}
      >
        {error && !customerScreen && (
          <div className="studio-feedback" ref={errorRef} tabIndex="-1">
            <Notice kind="error" title="We could not complete that action.">
              {error}
            </Notice>
            {errorIssues.length > 0 && (
              <IssueList issues={errorIssues} onEdit={openEdit} draft={draft} />
            )}
          </div>
        )}
        {message && !customerScreen && (
          <div className="studio-feedback" role="status">
            <Notice kind="success">{message}</Notice>
          </div>
        )}
        {busy === "loading" && !customerScreen && (
          <div className="studio-loading" role="status">
            <span className="ar-spinner" />
            <p>Opening your product workspace…</p>
          </div>
        )}
        {!draft && busy !== "loading" && !customerScreen && (
          <div className="studio-loading">
            <p>
              Your product workspace could not be opened. Existing customer
              projects have not been changed.
            </p>
            <Button onClick={() => location.reload()}>Try again</Button>
          </div>
        )}
        {customerScreen && (
          <CustomerWorkspace
            repository={projectRepository}
            productRepository={repository}
            route={route}
            onNavigate={navigate}
            onGo={go}
            guardRef={customerGuard}
          />
        )}
        {draft && screen === "products" && (
          <div className="studio-products">
            <div className="studio-page-heading">
              <div>
                <p className="ar-eyebrow">YOUR PRODUCT WORKSPACE</p>
                <h1>Products</h1>
                <p>Prepare what customers see, understand, and ask for.</p>
              </div>
              <Evidence kind="sample">Prepared demonstration product</Evidence>
            </div>
            <div className="studio-product-table">
              <div className="studio-table-labels">
                <span>Product</span>
                <span>Room version</span>
                <span>Last edited</span>
                <span className="ar-sr-only">Action</span>
              </div>
              {products.map((product) => (
                <div className="studio-product-row" key={product.id}>
                  <div className="studio-list-product">
                    <img src={crankImage} alt="" width="104" height="76" />
                    <div>
                      <h2>{product.title}</h2>
                      <span>Crank-slider · Prepared 3D model</span>
                      <Status tone={product.hasChanges ? "active" : "neutral"}>
                        {product.hasChanges
                          ? "Unreleased changes"
                          : "Ready to edit"}
                      </Status>
                    </div>
                  </div>
                  <div className="studio-product-version">
                    <span className="studio-mobile-label">Room version</span>
                    <strong>Version {product.releaseVersion}</strong>
                    <small>
                      {product.releaseSource === "bundled"
                        ? "Bundled reference"
                        : "Demo release · this browser"}
                    </small>
                  </div>
                  <div className="studio-product-updated">
                    <span className="studio-mobile-label">Last edited</span>
                    {date(product.updatedAt)}
                  </div>
                  <Button onClick={() => openEdit("product")} icon="arrow">
                    Edit product
                  </Button>
                </div>
              ))}
            </div>
            <div className="studio-list-footer">
              <div>
                <strong>One product. A consistent customer experience.</strong>
                <p>
                  Edits stay in a draft until you review and release them.
                  Existing inquiries and quotations keep their original product
                  references.
                </p>
              </div>
              <a
                className="studio-text-link"
                href={roomURL()}
                target="_blank"
                rel="noopener"
              >
                View current Room <Glyph name="external" />
              </a>
            </div>
            {releases.length > 1 && (
              <Section
                className="studio-release-history"
                title="Release history"
                description="Versioned product content saved in this browser."
              >
                <div>
                  {releases.map((release) => (
                    <div className="studio-history-row" key={release.id}>
                      <span>
                        <strong>Version {release.version}</strong>
                        <small>
                          {release.source === "bundled"
                            ? "Bundled reference"
                            : "Demo release · this browser"}
                        </small>
                      </span>
                      <span>{date(release.createdAt)}</span>
                      <Button
                        variant="quiet"
                        onClick={() =>
                          task("open", async () => {
                            const value = await repository.getRelease(
                              release.id,
                            );
                            setReceipt(value);
                            setReview(null);
                            go({ page: "release", id: release.id });
                          })
                        }
                      >
                        View release
                      </Button>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
        {draft && screen === "edit" && (
          <>
            <div className="studio-editor-top">
              <div className="studio-editor-heading">
                <button
                  type="button"
                  className="studio-back"
                  aria-label="Back to products"
                  onClick={() => navigate({ page: "products" })}
                >
                  <Glyph name="back" />
                </button>
                <div>
                  <p className="studio-breadcrumb">
                    Products <span>/</span>{" "}
                    {draft.content.shortTitle || "Crank-slider"}
                  </p>
                  <h1>{draft.content.title || "Untitled product"}</h1>
                </div>
              </div>
              <div className="studio-editor-actions">
                <span className="studio-save-state" aria-live="polite">
                  <i data-dirty={dirty || undefined} />
                  {dirty
                    ? "Unsaved changes"
                    : draft.revision
                      ? `Draft ${draft.revision} saved`
                      : "Prepared draft"}
                </span>
                <Button
                  variant="secondary"
                  onClick={save}
                  disabled={Boolean(busy)}
                  pending={busy === "save"}
                >
                  Save draft
                </Button>
                <Button
                  onClick={openPreview}
                  disabled={Boolean(busy)}
                  pending={busy === "preview"}
                  pendingLabel="Preparing…"
                  icon="arrow"
                >
                  Preview
                </Button>
              </div>
            </div>
            <div className="studio-editor-layout">
              <aside className="studio-sidebar">
                <nav aria-label="Product editing sections">
                  {sections.map((section, index) => (
                    <a
                      key={section.id}
                      href={`#edit/${section.id}`}
                      aria-current={
                        editSection === section.id ? "page" : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        navigate({ page: "edit", section: section.id });
                      }}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {section.title}
                      {issues.some(
                        (issue) =>
                          issue.severity === "error" &&
                          issueSection(issue.section) === section.id,
                      ) && <i aria-label="Has issues" />}
                    </a>
                  ))}
                </nav>
                <div className="studio-sidebar-context">
                  <p className="ar-eyebrow">PREPARED MODEL</p>
                  <strong>Crank-slider mechanism</strong>
                  <span>107 components · 1 operating clip</span>
                  <code title={draft.modelRevision}>
                    {draft.modelRevision.slice(0, 20)}…
                  </code>
                  <p>The shared Explorer and model geometry stay unchanged.</p>
                </div>
              </aside>
              <div className="studio-editor-body">
                <fieldset
                  className="studio-editor-fields"
                  disabled={Boolean(busy)}
                >
                  {editSection === "product" && (
                    <ProductFields draft={draft} change={change} />
                  )}
                  {editSection === "parts" && (
                    <PartsFields
                      draft={draft}
                      change={change}
                      busy={Boolean(busy)}
                    />
                  )}
                  {editSection === "presentation" && (
                    <PresentationFields draft={draft} change={change} />
                  )}
                  {editSection === "inquiry" && (
                    <InquiryFields draft={draft} change={change} />
                  )}
                </fieldset>
                <div className="studio-editor-bottom">
                  <span>Your changes apply to a new product version.</span>
                  <Button
                    variant="secondary"
                    onClick={openPreview}
                    disabled={Boolean(busy)}
                    pending={busy === "preview"}
                    pendingLabel="Preparing…"
                    icon="arrow"
                  >
                    Preview buyer experience
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
        {draft &&
          busy !== "loading" &&
          ((screen === "preview" && !preview) ||
            (screen === "release" && route.id && !receipt)) && (
            <div className="studio-release-page">
              <Notice
                title={
                  error
                    ? "This version is unavailable."
                    : "Opening this version…"
                }
              >
                {error
                  ? "Return to the editor for a fresh preview, or open a saved release from Products."
                  : "Loading the saved product content."}
              </Notice>
              <ActionGroup align="start">
                <Button
                  variant="secondary"
                  onClick={() => openEdit("product")}
                  icon="back"
                >
                  Return to editor
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => navigate({ page: "products" })}
                >
                  All products
                </Button>
              </ActionGroup>
            </div>
          )}
        {draft && screen === "preview" && preview && (
          <Preview
            preview={preview}
            onEdit={() => openEdit("product")}
            onReview={openReview}
            busy={Boolean(busy)}
          />
        )}
        {draft && screen === "release" && !receipt && !route.id && (
          <div className="studio-release-page">
            <div className="studio-page-heading">
              <div>
                <p className="ar-eyebrow">RELEASE REVIEW</p>
                <h1>Review before you release.</h1>
                <p>
                  Check the product changes and confirm the version customers
                  will use.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  preview
                    ? go({ page: "preview", id: preview.id })
                    : openEdit("product")
                }
                icon="back"
              >
                Back to preview
              </Button>
            </div>
            {review ? (
              <>
                <div className="studio-release-meta">
                  <Status tone="complete">
                    Saved draft {review.draft.revision}
                  </Status>
                  <span>{review.draft.content.title}</span>
                  <code>{review.draft.modelRevision.slice(0, 20)}…</code>
                </div>
                <Section
                  title="Changes in this version"
                  description="Compared with the current released product content."
                >
                  <Comparison
                    rows={
                      review.changes?.length
                        ? review.changes
                        : [
                            {
                              label: "Product content",
                              before: "Current version",
                              after: "No content changes",
                              changed: false,
                            },
                          ]
                    }
                    beforeLabel="Current Room"
                    afterLabel="New version"
                    caption="Product release changes"
                  />
                </Section>
                <Section className="studio-separated" title="Release checks">
                  <div className="studio-check-results">
                    <div>
                      <Glyph name="check" />
                      <span>
                        Product, document and model references checked
                      </span>
                    </div>
                    <div>
                      <Glyph name="check" />
                      <span>
                        Inquiry still requires customer review and confirmation
                      </span>
                    </div>
                    <div>
                      <Glyph name="check" />
                      <span>
                        Existing customer projects keep their original versions
                      </span>
                    </div>
                  </div>
                  <IssueList
                    issues={review.issues || []}
                    onEdit={openEdit}
                    draft={review.draft}
                  />
                </Section>
                <div className="studio-release-confirm">
                  <Notice title="Demo release · this browser">
                    This updates the demonstration Room in this browser. It does
                    not deploy a website or send anything to a customer. Export
                    the release package for your deployment pipeline.
                  </Notice>
                  <Check
                    checked={confirmed}
                    onChange={setConfirmed}
                    disabled={Boolean(busy)}
                  >
                    I have reviewed the buyer experience and the changes in this
                    release.
                  </Check>
                  <ActionGroup>
                    <Button
                      variant="secondary"
                      onClick={() => openEdit("product")}
                      disabled={Boolean(busy)}
                    >
                      Return to editor
                    </Button>
                    <Button
                      onClick={publish}
                      disabled={!confirmed || Boolean(busy)}
                      pending={busy === "publish"}
                      pendingLabel="Releasing…"
                      icon="arrow"
                    >
                      Publish demo version
                    </Button>
                  </ActionGroup>
                </div>
              </>
            ) : (
              <Notice title="Preview the saved draft first.">
                Open a buyer preview, then return here to review this release.
                <ActionGroup align="start">
                  <Button onClick={openPreview}>Preview draft</Button>
                </ActionGroup>
              </Notice>
            )}
          </div>
        )}
        {draft && screen === "release" && receipt && (
          <div className="studio-release-page">
            <div className="studio-release-receipt">
              <div className="studio-receipt-mark">
                <Glyph name="check" />
              </div>
              <p className="ar-eyebrow">
                {receipt.source === "bundled"
                  ? "BUNDLED REFERENCE"
                  : "DEMO RELEASE SAVED"}
              </p>
              <h1>Version {receipt.version} is ready to explore.</h1>
              <p>{receipt.content.title}</p>
              <Status tone="complete">
                {receipt.source === "bundled"
                  ? "Bundled product version"
                  : "Available in this browser"}
              </Status>
              <dl>
                <div>
                  <dt>Release</dt>
                  <dd>{receipt.id}</dd>
                </div>
                <div>
                  <dt>Saved</dt>
                  <dd>{date(receipt.createdAt)}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{receipt.modelRevision.slice(0, 28)}…</dd>
                </div>
              </dl>
              <Notice title="Your customer history is preserved.">
                Existing drafts, inquiries and quotations keep the product and
                document versions they started with.
              </Notice>
              <ActionGroup align="start">
                <LinkButton
                  href={roomURL({ release: receipt.id })}
                  variant="primary"
                  target="_blank"
                  rel="noopener"
                >
                  Open released Room
                </LinkButton>
                <Button
                  variant="secondary"
                  onClick={() => download(receipt.id)}
                  pending={busy === "export"}
                  disabled={Boolean(busy)}
                  icon="document"
                >
                  Export release package
                </Button>
              </ActionGroup>
              <p className="studio-small studio-muted">
                Hosted publication uses the GitHub deployment workflow. This
                receipt records a local demonstration release.
              </p>
            </div>
            <ActionGroup align="between">
              <Button
                variant="quiet"
                onClick={() => navigate({ page: "products" })}
                icon="back"
              >
                All products
              </Button>
              <Button variant="secondary" onClick={() => openEdit("product")}>
                Continue editing
              </Button>
            </ActionGroup>
          </div>
        )}
      </main>
      <footer className="studio-footer">
        <span>ANNORA STUDIO</span>
        <span>Sample product data · Saved in this browser</span>
        <a href="../product-room/#components" target="_blank" rel="noopener">
          Shared components <Glyph name="external" />
        </a>
      </footer>
      <UnsavedDialog
        open={Boolean(leave)}
        pending={busy === "leave"}
        onKeep={() => setLeave(null)}
        onDiscard={() => {
          setDraft(copy(savedRef.current));
          draftRef.current = copy(savedRef.current);
          dirtyRef.current = false;
          const target = leave;
          setLeave(null);
          go(target);
        }}
        onSave={() =>
          task("leave", async () => {
            try {
              await saveCurrent();
            } catch (problem) {
              setLeave(null);
              throw problem;
            }
            const target = leave;
            setLeave(null);
            go(target);
          })
        }
      />
    </div>
  );
}

export function createStudio(
  element,
  {
    repository = createStudioRepository(),
    projectRepository = createDemoProjectRepository(),
  } = {},
) {
  const root = createRoot(element);
  root.render(
    <Studio repository={repository} projectRepository={projectRepository} />,
  );
  return {
    dispose() {
      root.unmount();
    },
  };
}
const mount = document.getElementById("studio-root");
if (mount) {
  const session = readWalkthroughSession();
  if (hasWalkthroughRequest() && !session) {
    const root = createRoot(mount);
    root.render(
      <div className="room-ui studio-loading">
        <h1>This demonstration link is incomplete.</h1>
        <p>Existing projects have not been opened or changed.</p>
        <a className="ar-button" href="../walkthrough/">
          Open the walkthrough
        </a>
      </div>,
    );
  } else
    createStudio(
      mount,
      session
        ? {
            projectRepository: createWalkthroughRepository(session),
            repository: createStudioRepository({
              key: walkthroughStorageKey(session) + ".studio",
            }),
          }
        : undefined,
    );
}
