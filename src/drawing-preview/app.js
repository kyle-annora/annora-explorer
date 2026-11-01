import "./styles.css";
import {
  DRAWING_CATALOG,
  DRAWING_RELEASES,
  resolveDrawingRelease,
  drawingEntry,
  resolveDrawingEntry,
} from "../drawings/catalog.js";
import { requestedDrawingIssues } from "../drawings/pinned-reference.js";
import { sourceAssetFor } from "../drawings/package.js";
import { createDrawingReader } from "../drawings/reader.js";
import { createDrawingRepository } from "../studio/drawing-repository.js";
import { createRoomViewer } from "../product-room/viewer.js";
import { createDrawingProjectRepository } from "../product-room/drawing-inquiry.js";
import { readBuyerRoute, buyerRouteHash } from "../product-room/navigation.js";
import { createDrawingContext } from "./context.js";
import { focusDrawingRegion } from "./model-views.js";
import { overviewEntriesFor, supportsTechnicalDetail } from "./technical-catalog.js";
import { createTechnicalDrawingView } from "./technical-view.js";
import { createDrawingOverview } from "../drawings/drawing-overview.js";
import { resolveReferencePreview } from '../drawings/reference-preview.js';
import { normalizeOverviewPresentation, overviewPresentationIssues } from '../drawings/overview-presentation.js';
import "../drawings/drawing-overview.css";

const $ = (id) => document.getElementById(id),
  mobile = matchMedia("(max-width:850px)");
const repository = createDrawingProjectRepository(),
  editablePackages = DRAWING_CATALOG.filter(
    (entry) =>
      entry.model?.revision &&
      entry.package.modelRevision === entry.model.revision,
  );
const packageRepository = editablePackages.length
  ? createDrawingRepository({ packages: editablePackages })
  : null;
let entry,
  drawing,
  sheet,
  regions,
  regionId,
  view = mobile.matches ? "3d" : "compare",
  page = "explore",
  drawingView;
let presentation = "overview", technicalId = null, overviewSnapshot = null;
const overviewViews = () => overviewEntriesFor(drawing, { sheetId: sheet?.id, unavailable: unavailableVersion, presentationSnapshot: overviewSnapshot });
const preparedViews = () => overviewViews();
const selectedTechnicalView = () => {
  const entries = preparedViews();
  return entries.find(item => item.id === technicalId) || entries.find(item => supportsTechnicalDetail(item, sheet.id, regionId)) || entries[0];
};
let workspace,
  workspaceLoading,
  modelLoading,
  modelInitializing = false,
  selectionSync = 0,
  lastSelected,
  activeContext,
  navigation = 0,
  noticeTimer,
  readerGeneration = 0;
let currentRoute = { view: "explore" },
  returnRoute,
  unavailableVersion = false;
let committedURL = location.href;
const canInquire = () =>
  !unavailableVersion &&
  entry?.available &&
  regions?.get(regionId)?.mappingStatus === "confirmed";
const notice = (message) => {
  clearTimeout(noticeTimer);
  $("dp-notice").textContent = message;
  $("dp-notice").hidden = false;
  noticeTimer = setTimeout(() => ($("dp-notice").hidden = true), 9000);
};
function updateURL({ replace = false } = {}) {
  const url = new URL(location.href);
  if (!unavailableVersion) {
    url.searchParams.set("product", entry.id);
    url.searchParams.set("view", view);
    url.searchParams.set("sheet", sheet.id);
    url.searchParams.set("detail", regionId);
    url.searchParams.set("drawing", drawing.revision);
    url.searchParams.set("mapping", drawing.mappingRevision);
    url.searchParams.set("asset", drawing.assets.find(asset => asset.id === sheet.assetId)?.sha256 || "");
    url.searchParams.set("overview", overviewSnapshot?.revision || 'source');
  }
  url.searchParams.set("view", view);
  if (preparedViews().length) {
    url.searchParams.set("presentation", presentation);
    if (technicalId) url.searchParams.set("technicalView", technicalId);
  } else { url.searchParams.delete("presentation"); url.searchParams.delete("technicalView"); }
  url.hash = buyerRouteHash(currentRoute);
  history[replace ? "replaceState" : "pushState"](
    { ...history.state },
    "",
    url,
  );
  committedURL = url.href;
}
const currentContext = () =>
  createDrawingContext({
    drawing,
    sheetId: sheet.id,
    regionId,
    modelRevision: entry.model.revision,
    model: entry.model,
    presentationSnapshot: overviewSnapshot,
  });
function selectOptions(element, items, value) {
  element.replaceChildren(
    ...items.map(([id, title]) =>
      Object.assign(document.createElement("option"), {
        value: id,
        textContent: title,
      }),
    ),
  );
  element.value = value;
}
function renderSelection() {
  $("dp-version-warning").hidden = !unavailableVersion;
  const region = regions.get(regionId);
  $("dp-detail").value = regionId;
  $("dp-detail-name").textContent = region?.label || "No confirmed detail";
  $("dp-dimension").textContent = region?.dimension || "";
  $("dp-detail-note").textContent =
    region?.note || "Select a source detail to locate its linked model part.";
  $("dp-inquire").disabled =
    unavailableVersion ||
    !entry.available ||
    region?.mappingStatus !== "confirmed";
  $("dp-show-3d").disabled = !entry.available || !entry.model.parts.some(part => part.id === region?.partId);
  $("dp-show-drawing").disabled = !region;
  document.body.dataset.detail = regionId;
}
function renderPackage() {
  selectOptions(
    $("dp-product-select"),
    DRAWING_CATALOG.map((item) => [item.id, item.title]),
    entry.id,
  );
  selectOptions(
    $("dp-sheet-select"),
    drawing.sheets.map((item, i) => [
      item.id,
      `${i + 1} / ${drawing.sheets.length} · ${item.title}`,
    ]),
    sheet.id,
  );
  selectOptions($("dp-overview-sheet"), drawing.sheets.map((item, i) => [item.id, `Sheet ${i + 1} / ${drawing.sheets.length}`]), sheet.id);
  selectOptions(
    $("dp-detail"),
    sheet.regions.map((region) => [region.id, region.label]),
    regionId,
  );
  $("dp-source-label").textContent = drawing.revisionLabel || drawing.revision;
  $("dp-source-version").textContent =
    drawing.revisionLabel || drawing.revision;
  $("dp-source-model").textContent =
    `${entry.model.parts.length} source part${entry.model.parts.length === 1 ? "" : "s"} · ${entry.title}`;
  $("dp-source-units").textContent = drawing.units;
  $("dp-source-note").textContent = drawing.statusNote;
  $("dp-map-version").textContent = drawing.mappingRevision;
  const original = sourceAssetFor(drawing, sheet.assetId),
    step = drawing.assets.find((asset) => asset.kind === "step");
  $("dp-error-original").href = original?.url || "#";
  $("dp-pdf").href = original?.url || "#";
  $("dp-original").href = original?.url || "#";
  $("dp-step").href = step?.url || "#";
  $("dp-step").download = step?.file || "";
  $("dp-provenance").href = drawing.sourceURL;
  $("dp-studio").href =
    `../studio/#drawings?product=${encodeURIComponent(entry.id)}`;
  renderSelection();
  renderPresentation();
}
function renderPresentation() {
  const entries = preparedViews(), prepared = selectedTechnicalView(), overview = overviewViews();
  document.body.dataset.technicalAvailable = String(Boolean(entries.length));
  if (presentation === "overview" && !overview.length || presentation === "technical" && !prepared) presentation = "source";
  if (prepared) technicalId = prepared.id;
  const technical = Boolean(prepared && presentation === "technical");
  $("dp-presentation").hidden = false;
  $("dp-back-overview").hidden = presentation === "overview" || !overview.length;
  $("dp-overview-title").hidden = presentation !== "overview" && overview.length > 0;
  $("dp-overview-title").textContent = presentation === "source" ? "Source PDF" : "Drawing overview";
  $("dp-overview-sheet").hidden = presentation !== "overview" || drawing.sheets.length < 2;
  $("dp-source-pdf").hidden = presentation === "source";
  $("dp-drawing-pane").dataset.presentation = presentation;
  $("dp-drawing-pane").dataset.technical = String(presentation !== "source");
  $("dp-technical-context").hidden = !technical;
  $("dp-technical-legend").hidden = presentation === "source";
  $("dp-technical-view-label").hidden = !technical;
  selectOptions($("dp-technical-view-select"), entries.map(item => [item.id, item.title]), technicalId);
  $("dp-technical-unit").textContent = `${drawing.number || entry.title} / ${technical && prepared?.profile.notToScale ? "NTS" : drawing.units}`;
  $("dp-technical-kicker").textContent = `${drawing.number || entry.title} / TECHNICAL VIEW`;
  $("dp-technical-title").textContent = prepared?.title || entry.title;
  $("dp-fit").textContent = "Fit sheet";
  const note = regions.get(regionId)?.note;
  $("dp-detail-note").textContent = presentation !== "source"
    ? `${regions.get(regionId)?.dimension || regions.get(regionId)?.label || "Selected detail"}. Linked to the original source and saved drawing version.`
    : note || "Select a source detail to locate its linked model part.";
  for (const button of document.querySelectorAll("button[data-presentation]"))
    button.setAttribute("aria-pressed", String(button.dataset.presentation === presentation));
}

function mountReader({ focus = false } = {}) {
  const generation = ++readerGeneration;
  drawingView?.dispose();
  $("dp-sheet-error").hidden = true;
  renderPresentation();
  const prepared = selectedTechnicalView();
  const technical = prepared && presentation === "technical";
  const options = {
    mount: $("dp-sheet"),
    package: drawing,
    sheetId: sheet.id,
    onSelect: (id) => void selectRegion(id, { origin: "drawing" }),
    onViewChange: (state) => {
      if (generation !== readerGeneration) return;
      $("dp-zoom").textContent = `${Math.round(state.zoom * 100)}%`;
      $("dp-zoom-in").disabled = !state.canZoomIn;
      $("dp-zoom-out").disabled = !state.canZoomOut;
      for (const button of document.querySelectorAll("[data-technical-zoom]"))
        button.setAttribute("aria-pressed", String(Math.abs(Number(button.dataset.technicalZoom) - state.zoom) < .01));
    },
    onError: () => {
      if (generation === readerGeneration) $("dp-sheet-error").hidden = false;
    },
  };
  drawingView = presentation === "overview" ? createDrawingOverview({
    mount: $("dp-sheet"), entries: overviewViews(), selectedId: regionId,
    onOpen: selection => void openPreparedView(selection).catch(error => notice(error.message)),
    onError: options.onError,
  }) : technical ? createTechnicalDrawingView({
    ...options,
    profile: prepared.profile,
    artwork: prepared.artwork,
  }) : createDrawingReader(options);
  const instance = drawingView;
  instance.ready
    .then(() => {
      if (generation !== readerGeneration) return;
      if (presentation !== 'overview' || focus) instance.select(regionId, { focus });
      if (view === "3d" || page !== "explore") instance.pause?.();
    })
    .catch(() => {});
}
async function openPreparedView({ entryId, regionId: id, focus = false }) {
  const target = preparedViews().find(item => item.id === entryId);
  if (!target) return;
  const nextId = target.regionIds.includes(id) ? id : target.defaultRegionId;
  technicalId = target.id;
  presentation = "technical";
  const selection = selectRegion(nextId, { origin: "drawing" });
  mountReader();
  const instance = drawingView;
  await instance.ready;
  if (instance !== drawingView) return;
  if (focus) instance.setZoom?.(2);
  updateURL({ replace: true });
  requestAnimationFrame(() => { if (instance === drawingView) $("dp-technical-view-select").focus({ preventScroll: true }); });
  await selection;
}
const viewer = createRoomViewer({
  mount: $("dp-viewer"),
  explorerURL: new URL("../", location.href).href,
  onState(state) {
    if (!entry || state.lifecycle !== "ready") return;
    if (state.model?.id !== entry.model.id) {
      if (!modelInitializing)
        void ensureViewer(true).catch((error) => notice(error.message));
      return;
    }
    $("dp-loading").hidden = true;
    $("dp-model-error").hidden = true;
    const selected = state.navigation?.selectedId;
    if (modelInitializing || selectionSync || page !== "explore") {
      lastSelected = selected;
      return;
    }
    if (selected !== lastSelected) {
      lastSelected = selected;
      const match = sheet.regions.find((region) => region.partId === selected);
      if (match) void selectRegion(match.id, { origin: "model", focus: true });
    }
  },
  onError(error) {
    $("dp-loading").hidden = true;
    $("dp-model-error").hidden = false;
    notice(error.message);
  },
});
function ensureViewer(force = false) {
  if (!entry.available)
    return Promise.reject(
      new Error(
        "The exact paired model is unavailable. Its original source drawing remains available.",
      ),
    );
  if (
    !force &&
    viewer.state?.lifecycle === "ready" &&
    viewer.state.model?.id === entry.model.id
  )
    return Promise.resolve();
  if (modelLoading) return modelLoading;
  $("dp-loading").hidden = false;
  $("dp-model-error").hidden = true;
  modelInitializing = true;
  modelLoading = viewer
    .mountModel(entry.model.id)
    .then(async () => {
      const region = regions.get(regionId);
      if (region) await viewer.request("select", { nodeId: region.partId });
      lastSelected = viewer.state?.navigation?.selectedId;
    })
    .finally(() => {
      modelLoading = null;
      modelInitializing = false;
    });
  return modelLoading;
}
async function selectRegion(id, { origin = "controls", focus = false } = {}) {
  if (!regions.has(id)) return;
  regionId = id;
  renderSelection();
  if (presentation === "technical") {
    if (origin !== 'drawing' && !preparedViews().find(item => item.id === technicalId)?.regionIds.includes(id)) technicalId = null;
    const next = selectedTechnicalView();
    if (!next || next.id !== technicalId) {
      technicalId = next?.id || null;
      if (!next) presentation = "source";
      mountReader({ focus });
    } else drawingView?.select(id, { focus });
  } else if (presentation === "overview" && focus && !overviewViews().some(item => item.regionIds.includes(id))) {
    presentation = "source";
    mountReader({ focus });
  } else drawingView?.select(id, { focus });
  renderPresentation();
  updateURL({ replace: true });
  if (origin !== "model" && viewer.state?.lifecycle === "ready") {
    selectionSync++;
    try {
      await viewer.request("select", { nodeId: regions.get(id).partId });
    } catch (error) {
      notice(error.message);
    } finally {
      selectionSync--;
      lastSelected = regions.get(regionId).partId;
    }
  }
}
function syncView() {
  $("dp-stage").dataset.view = view;
  for (const button of document.querySelectorAll("button[data-view]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.view === view && page === "explore"),
    );
  $("dp-model-pane").inert = page !== "explore" || view === "drawings";
  $("dp-drawing-pane").inert = page !== "explore" || view === "3d";
  if (page !== "explore" || view === "drawings")
    void viewer.pause().catch(() => {});
  if (page === "explore" && view !== "3d") {
    if (!drawingView) mountReader();
    drawingView.resume?.();
    requestAnimationFrame(() => drawingView.resize());
  } else drawingView?.pause?.();
}
async function useSavedContext(context) {
  const match = await resolveReferencePreview(context, { catalog: DRAWING_CATALOG, staticReleases: DRAWING_RELEASES,
    listReleases: id => packageRepository?.listReleases(id) || [], resolveEntry: resolveDrawingEntry });
  const clean = new URL(location.href);
  clean.searchParams.delete('drawingRelease'); clean.searchParams.delete('drawingPreview');
  clean.searchParams.set('overview', match.presentationSnapshot?.revision || 'source');
  history.replaceState({}, '', clean);
  unavailableVersion = false;
  drawingView?.dispose(); entry?.dispose?.();
  entry = match; drawing = match.package; overviewSnapshot = match.presentationSnapshot;
  sheet = drawing.sheets.find(item => item.id === context.drawing.sheetId);
  regions = new Map(sheet.regions.map(item => [item.id, item])); regionId = context.drawing.regionId;
  presentation = overviewSnapshot ? 'overview' : 'source'; technicalId = null;
  renderPackage(); mountReader({ focus: true });
}
async function ensureWorkspace() {
  if (workspace) return workspace;
  if (!workspaceLoading)
    workspaceLoading = import("../product-room/workspace-entry.jsx")
      .then(
        ({ createWorkspace }) =>
          (workspace = createWorkspace($("dp-workspace"), {
            repository,
            sellerURL: (project, { tab = "inquiry", quoteId } = {}) =>
              `../studio/#drawing-project?id=${encodeURIComponent(project.id)}&tab=${tab}${quoteId ? `&quote=${encodeURIComponent(quoteId)}` : ""}`,
            onNavigate: (route) =>
              void navigate(route).catch((error) => notice(error.message)),
            onExplore: async (context) => {
              try {
                await useSavedContext(context);
                returnRoute = { ...currentRoute };
                $("dp-return-project").hidden = false;
                view = mobile.matches ? "drawings" : "compare";
                await navigate({ view: "explore" });
                drawingView.select(regionId, { focus: true });
              } catch (error) {
                notice(error.message);
              }
            },
          })),
      )
      .catch((error) => {
        workspaceLoading = null;
        throw error;
      });
  return workspaceLoading;
}
async function navigate(route, { record = true, skipGuard = false } = {}) {
  if (route.view === "inquiry" && !canInquire()) {
    notice(
      "Choose an available, confirmed source reference before starting an inquiry.",
    );
    route = { view: "explore" };
  }
  const turn = ++navigation;
  if (
    !skipGuard &&
    workspace &&
    page !== "explore" &&
    !(await workspace.beforeLeave(route))
  ) {
    updateURL({ replace: true });
    return;
  }
  if (turn !== navigation) return;
  const next = ["inquiry", "project", "projects", "components"].includes(
    route.view,
  )
    ? route.view
    : "explore";
  page = next;
  currentRoute = { ...route, view: next };
  $("dp-preview").hidden = next !== "explore";
  $("dp-workspace-page").hidden = next === "explore";
  $("dp-inquire").hidden = next !== "explore";
  $("dp-projects").setAttribute(
    "aria-current",
    next === "projects" ? "page" : "false",
  );
  renderSelection();
  syncView();
  renderPresentation();
  updateURL({ replace: !record });
  if (next === "explore") {
    if (view !== "drawings" && entry.available) await ensureViewer();
    return;
  }
  const host = await ensureWorkspace();
  if (turn !== navigation) return;
  const context =
    route.context || (canInquire() ? currentContext() : undefined);
  await host.open({ ...currentRoute, context });
  $("drawing-main").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
async function setView(next) {
  view = mobile.matches && next === "compare" ? "3d" : next;
  await navigate({ view: "explore" });
}
async function locate3D() {
  if (view === "drawings") await setView("3d");
  await ensureViewer();
  selectionSync++;
  try {
    await focusDrawingRegion(viewer, regions.get(regionId), entry.model);
  } finally {
    selectionSync--;
    lastSelected = regions.get(regionId).partId;
  }
}
const act = (fn) => (event) =>
  Promise.resolve()
    .then(() => fn(event))
    .catch((error) => notice(error.message));
for (const button of document.querySelectorAll("button[data-view]"))
  button.addEventListener(
    "click",
    act(() => setView(button.dataset.view)),
  );
$("dp-detail").addEventListener(
  "change",
  act(() => selectRegion($("dp-detail").value, { focus: true })),
);
function changeSheet(id) {
  sheet = drawing.sheets.find((item) => item.id === id);
  regions = new Map(sheet.regions.map((item) => [item.id, item]));
  regionId = sheet.regions[0]?.id;
  technicalId = null;
  if (presentation !== "source") presentation = "overview";
  renderPackage();
  mountReader();
  updateURL({ replace: true });
}
$("dp-sheet-select").addEventListener("change", () => changeSheet($("dp-sheet-select").value));
$("dp-overview-sheet").addEventListener("change", () => changeSheet($("dp-overview-sheet").value));
for (const button of document.querySelectorAll("button[data-presentation]"))
  button.addEventListener("click", act(() => {
    if (button.dataset.presentation === "overview" && !overviewViews().length) return;
    presentation = button.dataset.presentation;
    renderPackage(); mountReader(); updateURL({ replace: true });
    const instance = drawingView;
    requestAnimationFrame(() => {
      if (instance !== drawingView) return;
      if (presentation === "overview") {
        const root = instance.element;
        const opener = [...(root?.querySelectorAll("[data-overview-entry]") || [])].find(tile => tile.dataset.overviewEntry === technicalId)?.querySelector("button");
        (root?.dataset.layout === "single" ? root.querySelector("select") : opener || root?.querySelector("button"))?.focus({ preventScroll: true });
      } else if (presentation === "source") ($("dp-back-overview").hidden ? $("dp-fit") : $("dp-back-overview")).focus({ preventScroll: true });
    });
  }));
$("dp-technical-view-select").addEventListener("change", act(() => {
  const prepared = preparedViews().find(item => item.id === $("dp-technical-view-select").value);
  if (!prepared) return;
  technicalId = prepared.id;
  presentation = "technical";
  if (!prepared.regionIds.includes(regionId)) {
    regionId = prepared.defaultRegionId;
    void selectRegion(regionId).catch(error => notice(error.message));
  }
  renderPackage(); mountReader(); updateURL({ replace: true });
}));
for (const button of document.querySelectorAll("[data-technical-zoom]"))
  button.addEventListener("click", () => drawingView?.setZoom?.(Number(button.dataset.technicalZoom)));
$("dp-product-select").addEventListener("change", () => {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("product", $("dp-product-select").value);
  url.hash = "explore";
  location.assign(url);
});
$("dp-show-3d").addEventListener("click", act(locate3D));
$("dp-show-drawing").addEventListener(
  "click",
  act(async () => {
    if (view === "3d") await setView("drawings");
    await drawingView.ready;
    if (presentation === "overview") {
      const target = overviewViews().find(item => item.regionIds.includes(regionId));
      if (target) return openPreparedView({ entryId: target.id, regionId, focus: true });
      presentation = "source";
      mountReader();
      await drawingView.ready;
      updateURL({ replace: true });
    }
    drawingView.select(regionId, { focus: true });
  }),
);
$("dp-inquire").addEventListener(
  "click",
  act(() => {
    activeContext = currentContext();
    return navigate({ view: "inquiry", context: activeContext });
  }),
);
$("dp-projects").addEventListener(
  "click",
  act(() => navigate({ view: "projects" })),
);
$("dp-back").addEventListener(
  "click",
  act(() => navigate({ view: "explore" })),
);
$("dp-home").addEventListener(
  "click",
  act((event) => {
    event.preventDefault();
    return navigate({ view: "explore" });
  }),
);
$("dp-return-project").addEventListener(
  "click",
  act(() => navigate(returnRoute || { view: "projects" })),
);
$("dp-retry").addEventListener(
  "click",
  act(() => ensureViewer(true)),
);
$("dp-sheet-retry").addEventListener("click", () => mountReader());
$("dp-fit").addEventListener("click", () => drawingView?.fit());
$("dp-zoom-in").addEventListener("click", () => drawingView?.zoomBy(1.4));
$("dp-zoom-out").addEventListener("click", () => drawingView?.zoomBy(1 / 1.4));
$("dp-rotate").addEventListener("click", () => drawingView?.rotateBy?.(90));
$("dp-source").addEventListener("click", () =>
  $("dp-source-dialog").showModal(),
);
$("dp-source-close").addEventListener("click", () =>
  $("dp-source-dialog").close(),
);
window.addEventListener("annora:routechange", () => {
  currentRoute = { ...readBuyerRoute(), context: activeContext };
  committedURL = location.href;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    void viewer.pause().catch(() => {});
    drawingView?.pause?.();
  } else syncView();
});
mobile.addEventListener("change", () => {
  if (mobile.matches && view === "compare") view = "3d";
  syncView();
  updateURL({ replace: true });
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    drawingView?.dispose();
    entry?.dispose?.();
    viewer.dispose();
    workspace?.dispose();
  }
});
window.addEventListener(
  "popstate",
  act(async () => {
    const destination = new URL(location.href),
      previous = new URL(committedURL),
      route = readBuyerRoute();
    const turn = ++navigation;
    history.replaceState({}, "", previous);
    if (
      workspace &&
      page !== "explore" &&
      !(await workspace.beforeLeave(route))
    )
      return;
    if (turn !== navigation) return;
    const identity = [
      "product",
      "drawing",
      "mapping",
      "asset",
      "sheet",
      "detail",
      "drawingRelease",
      "drawingPreview",
      "overview",
    ];
    if (
      identity.some(
        (key) =>
          destination.searchParams.get(key) !== previous.searchParams.get(key),
      )
    ) {
      location.replace(destination.href);
      return;
    }
    history.replaceState({}, "", destination);
    readSelection(destination.searchParams);
    renderPackage();
    if (drawingView) mountReader();
    activeContext = null;
    await navigate(route, { record: false, skipGuard: true });
  }),
);
$("dp-use-current").addEventListener("click", () => {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("product", entry.id);
  url.searchParams.set("view", view);
  url.hash = "explore";
  location.assign(url);
});
function readSelection(query) {
  const issues = requestedDrawingIssues(drawing, query);
  if (issues.length) { unavailableVersion = true; notice(`${issues[0]} Current files are view-only; the saved reference is preserved.`); }
  sheet =
    drawing.sheets.find((item) => item.id === query.get("sheet")) ||
    drawing.sheets[0];
  regions = new Map(sheet.regions.map((item) => [item.id, item]));
  regionId = regions.has(query.get("detail"))
    ? query.get("detail")
    : sheet.regions[0]?.id;
  if (["3d", "drawings", "compare"].includes(query.get("view")))
    view = query.get("view");
  if (mobile.matches && view === "compare") view = "3d";
  if (!entry.available) view = "drawings";
  const requested = query.get("presentation");
  presentation = requested === "source" ? "source" : ["technical", "front", "bore"].includes(requested) ? "technical" : "overview";
  technicalId = query.get("technicalView");
  if (["front", "bore"].includes(query.get("presentation"))) {
    technicalId = preparedViews().find(item => item.legacyPresentation === query.get("presentation") && item.regionIds.includes(regionId))?.id || technicalId;
  }
  if (presentation === "overview" && !overviewViews().length || presentation === "technical" && !selectedTechnicalView()) presentation = "source";
}
async function start() {
  const query = new URLSearchParams(location.search);
  entry = drawingEntry(query.get("product")) || DRAWING_CATALOG[0];
  if (!entry)
    throw new Error(
      "This deployment has no prepared drawing packages. Add a paired package before opening the drawing preview.",
    );
  if (query.get("product") && !drawingEntry(query.get("product"))) {
    unavailableVersion = true;
    notice(
      "That prepared product is unavailable. Select an available reference.",
    );
  }
  try {
    const records = [...((await packageRepository?.listReleases(entry.id)) || []), ...DRAWING_RELEASES.filter(item => item.productId === entry.id)];
    const explicitIdentity = ['drawing', 'mapping', 'asset', 'overview', 'drawingRelease', 'drawingPreview'].some(key => query.has(key));
    let record = query.get('drawingRelease')
      ? resolveDrawingRelease(query.get('drawingRelease')) || await packageRepository.getRelease(query.get('drawingRelease'))
      : query.get('drawingPreview') ? await packageRepository.getPreview(query.get('drawingPreview'))
      : !explicitIdentity ? await packageRepository?.getPublished(entry.id) : null;
    const matchesQuery = item => (!query.get('mapping') || item.mappingRevision === query.get('mapping')) &&
      (!query.get('drawing') || item.sourceRevision === query.get('drawing')) &&
      (!query.get('asset') || item.packageSnapshot.assets.some(asset => asset.sha256 === query.get('asset')));
    if (record && !matchesQuery(record)) throw new Error('The requested drawing release and saved source identifiers do not match. Select the exact saved reference before starting an inquiry.');
    if (!record && ((query.get('mapping') && query.get('mapping') !== entry.package.mappingRevision) ||
        (query.get('drawing') && query.get('drawing') !== entry.package.revision) ||
        (query.get('asset') && !entry.package.assets.some(asset => asset.sha256 === query.get('asset'))))) {
      record = records.find(matchesQuery);
      if (!record) throw new Error('That association version is unavailable. Saved references are preserved; current files are view-only.');
    }
    if (record) {
      entry = await resolveDrawingEntry(entry, record.packageSnapshot);
      overviewSnapshot = record.presentationSnapshot !== undefined ? record.presentationSnapshot : entry.legacyOverviewPresentation;
    } else overviewSnapshot = explicitIdentity ? entry.legacyOverviewPresentation : entry.overviewPresentation;
    const requestedOverview = query.get('overview');
    if (requestedOverview === 'source') overviewSnapshot = null;
    else if (requestedOverview) {
      const choices = [overviewSnapshot, entry.legacyOverviewPresentation,
        ...records.filter(item => matchesQuery(item)).map(item => item.presentationSnapshot)];
      const found = choices.find(item => item?.revision === requestedOverview);
      if (!found) { overviewSnapshot = null; throw new Error('That saved overview is unavailable. Its original PDF remains accessible; a newer overview will not replace it.'); }
      overviewSnapshot = found;
    }
    if (overviewSnapshot) {
      overviewSnapshot = normalizeOverviewPresentation(overviewSnapshot);
      if (overviewPresentationIssues(overviewSnapshot, entry.package).length) overviewSnapshot = null;
    }
  } catch (error) {
    unavailableVersion = true;
    notice(error.message);
  }
  drawing = entry.package;
  if (query.get("drawing") && query.get("drawing") !== drawing.revision) {
    unavailableVersion = true;
    notice(
      "That source version is unavailable. The current reference is shown for viewing only; saved inquiries keep their original version.",
    );
  }
  readSelection(query);
  if (query.get("asset") && drawing.assets.find(asset => asset.id === sheet.assetId)?.sha256 !== query.get("asset")) {
    unavailableVersion = true;
    notice("The requested source file is unavailable. The current drawing is view-only; original references are preserved.");
  }
  renderPackage();
  await navigate(readBuyerRoute(), { record: false });
}
void start().catch((error) => notice(error.message));
