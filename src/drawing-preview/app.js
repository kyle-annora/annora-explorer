import "./styles.css";
import {
  DRAWING_CATALOG,
  DRAWING_RELEASES,
  resolveDrawingRelease,
  drawingEntry,
  entryForSnapshot,
} from "../drawings/catalog.js";
import { sourceAssetFor } from "../drawings/package.js";
import { createDrawingReader } from "../drawings/reader.js";
import { createDrawingRepository } from "../studio/drawing-repository.js";
import { createRoomViewer } from "../product-room/viewer.js";
import { createDrawingProjectRepository } from "../product-room/drawing-inquiry.js";
import { readBuyerRoute, buyerRouteHash } from "../product-room/navigation.js";
import { createDrawingContext } from "./context.js";
import { focusDrawingRegion } from "./model-views.js";

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
  }
  url.searchParams.set("view", view);
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
  $("dp-show-3d").disabled = !entry.available || !region?.camera;
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
}
function mountReader({ focus = false } = {}) {
  const generation = ++readerGeneration;
  drawingView?.dispose();
  $("dp-sheet-error").hidden = true;
  drawingView = createDrawingReader({
    mount: $("dp-sheet"),
    package: drawing,
    sheetId: sheet.id,
    onSelect: (id) => void selectRegion(id, { origin: "drawing" }),
    onViewChange: (state) => {
      if (generation !== readerGeneration) return;
      $("dp-zoom").textContent = `${Math.round(state.zoom * 100)}%`;
      $("dp-zoom-in").disabled = !state.canZoomIn;
      $("dp-zoom-out").disabled = !state.canZoomOut;
    },
    onError: () => {
      if (generation === readerGeneration) $("dp-sheet-error").hidden = false;
    },
  });
  const instance = drawingView;
  instance.ready
    .then(() => {
      if (generation !== readerGeneration) return;
      instance.select(regionId, { focus });
      if (view === "3d" || page !== "explore") instance.pause?.();
    })
    .catch(() => {});
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
  drawingView?.select(id, { focus });
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
  const candidate = drawingEntry(context.modelId),
    ref = context.drawing;
  if (!candidate || candidate.model.revision !== context.modelRevision || !ref)
    throw new Error(
      "The saved model version is unavailable. Its original record remains unchanged.",
    );
  let match = candidate;
  const clean = new URL(location.href);
  clean.searchParams.delete("drawingRelease");
  clean.searchParams.delete("drawingPreview");
  if (
    ref.mappingRevision &&
    ref.mappingRevision !== match.package.mappingRevision
  ) {
    const releases = [
        ...((await packageRepository?.listReleases(candidate.id)) || []),
        ...DRAWING_RELEASES.filter((item) => item.productId === candidate.id),
      ],
      release = releases.find(
        (item) => item.mappingRevision === ref.mappingRevision,
      );
    if (!release)
      throw new Error(
        "This saved association version is unavailable. Its original record is preserved.",
      );
    match = entryForSnapshot(candidate, release.packageSnapshot);
    clean.searchParams.set("drawingRelease", release.id);
  }
  const target = match.package.sheets.find((item) => item.id === ref.sheetId),
    asset = match.package.assets.find((item) => item.id === target?.assetId);
  if (
    ref.revision !== match.package.revision ||
    asset?.id !== ref.assetId ||
    asset?.sha256 !== ref.assetRevision ||
    !target?.regions.some(
      (item) => item.id === ref.regionId && item.partId === ref.partId,
    )
  )
    throw new Error(
      "The saved source reference is unavailable. Current files will not replace it.",
    );
  history.replaceState({}, "", clean);
  unavailableVersion = false;
  entry = match;
  drawing = entry.package;
  sheet = target;
  regions = new Map(sheet.regions.map((item) => [item.id, item]));
  regionId = ref.regionId;
  renderPackage();
  mountReader({ focus: true });
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
$("dp-sheet-select").addEventListener("change", () => {
  sheet = drawing.sheets.find((item) => item.id === $("dp-sheet-select").value);
  regions = new Map(sheet.regions.map((item) => [item.id, item]));
  regionId = sheet.regions[0]?.id;
  renderPackage();
  mountReader();
  updateURL({ replace: true });
});
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
      "drawingRelease",
      "drawingPreview",
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
}
async function start() {
  const query = new URLSearchParams(location.search);
  entry = drawingEntry(query.get("product")) || DRAWING_CATALOG[0];
  if (!entry)
    throw new Error(
      "This deployment has no prepared drawing packages. Add a paired package before opening the drawing preview.",
    );
  if (query.get("product") && !drawingEntry(query.get("product")))
    notice(
      "That prepared product is unavailable. Select an available reference.",
    );
  try {
    const record = query.get("drawingRelease")
      ? resolveDrawingRelease(query.get("drawingRelease")) ||
        (await packageRepository.getRelease(query.get("drawingRelease")))
      : query.get("drawingPreview")
        ? await packageRepository.getPreview(query.get("drawingPreview"))
        : null;
    if (record) entry = entryForSnapshot(entry, record.packageSnapshot);
    else if (
      query.get("mapping") &&
      query.get("mapping") !== entry.package.mappingRevision
    ) {
      const records = [
        ...((await packageRepository?.listReleases(entry.id)) || []),
        ...DRAWING_RELEASES.filter((item) => item.productId === entry.id),
      ];
      const matching = records.find(
        (item) => item.mappingRevision === query.get("mapping"),
      );
      if (!matching)
        throw new Error(
          "That association version is unavailable. Saved references are preserved; the current mapping is view-only.",
        );
      entry = entryForSnapshot(entry, matching.packageSnapshot);
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
  renderPackage();
  await navigate(readBuyerRoute(), { record: false });
}
void start().catch((error) => notice(error.message));
